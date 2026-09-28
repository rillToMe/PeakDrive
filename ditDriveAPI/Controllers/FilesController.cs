using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ditDriveAPI.Data;
using ditDriveAPI.Services.TreeD;
using SixLabors.ImageSharp.Formats.Png;

namespace ditDriveAPI.Controllers;

[ApiController]
[Route("api/files")]
[Authorize]
public class FilesController(AppDbContext db, IConfiguration configuration, IWebHostEnvironment environment, TreeDThumbnailService treeDThumbnailService) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly IConfiguration _configuration = configuration;
    private readonly IWebHostEnvironment _environment = environment;
    private readonly TreeDThumbnailService _treeDThumbnailService = treeDThumbnailService;

    [HttpPost("upload")]
    [RequestSizeLimit(long.MaxValue)]
    public async Task<IActionResult> Upload([FromQuery] string? folderPublicId, [FromForm] IFormFile file)
    {
        var userId = GetUserId();
        if (file == null || file.Length == 0)
        {
            LogActivity(userId, "upload", "error", "File is required.");
            return BadRequest("File is required.");
        }

        int? folderId = null;
        if (!string.IsNullOrWhiteSpace(folderPublicId))
        {
            var folder = _db.Folders.FirstOrDefault(f => f.PublicId == folderPublicId && f.UserId == userId && f.DeletedAt == null);
            if (folder == null)
            {
                LogActivity(userId, "upload", "error", "Folder not found.");
                return NotFound("Folder not found.");
            }
            folderId = folder.Id;
        }

        var storedName = $"{Guid.NewGuid():N}{Path.GetExtension(file.FileName)}";
        if (!TryBuildStoragePath(userId, folderId, out var storagePath))
        {
            LogActivity(userId, "upload", "error", "Invalid storage path.");
            return BadRequest("Invalid storage path.");
        }
        Directory.CreateDirectory(storagePath);

        var fullPath = Path.GetFullPath(Path.Combine(storagePath, storedName));
        if (!IsWithinRoot(fullPath, GetStorageRoot()))
        {
            LogActivity(userId, "upload", "error", "Invalid storage path.");
            return BadRequest("Invalid storage path.");
        }
        try
        {
            await using (var stream = System.IO.File.Create(fullPath))
            {
                await file.CopyToAsync(stream);
            }
        }
        catch (Exception ex)
        {
            LogActivity(userId, "upload", "error", ex.Message);
            return BadRequest("Gagal menyimpan file.");
        }

        var driveFile = new DriveFile
        {
            UserId = userId,
            FolderId = folderId,
            PublicId = CreatePublicId(),
            Filename = file.FileName,
            StoredName = storedName,
            FileType = file.ContentType ?? "application/octet-stream",
            Size = file.Length,
            UploadedAt = DateTime.UtcNow,
            DeletedAt = null
        };

        _db.Files.Add(driveFile);
        _db.SaveChanges();
        LogActivity(userId, "upload", "success", $"Uploaded {driveFile.Filename}");

        if (_treeDThumbnailService.IsModelFile(driveFile.Filename))
        {
            try
            {
                if (_treeDThumbnailService.TryGenerateModelThumbnail(fullPath, driveFile, userId, out var thumbName))
                {
                    driveFile.ThumbnailName = thumbName;
                    _db.SaveChanges();
                }
                else
                {
                    _db.Files.Remove(driveFile);
                    _db.SaveChanges();
                    if (System.IO.File.Exists(fullPath))
                    {
                        System.IO.File.Delete(fullPath);
                    }
                    return StatusCode(500, "Gagal render thumbnail 3D.");
                }
            }
            catch
            {
                _db.Files.Remove(driveFile);
                _db.SaveChanges();
                if (System.IO.File.Exists(fullPath))
                {
                    System.IO.File.Delete(fullPath);
                }
                return StatusCode(500, "Gagal render thumbnail 3D.");
            }
        }

        return Ok(new FileDetailDto(
            driveFile.PublicId,
            driveFile.Filename,
            driveFile.FileType,
            driveFile.Size,
            driveFile.UploadedAt,
            driveFile.ThumbnailName));
    }

    [HttpGet("thumbnail/{publicId}")]
    public IActionResult ViewThumbnail(string publicId)
    {
        var userId = GetUserId();
        var file = _db.Files.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId && f.DeletedAt == null);
        if (file == null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(file.ThumbnailName))
        {
            if (_treeDThumbnailService.TryGetThumbnailOutputPath(userId, file.PublicId, out var newName, out _))
            {
                file.ThumbnailName = newName;
                _db.SaveChanges();
            }
        }

        if (string.IsNullOrWhiteSpace(file.ThumbnailName) ||
            !_treeDThumbnailService.TryBuildThumbnailPath(file, out var thumbPath) ||
            !System.IO.File.Exists(thumbPath))
        {
            if (_treeDThumbnailService.IsModelFile(file.Filename) && TryBuildFilePath(file, out var fullPath))
            {
                _ = _treeDThumbnailService.EnsureThumbnailInBackground(fullPath, file, userId);
            }
            using var fallback = _treeDThumbnailService.RenderFallbackThumbnail();
            using var stream = new MemoryStream();
            fallback.Save(stream, new PngEncoder());
            stream.Position = 0;
            return File(stream.ToArray(), "image/png");
        }

        var outputStream = System.IO.File.OpenRead(thumbPath);
        var contentType = Path.GetExtension(thumbPath).Equals(".jpg", StringComparison.OrdinalIgnoreCase) ||
                          Path.GetExtension(thumbPath).Equals(".jpeg", StringComparison.OrdinalIgnoreCase)
            ? "image/jpeg"
            : "image/png";
        return File(outputStream, contentType);
    }

    [HttpGet("view/{publicId}")]
    public IActionResult ViewFile(string publicId)
    {
        var userId = GetUserId();
        var file = _db.Files.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId && f.DeletedAt == null);
        if (file == null)
        {
            return NotFound();
        }

        if (!TryBuildFilePath(file, out var fullPath))
        {
            return BadRequest("Invalid storage path.");
        }
        if (!System.IO.File.Exists(fullPath))
        {
            return NotFound();
        }

        var stream = System.IO.File.OpenRead(fullPath);
        return File(stream, file.FileType, enableRangeProcessing: true);
    }

    [HttpGet("download/{publicId}")]
    public IActionResult DownloadFile(string publicId)
    {
        var userId = GetUserId();
        var file = _db.Files.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId && f.DeletedAt == null);
        if (file == null)
        {
            return NotFound();
        }

        if (!TryBuildFilePath(file, out var fullPath))
        {
            return BadRequest("Invalid storage path.");
        }
        if (!System.IO.File.Exists(fullPath))
        {
            return NotFound();
        }

        var stream = System.IO.File.OpenRead(fullPath);
        return File(stream, file.FileType, file.Filename);
    }

    [HttpGet("usage")]
    public IActionResult GetStorageUsage()
    {
        var userId = GetUserId();
        var totalBytes = _db.Files
            .Where(f => f.UserId == userId && f.DeletedAt == null)
            .Select(f => (long?)f.Size)
            .Sum() ?? 0;
        return Ok(new StorageUsageDto(totalBytes));
    }

    [HttpPut("{publicId}")]
    public IActionResult RenameFile(string publicId, [FromBody] RenameFileRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("File name is required.");
        }

        var userId = GetUserId();
        var file = _db.Files.FirstOrDefault(f =>
            f.PublicId == publicId && f.UserId == userId && f.DeletedAt == null);
        if (file == null)
        {
            return NotFound();
        }

        file.Filename = request.Name.Trim();
        _db.SaveChanges();
        LogActivity(userId, "rename-file", "success", $"Renamed {file.PublicId}");

        return Ok(new FileDetailDto(
            file.PublicId,
            file.Filename,
            file.FileType,
            file.Size,
            file.UploadedAt,
            file.ThumbnailName));
    }

    [HttpDelete("{publicId}")]
    public IActionResult DeleteFile(string publicId)
    {
        var userId = GetUserId();
        var file = _db.Files.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId && f.DeletedAt == null);
        if (file == null)
        {
            return NotFound();
        }
        if (_treeDThumbnailService.TryMoveThumbnailToTrash(file, userId, out var nextThumbnailName))
        {
            file.ThumbnailName = nextThumbnailName;
        }
        file.DeletedAt = DateTime.UtcNow;
        _db.SaveChanges();
        LogActivity(userId, "delete-file", "success", $"Deleted {file.Filename}");

        return NoContent();
    }

    private int GetUserId()
    {
        var idValue = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(idValue, out var id) ? id : 0;
    }

    private string GetStorageRoot()
    {
        var storageRoot = _configuration["Storage:RootPath"] ?? "storage";
        var basePath = Path.Combine(_environment.ContentRootPath, storageRoot);
        return Path.GetFullPath(basePath);
    }

    private bool TryBuildStoragePath(int userId, int? folderId, out string storagePath)
    {
        var root = GetStorageRoot();
        var folderSegment = folderId.HasValue ? $"folder_{folderId}" : "folder_root";
        storagePath = Path.GetFullPath(Path.Combine(root, $"user_{userId}", folderSegment));
        return IsWithinRoot(storagePath, root);
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

public record FileDetailDto(
    string PublicId,
    string Filename,
    string FileType,
    long Size,
    DateTime UploadedAt,
    string? ThumbnailName);
public record StorageUsageDto(long TotalBytes);
public record RenameFileRequest(string Name);

[ApiController]
[Route("api/trash")]
[Authorize]
public class TrashController(AppDbContext db, IConfiguration configuration, IWebHostEnvironment environment, TreeDThumbnailService treeDThumbnailService) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly IConfiguration _configuration = configuration;
    private readonly IWebHostEnvironment _environment = environment;
    private readonly TreeDThumbnailService _treeDThumbnailService = treeDThumbnailService;

    [HttpGet]
    public IActionResult GetTrash()
    {
        var userId = GetUserId();
        var folders = _db.Folders
            .Where(f => f.UserId == userId && f.DeletedAt != null)
            .OrderByDescending(f => f.DeletedAt)
            .Select(f => new TrashFolderDto(
                f.PublicId,
                f.Name,
                f.ParentId.HasValue
                    ? _db.Folders.Where(p => p.Id == f.ParentId.Value).Select(p => p.PublicId).FirstOrDefault()
                    : null,
                f.CreatedAt,
                f.DeletedAt!.Value
            ))
            .ToList();

        var files = _db.Files
            .Where(f => f.UserId == userId && f.DeletedAt != null)
            .OrderByDescending(f => f.DeletedAt)
            .Select(f => new TrashFileDto(
                f.PublicId,
                f.Filename,
                f.FileType,
                f.Size,
                f.UploadedAt,
                f.FolderId.HasValue
                    ? _db.Folders.Where(p => p.Id == f.FolderId.Value).Select(p => p.PublicId).FirstOrDefault()
                    : null,
                f.DeletedAt!.Value
            ))
            .ToList();

        return Ok(new TrashListing(folders, files));
    }

    [HttpPost("restore/file/{publicId}")]
    public IActionResult RestoreFile(string publicId)
    {
        var userId = GetUserId();
        var file = _db.Files.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId && f.DeletedAt != null);
        if (file == null)
        {
            return NotFound();
        }

        if (file.FolderId.HasValue)
        {
            var folder = _db.Folders.FirstOrDefault(f => f.Id == file.FolderId.Value && f.UserId == userId && f.DeletedAt == null);
            if (folder == null)
            {
                file.FolderId = null;
            }
        }

        file.DeletedAt = null;
        if (_treeDThumbnailService.TryRestoreThumbnailFromTrash(file, userId, out var nextThumbnailName))
        {
            file.ThumbnailName = nextThumbnailName;
        }
        _db.SaveChanges();
        return Ok(new FileDto(
            file.PublicId,
            file.Filename,
            file.FileType,
            file.Size,
            file.UploadedAt,
            file.ThumbnailName));
    }

    [HttpPost("restore/folder/{publicId}")]
    public IActionResult RestoreFolder(string publicId)
    {
        var userId = GetUserId();
        var folder = _db.Folders.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId && f.DeletedAt != null);
        if (folder == null)
        {
            return NotFound();
        }

        if (folder.ParentId.HasValue)
        {
            var parent = _db.Folders.FirstOrDefault(f => f.Id == folder.ParentId.Value && f.UserId == userId && f.DeletedAt == null);
            if (parent == null)
            {
                folder.ParentId = null;
            }
        }

        RestoreFolderTree(folder, userId);
        _db.SaveChanges();

        var parentPublicId = folder.ParentId.HasValue
            ? _db.Folders.Where(f => f.Id == folder.ParentId.Value).Select(f => f.PublicId).FirstOrDefault()
            : null;

        return Ok(new FolderDto(folder.PublicId, folder.Name, parentPublicId, folder.CreatedAt));
    }

    [HttpDelete("file/{publicId}")]
    public IActionResult DeleteFilePermanently(string publicId)
    {
        var userId = GetUserId();
        var file = _db.Files.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId && f.DeletedAt != null);
        if (file == null)
        {
            return NotFound();
        }

        if (!TryBuildFilePath(file, out var fullPath))
        {
            return BadRequest("Invalid storage path.");
        }
        if (System.IO.File.Exists(fullPath))
        {
            System.IO.File.Delete(fullPath);
        }
        if (!string.IsNullOrWhiteSpace(file.ThumbnailName) &&
            _treeDThumbnailService.TryBuildThumbnailPath(file, out var thumbPath))
        {
            if (System.IO.File.Exists(thumbPath))
            {
                System.IO.File.Delete(thumbPath);
            }
        }

        _db.Files.Remove(file);
        _db.SaveChanges();
        return NoContent();
    }

    [HttpDelete("folder/{publicId}")]
    public IActionResult DeleteFolderPermanently(string publicId)
    {
        var userId = GetUserId();
        var folder = _db.Folders.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId && f.DeletedAt != null);
        if (folder == null)
        {
            return NotFound();
        }

        try
        {
            DeleteFolderTree(folder, userId);
        }
        catch (InvalidOperationException)
        {
            return BadRequest("Invalid storage path.");
        }

        _db.SaveChanges();
        return NoContent();
    }

    [HttpDelete("clean")]
    public IActionResult CleanTrash()
    {
        var userId = GetUserId();
        var deletedFolders = _db.Folders
            .Where(f => f.UserId == userId && f.DeletedAt != null)
            .ToList();
        var deletedFolderIds = deletedFolders.Select(f => f.Id).ToHashSet();
        var rootFolders = deletedFolders
            .Where(f => f.ParentId == null || !deletedFolderIds.Contains(f.ParentId.Value))
            .ToList();

        try
        {
            foreach (var folder in rootFolders)
            {
                DeleteFolderTree(folder, userId);
            }
        }
        catch (InvalidOperationException)
        {
            return BadRequest("Invalid storage path.");
        }

        var filesToDelete = _db.Files
            .Where(f => f.UserId == userId && f.DeletedAt != null)
            .Where(f => f.FolderId == null || !deletedFolderIds.Contains(f.FolderId.Value))
            .ToList();
        foreach (var file in filesToDelete)
        {
            if (!TryBuildFilePath(file, out var fullPath))
            {
                return BadRequest("Invalid storage path.");
            }
            if (System.IO.File.Exists(fullPath))
            {
                System.IO.File.Delete(fullPath);
            }
            if (!string.IsNullOrWhiteSpace(file.ThumbnailName) &&
                _treeDThumbnailService.TryBuildThumbnailPath(file, out var thumbPath))
            {
                if (System.IO.File.Exists(thumbPath))
                {
                    System.IO.File.Delete(thumbPath);
                }
            }
        }
        _db.Files.RemoveRange(filesToDelete);
        _db.SaveChanges();
        LogActivity(userId, "clean-trash", "success", $"Cleaned {deletedFolders.Count} folders and {filesToDelete.Count} files");
        return Ok(new { cleanedAt = DateTime.UtcNow, removedFolders = deletedFolders.Count, removedFiles = filesToDelete.Count });
    }

    [Authorize(Policy = "AdminOnly")]
    [HttpPost("clean")]
    public IActionResult CleanTrash([FromQuery] int? days)
    {
        var retentionDays = days ?? 30;
        if (retentionDays <= 0)
        {
            return BadRequest("Retention days must be greater than 0.");
        }
        var cutoff = DateTime.UtcNow.AddDays(-retentionDays);
        CleanupTrash(cutoff);
        _db.SaveChanges();
        return Ok(new { cleanedAt = DateTime.UtcNow });
    }

    private void RestoreFolderTree(DriveFolder folder, int userId)
    {
        folder.DeletedAt = null;
        var files = _db.Files.Where(f => f.UserId == userId && f.FolderId == folder.Id && f.DeletedAt != null).ToList();
        foreach (var file in files)
        {
            file.DeletedAt = null;
            if (_treeDThumbnailService.TryRestoreThumbnailFromTrash(file, userId, out var nextThumbnailName))
            {
                file.ThumbnailName = nextThumbnailName;
            }
        }

        var children = _db.Folders.Where(f => f.UserId == userId && f.ParentId == folder.Id && f.DeletedAt != null).ToList();
        foreach (var child in children)
        {
            RestoreFolderTree(child, userId);
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
            if (!string.IsNullOrWhiteSpace(file.ThumbnailName) &&
                _treeDThumbnailService.TryBuildThumbnailPath(file, out var thumbPath))
            {
                if (System.IO.File.Exists(thumbPath))
                {
                    System.IO.File.Delete(thumbPath);
                }
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

    private void CleanupTrash(DateTime cutoff)
    {
        var foldersToDelete = _db.Folders
            .Where(f => f.DeletedAt != null && f.DeletedAt < cutoff)
            .Where(f => f.ParentId == null || _db.Folders.Any(p => p.Id == f.ParentId && p.DeletedAt == null))
            .ToList();
        foreach (var folder in foldersToDelete)
        {
            DeleteFolderTree(folder, folder.UserId);
        }

        var filesToDelete = _db.Files
            .Where(f => f.DeletedAt != null && f.DeletedAt < cutoff)
            .Where(f => f.FolderId == null || _db.Folders.Any(p => p.Id == f.FolderId && p.DeletedAt == null))
            .ToList();
        foreach (var file in filesToDelete)
        {
            if (!TryBuildFilePath(file, out var fullPath))
            {
                continue;
            }
            if (System.IO.File.Exists(fullPath))
            {
                System.IO.File.Delete(fullPath);
            }
            if (!string.IsNullOrWhiteSpace(file.ThumbnailName) &&
                _treeDThumbnailService.TryBuildThumbnailPath(file, out var thumbPath))
            {
                if (System.IO.File.Exists(thumbPath))
                {
                    System.IO.File.Delete(thumbPath);
                }
            }
        }
        _db.Files.RemoveRange(filesToDelete);
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

    private int GetUserId()
    {
        var idValue = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(idValue, out var id) ? id : 0;
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
}

public record TrashFileDto(
    string PublicId,
    string Filename,
    string FileType,
    long Size,
    DateTime UploadedAt,
    string? FolderPublicId,
    DateTime DeletedAt
);

public record TrashFolderDto(
    string PublicId,
    string Name,
    string? ParentPublicId,
    DateTime CreatedAt,
    DateTime DeletedAt
);

public record TrashListing(List<TrashFolderDto> Folders, List<TrashFileDto> Files);
