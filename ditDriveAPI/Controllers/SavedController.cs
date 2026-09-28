using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ditDriveAPI.Data;

namespace ditDriveAPI.Controllers;

[ApiController]
[Route("api/saved")]
[Authorize]
public class SavedController(AppDbContext db) : ControllerBase
{
    private readonly AppDbContext _db = db;

    [HttpGet]
    public IActionResult GetSavedItems([FromQuery] int? page, [FromQuery] int? pageSize)
    {
        var userId = GetUserId();
        var currentPage = Math.Max(1, page.GetValueOrDefault(1));
        var size = pageSize.GetValueOrDefault(30);
        if (size <= 0)
        {
            size = 30;
        }
        if (size > 100)
        {
            size = 100;
        }

        var query = _db.SavedItems
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.SavedAt);

        var total = query.Count();
        var items = query.Skip((currentPage - 1) * size).Take(size).ToList();

        var fileIds = items.Where(i => i.TargetType == "file").Select(i => i.TargetId).Distinct().ToList();
        var folderIds = items.Where(i => i.TargetType == "folder").Select(i => i.TargetId).Distinct().ToList();

        var files = _db.Files.Where(f => fileIds.Contains(f.Id)).ToList();
        var folders = _db.Folders.Where(f => folderIds.Contains(f.Id)).ToList();

        var fileMap = files.ToDictionary(f => f.Id, f => f);
        var folderMap = folders.ToDictionary(f => f.Id, f => f);

        var results = items
            .Select(item =>
            {
                if (item.TargetType == "file" && fileMap.TryGetValue(item.TargetId, out var file))
                {
                    var available = file.DeletedAt == null;
                    return new SavedItemDto(
                        item.Id,
                        item.TargetType,
                        item.TargetId,
                        item.SavedAt,
                        available,
                        new SavedFileDto(file.PublicId, file.Filename, file.FileType, file.Size, file.UploadedAt),
                        null
                    );
                }
                if (item.TargetType == "folder" && folderMap.TryGetValue(item.TargetId, out var folder))
                {
                    var available = folder.DeletedAt == null;
                    return new SavedItemDto(
                        item.Id,
                        item.TargetType,
                        item.TargetId,
                        item.SavedAt,
                        available,
                        null,
                        new SavedFolderDto(folder.PublicId, folder.Name, folder.CreatedAt)
                    );
                }

                return new SavedItemDto(item.Id, item.TargetType, item.TargetId, item.SavedAt, false, null, null);
            })
            .ToList();

