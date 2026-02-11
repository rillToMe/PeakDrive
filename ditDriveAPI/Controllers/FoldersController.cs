using System.IO.Compression;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ditDriveAPI.Data;

namespace ditDriveAPI.Controllers;

[ApiController]
[Route("api/folders")]
[Authorize]
public class FoldersController(AppDbContext db, IConfiguration configuration, IWebHostEnvironment environment) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly IConfiguration _configuration = configuration;
    private readonly IWebHostEnvironment _environment = environment;

    [HttpGet("exists")]
    public IActionResult CheckFolderExists([FromQuery] string name, [FromQuery] string? parentPublicId)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest("Folder name is required.");
        }

        var userId = GetUserId();
        int? parentId = null;
        if (!string.IsNullOrWhiteSpace(parentPublicId) && !string.Equals(parentPublicId, "root", StringComparison.OrdinalIgnoreCase))
        {
            var parent = _db.Folders.FirstOrDefault(f =>
                f.PublicId == parentPublicId && f.UserId == userId && f.DeletedAt == null);
            if (parent == null)
            {
                return NotFound("Parent folder not found.");
            }
            parentId = parent.Id;
        }

        var exists = _db.Folders.Any(f =>
            f.Name.ToLower() == name.Trim().ToLower() &&
            f.ParentId == parentId &&
            f.UserId == userId &&
            f.DeletedAt == null);

        return Ok(new { exists });
    }

    [HttpPost]
    public IActionResult CreateFolder([FromBody] CreateFolderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Folder name is required.");
        }

        var userId = GetUserId();
        int? parentId = null;
        if (!string.IsNullOrWhiteSpace(request.ParentPublicId))
        {
            var parent = _db.Folders.FirstOrDefault(f =>
                f.PublicId == request.ParentPublicId && f.UserId == userId && f.DeletedAt == null);
            if (parent == null)
            {
                return NotFound("Parent folder not found.");
            }
            parentId = parent.Id;
        }

        var folder = new DriveFolder
        {
            PublicId = CreatePublicId(),
            Name = request.Name,
            ParentId = parentId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Folders.Add(folder);
        _db.SaveChanges();
        LogActivity(userId, "create-folder", "success", $"Created {folder.Name}");

        return Ok(new FolderDto(folder.PublicId, folder.Name, request.ParentPublicId, folder.CreatedAt));
    }

    [HttpGet("{publicId}")]
    public IActionResult GetFolder(string publicId)
    {
        var userId = GetUserId();

        if (string.Equals(publicId, "root", StringComparison.OrdinalIgnoreCase))
        {
            var rootFolders = _db.Folders
                .Where(f => f.UserId == userId && f.ParentId == null && f.DeletedAt == null)
                .OrderBy(f => f.Name)
                .Select(f => new FolderDto(f.PublicId, f.Name, null, f.CreatedAt))
                .ToList();

            var rootFiles = _db.Files
                .Where(f => f.UserId == userId && f.FolderId == null && f.DeletedAt == null)
                .OrderBy(f => f.Filename)
                .Select(f => new FileDto(f.PublicId, f.Filename, f.FileType, f.Size, f.UploadedAt))
                .ToList();

            return Ok(new FolderListing(null, rootFolders, rootFiles));
        }

        var folderEntity = _db.Folders.FirstOrDefault(f =>
            f.PublicId == publicId && f.UserId == userId && f.DeletedAt == null);
        if (folderEntity == null)
        {
            return NotFound();
        }

        var folders = _db.Folders
            .Where(f => f.UserId == userId && f.ParentId == folderEntity.Id && f.DeletedAt == null)
            .OrderBy(f => f.Name)
            .Select(f => new FolderDto(f.PublicId, f.Name, publicId, f.CreatedAt))
            .ToList();

        var files = _db.Files
            .Where(f => f.UserId == userId && f.FolderId == folderEntity.Id && f.DeletedAt == null)
            .OrderBy(f => f.Filename)
            .Select(f => new FileDto(f.PublicId, f.Filename, f.FileType, f.Size, f.UploadedAt))
            .ToList();

        var parentPublicId = folderEntity.ParentId.HasValue
            ? _db.Folders.Where(f => f.Id == folderEntity.ParentId.Value).Select(f => f.PublicId).FirstOrDefault()
            : null;

        return Ok(new FolderListing(
            new FolderDto(folderEntity.PublicId, folderEntity.Name, parentPublicId, folderEntity.CreatedAt),
            folders,
            files
        ));
    }

    [HttpPut("{publicId}")]
    public IActionResult RenameFolder(string publicId, [FromBody] RenameFolderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Folder name is required.");
        }

        var userId = GetUserId();
        var folder = _db.Folders.FirstOrDefault(f =>
            f.PublicId == publicId && f.UserId == userId && f.DeletedAt == null);
        if (folder == null)
        {
            return NotFound();
        }

        folder.Name = request.Name.Trim();
        _db.SaveChanges();

        var parentPublicId = folder.ParentId.HasValue
            ? _db.Folders.Where(f => f.Id == folder.ParentId.Value).Select(f => f.PublicId).FirstOrDefault()
            : null;

        return Ok(new FolderDto(folder.PublicId, folder.Name, parentPublicId, folder.CreatedAt));
    }

    [HttpGet("download/{publicId}")]
    [HttpGet("download-zip/{publicId}")]
    public IActionResult DownloadFolder(string publicId)
    {
        var userId = GetUserId();
        var folder = _db.Folders.FirstOrDefault(f =>
            f.PublicId == publicId && f.UserId == userId && f.DeletedAt == null);
        if (folder == null)
        {
            return NotFound();
        }

        var tempPath = Path.Combine(Path.GetTempPath(), $"folder_{folder.Id}_{Guid.NewGuid():N}.zip");
        try
        {
            using (var zipStream = new FileStream(tempPath, FileMode.Create, FileAccess.ReadWrite, FileShare.None))
            using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create, true))
            {
                AddFolderToZip(archive, folder, userId, folder.Name);
            }
        }
        catch (InvalidOperationException)
        {
            if (System.IO.File.Exists(tempPath))
            {
                System.IO.File.Delete(tempPath);
            }
            return BadRequest("Invalid storage path.");
        }

        var downloadName = $"{folder.Name}.zip";
        var readStream = new FileStream(tempPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        Response.OnCompleted(() =>
        {
            System.IO.File.Delete(tempPath);
            return Task.CompletedTask;
        });
        return File(readStream, "application/zip", downloadName);
    }

    [HttpDelete("{publicId}")]
    public IActionResult DeleteFolder(string publicId)
    {
        return DeleteFolderInternal(publicId);
    }

    [HttpPost("delete/{publicId}")]
    public IActionResult DeleteFolderPost(string publicId)
    {
        return DeleteFolderInternal(publicId);
    }

    private IActionResult DeleteFolderInternal(string publicId)
    {
        var userId = GetUserId();
        var folder = _db.Folders.FirstOrDefault(f =>
            f.PublicId == publicId && f.UserId == userId && f.DeletedAt == null);
        if (folder == null)
        {
            return NotFound();
        }

        try
        {
            MoveFolderToTrash(folder, userId, DateTime.UtcNow);
        }
        catch (InvalidOperationException)
        {
            return BadRequest("Invalid storage path.");
        }
        _db.SaveChanges();
        LogActivity(userId, "delete-folder", "success", $"Moved {folder.Name} to trash");
        return NoContent();
    }

    private int GetUserId()
    {
        var idValue = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(idValue, out var id) ? id : 0;
    }

    private void AddFolderToZip(ZipArchive archive, DriveFolder folder, int userId, string currentPath)
    {
        archive.CreateEntry($"{currentPath}/");

        var files = _db.Files
            .Where(f => f.UserId == userId && f.FolderId == folder.Id)
            .OrderBy(f => f.Filename)
            .ToList();

        foreach (var file in files)
        {
            if (!TryBuildFilePath(file, out var fullPath))
            {
                throw new InvalidOperationException("Invalid storage path.");
            }
            if (!System.IO.File.Exists(fullPath))
            {
                continue;
            }

            var entryPath = Path.Combine(currentPath, file.Filename).Replace("\\", "/");
            archive.CreateEntryFromFile(fullPath, entryPath);
        }

        var children = _db.Folders
            .Where(f => f.UserId == userId && f.ParentId == folder.Id && f.DeletedAt == null)
            .OrderBy(f => f.Name)
            .ToList();

        foreach (var child in children)
        {
            AddFolderToZip(archive, child, userId, Path.Combine(currentPath, child.Name).Replace("\\", "/"));
        }
    }

    private void DeleteFolderTree(DriveFolder folder, int userId)
    {
        var files = _db.Files.Where(f => f.UserId == userId && f.FolderId == folder.Id).ToList();
        foreach (var file in files)
        {
            if (!TryBuildFilePath(file, out var fullPath))
            {
                throw new InvalidOperationException("Invalid storage path.");
            }
            if (System.IO.File.Exists(fullPath))
            {
                System.IO.File.Delete(fullPath);
            }
        }
        _db.Files.RemoveRange(files);

        var children = _db.Folders.Where(f => f.UserId == userId && f.ParentId == folder.Id).ToList();
        foreach (var child in children)
        {
            DeleteFolderTree(child, userId);
        }

        _db.Folders.Remove(folder);
    }

    private void MoveFolderToTrash(DriveFolder folder, int userId, DateTime deletedAt)
    {
        folder.DeletedAt = deletedAt;
        var files = _db.Files.Where(f => f.UserId == userId && f.FolderId == folder.Id && f.DeletedAt == null).ToList();
        foreach (var file in files)
        {
            file.DeletedAt = deletedAt;
        }

        var children = _db.Folders.Where(f => f.UserId == userId && f.ParentId == folder.Id && f.DeletedAt == null).ToList();
        foreach (var child in children)
        {
            MoveFolderToTrash(child, userId, deletedAt);
        }
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

    private string GetStorageRoot()
    {
        var storageRoot = _configuration["Storage:RootPath"] ?? "storage";
        var basePath = Path.Combine(_environment.ContentRootPath, storageRoot);
        return Path.GetFullPath(basePath);
    }

    private bool TryBuildFilePath(DriveFile file, out string fullPath)
    {
        var root = GetStorageRoot();
        var folderSegment = file.FolderId.HasValue ? $"folder_{file.FolderId}" : "folder_root";
        fullPath = Path.GetFullPath(Path.Combine(root, $"user_{file.UserId}", folderSegment, file.StoredName));
        return IsWithinRoot(fullPath, root);
    }

    private static bool IsWithinRoot(string fullPath, string root)
    {
        var rootPath = root.EndsWith(Path.DirectorySeparatorChar) || root.EndsWith(Path.AltDirectorySeparatorChar)
            ? root
            : root + Path.DirectorySeparatorChar;
        return fullPath.StartsWith(rootPath, StringComparison.OrdinalIgnoreCase);
    }

    private static string CreatePublicId()
    {
        return Guid.NewGuid().ToString("N");
    }
}

public record CreateFolderRequest(string Name, string? ParentPublicId);
public record RenameFolderRequest(string Name);
public record FolderDto(string PublicId, string Name, string? ParentPublicId, DateTime CreatedAt);
public record FileDto(string PublicId, string Filename, string FileType, long Size, DateTime UploadedAt);
public record FolderListing(FolderDto? Folder, List<FolderDto> Folders, List<FileDto> Files);