        return Ok(new SavedListResponse(results, total));
    }

    [HttpGet("check")]
    public IActionResult CheckSaved([FromQuery] string targetType, [FromQuery] string publicId)
    {
        var userId = GetUserId();
        if (!TryNormalizeTargetType(targetType, out var normalized))
        {
            return BadRequest("Invalid target type.");
        }
        if (string.IsNullOrWhiteSpace(publicId))
        {
            return BadRequest("PublicId is required.");
        }

        int? targetId = normalized == "file"
            ? _db.Files.Where(f => f.PublicId == publicId && f.UserId == userId).Select(f => (int?)f.Id).FirstOrDefault()
            : _db.Folders.Where(f => f.PublicId == publicId && f.UserId == userId).Select(f => (int?)f.Id).FirstOrDefault();

        if (!targetId.HasValue)
        {
            return NotFound();
        }

        var saved = _db.SavedItems.Any(s => s.UserId == userId && s.TargetType == normalized && s.TargetId == targetId.Value);
        return Ok(new SavedStatusResponse(saved));
    }

    [HttpGet("share/{token}")]
    public IActionResult CheckSavedShare(string token)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(token))
        {
            return BadRequest("Token is required.");
        }

        var share = _db.Shares.FirstOrDefault(s => s.Token == token);
        if (share == null)
        {
            return NotFound();
        }

        if (share.FileId.HasValue)
        {
            var saved = _db.SavedItems.Any(s => s.UserId == userId && s.TargetType == "file" && s.TargetId == share.FileId.Value);
            return Ok(new SavedStatusResponse(saved));
        }

        if (share.FolderId.HasValue)
        {
            var saved = _db.SavedItems.Any(s => s.UserId == userId && s.TargetType == "folder" && s.TargetId == share.FolderId.Value);
            return Ok(new SavedStatusResponse(saved));
        }

        return NotFound();
    }

    [HttpPost]
    public IActionResult SaveItem([FromBody] SaveRequest request)
    {
        var userId = GetUserId();
        if (!TryNormalizeTargetType(request.TargetType, out var normalized))
        {
            return BadRequest("Invalid target type.");
        }
        if (string.IsNullOrWhiteSpace(request.PublicId))
        {
            return BadRequest("PublicId is required.");
        }

        var targetId = normalized == "file"
            ? _db.Files.Where(f => f.PublicId == request.PublicId && f.UserId == userId && f.DeletedAt == null)
                .Select(f => (int?)f.Id)
                .FirstOrDefault()
            : _db.Folders.Where(f => f.PublicId == request.PublicId && f.UserId == userId && f.DeletedAt == null)
                .Select(f => (int?)f.Id)
                .FirstOrDefault();

        if (!targetId.HasValue)
        {
            return NotFound();
        }

        var existing = _db.SavedItems.FirstOrDefault(s =>
            s.UserId == userId && s.TargetType == normalized && s.TargetId == targetId.Value);
        if (existing != null)
        {
            return Ok(existing.Id);
        }

        var item = new SavedItem
        {
            UserId = userId,
            TargetType = normalized,
            TargetId = targetId.Value,
            SavedAt = DateTime.UtcNow
        };
        _db.SavedItems.Add(item);
        _db.SaveChanges();
        LogActivity(userId, "save-item", "success", $"Saved {normalized} {request.PublicId}");
        return Ok(item.Id);
    }

    [HttpPost("share/{token}")]
    public IActionResult SaveFromShare(string token)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(token))
        {
            return BadRequest("Token is required.");
        }

        var share = _db.Shares.FirstOrDefault(s => s.Token == token);
        if (share == null)
        {
            return NotFound();
        }

        if (share.FileId.HasValue)
        {
            var file = _db.Files.FirstOrDefault(f => f.Id == share.FileId.Value);
            if (file == null || file.DeletedAt != null)
            {
                return NotFound();
            }

            var existing = _db.SavedItems.FirstOrDefault(s =>
                s.UserId == userId && s.TargetType == "file" && s.TargetId == file.Id);
            if (existing != null)
            {
                return Ok(existing.Id);
            }

            var item = new SavedItem
            {
                UserId = userId,
                TargetType = "file",
                TargetId = file.Id,
                SavedAt = DateTime.UtcNow
            };
            _db.SavedItems.Add(item);
            _db.SaveChanges();
            LogActivity(userId, "save-item", "success", $"Saved file {file.PublicId}");
            return Ok(item.Id);
        }

        if (share.FolderId.HasValue)
        {
            var folder = _db.Folders.FirstOrDefault(f => f.Id == share.FolderId.Value);
            if (folder == null || folder.DeletedAt != null)
            {
                return NotFound();
            }

            var existing = _db.SavedItems.FirstOrDefault(s =>
                s.UserId == userId && s.TargetType == "folder" && s.TargetId == folder.Id);
            if (existing != null)
            {
                return Ok(existing.Id);
            }

            var item = new SavedItem
            {
                UserId = userId,
                TargetType = "folder",
                TargetId = folder.Id,
                SavedAt = DateTime.UtcNow
            };
            _db.SavedItems.Add(item);
            _db.SaveChanges();
            LogActivity(userId, "save-item", "success", $"Saved folder {folder.PublicId}");
            return Ok(item.Id);
        }

        return NotFound();
    }

    [HttpDelete("share/{token}")]
    public IActionResult RemoveSavedShare(string token)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(token))
        {
            return BadRequest("Token is required.");
        }

        var share = _db.Shares.FirstOrDefault(s => s.Token == token);
        if (share == null)
        {
            return NotFound();
        }

        if (share.FileId.HasValue)
        {
            var item = _db.SavedItems.FirstOrDefault(s =>
                s.UserId == userId && s.TargetType == "file" && s.TargetId == share.FileId.Value);
            if (item == null)
            {
                return NotFound();
            }

            _db.SavedItems.Remove(item);
            _db.SaveChanges();
            LogActivity(userId, "remove-saved", "success", $"Removed saved file {share.FileId.Value}");
            return Ok();
        }

        if (share.FolderId.HasValue)
        {
            var item = _db.SavedItems.FirstOrDefault(s =>
                s.UserId == userId && s.TargetType == "folder" && s.TargetId == share.FolderId.Value);
            if (item == null)
            {
                return NotFound();
            }

            _db.SavedItems.Remove(item);
            _db.SaveChanges();
            LogActivity(userId, "remove-saved", "success", $"Removed saved folder {share.FolderId.Value}");
            return Ok();
        }

        return NotFound();
    }

    [HttpDelete("{id:int}")]
    public IActionResult RemoveSavedItem(int id)
    {
        var userId = GetUserId();
        var item = _db.SavedItems.FirstOrDefault(s => s.Id == id && s.UserId == userId);
        if (item == null)
        {
            return NotFound();
        }

        _db.SavedItems.Remove(item);
        _db.SaveChanges();
        LogActivity(userId, "remove-saved", "success", $"Removed saved item {id}");
        return Ok();
    }

    [HttpDelete]
    public IActionResult RemoveSavedByTarget([FromBody] SaveRequest request)
    {
        var userId = GetUserId();
        if (!TryNormalizeTargetType(request.TargetType, out var normalized))
        {
            return BadRequest("Invalid target type.");
        }
        if (string.IsNullOrWhiteSpace(request.PublicId))
        {
            return BadRequest("PublicId is required.");
        }

        int? targetId = normalized == "file"
            ? _db.Files.Where(f => f.PublicId == request.PublicId).Select(f => (int?)f.Id).FirstOrDefault()
            : _db.Folders.Where(f => f.PublicId == request.PublicId).Select(f => (int?)f.Id).FirstOrDefault();

        if (!targetId.HasValue)
        {
            return NotFound();
        }

        var item = _db.SavedItems.FirstOrDefault(s =>
            s.UserId == userId && s.TargetType == normalized && s.TargetId == targetId.Value);
        if (item == null)
        {
            return NotFound();
        }

        _db.SavedItems.Remove(item);
        _db.SaveChanges();
        LogActivity(userId, "remove-saved", "success", $"Removed saved {normalized} {request.PublicId}");
        return Ok();
    }

    private static bool TryNormalizeTargetType(string? value, out string normalized)
    {
        normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized is "file" or "folder";
    }

    private int GetUserId()
    {
        var idValue = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(idValue, out var id) ? id : 0;
    }

    private void LogActivity(int? userId, string action, string status, string message)
    {
        try
        {
            _db.ActivityLogs.Add(new ActivityLog
            {
                UserId = userId,
                Action = action,
                Status = status,
                Message = message,
                CreatedAt = DateTime.UtcNow
            });
            _db.SaveChanges();
        }
        catch
        {
        }
    }
}

public record SaveRequest(string TargetType, string PublicId);
public record SavedStatusResponse(bool Saved);
public record SavedFileDto(string PublicId, string Filename, string FileType, long Size, DateTime UploadedAt);
public record SavedFolderDto(string PublicId, string Name, DateTime CreatedAt);
public record SavedItemDto(
    int Id,
    string TargetType,
    int TargetId,
    DateTime SavedAt,
    bool Available,
    SavedFileDto? File,
    SavedFolderDto? Folder
);
public record SavedListResponse(List<SavedItemDto> Items, int Total);
