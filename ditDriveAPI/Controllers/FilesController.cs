using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ditDriveAPI.Data;

namespace ditDriveAPI.Controllers;

[ApiController]
[Route("api/files")]
[Authorize]
public class FilesController(AppDbContext db, IConfiguration configuration, IWebHostEnvironment environment) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly IConfiguration _configuration = configuration;
    private readonly IWebHostEnvironment _environment = environment;

    [HttpPost("upload")]
    [RequestSizeLimit(long.MaxValue)]
    public async Task<IActionResult> Upload([FromQuery] string? folderPublicId, [FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("File is required.");
        }

        var userId = GetUserId();
        int? folderId = null;
        if (!string.IsNullOrWhiteSpace(folderPublicId))
        {
            var folder = _db.Folders.FirstOrDefault(f => f.PublicId == folderPublicId && f.UserId == userId);
            if (folder == null)
            {
                return NotFound("Folder not found.");
            }
            folderId = folder.Id;
        }

        var storedName = $"{Guid.NewGuid():N}{Path.GetExtension(file.FileName)}";
        if (!TryBuildStoragePath(userId, folderId, out var storagePath))
        {
            return BadRequest("Invalid storage path.");
        }
        Directory.CreateDirectory(storagePath);

        var fullPath = Path.GetFullPath(Path.Combine(storagePath, storedName));
        if (!IsWithinRoot(fullPath, GetStorageRoot()))
        {
            return BadRequest("Invalid storage path.");
        }
        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
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
            UploadedAt = DateTime.UtcNow
        };

        _db.Files.Add(driveFile);
        _db.SaveChanges();

        return Ok(new FileDetailDto(driveFile.PublicId, driveFile.Filename, driveFile.FileType, driveFile.Size, driveFile.UploadedAt));
    }

    [HttpGet("view/{publicId}")]
    public IActionResult ViewFile(string publicId)
    {
        var userId = GetUserId();
        var file = _db.Files.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId);
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
        var file = _db.Files.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId);
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

    [HttpDelete("{publicId}")]
    public IActionResult DeleteFile(string publicId)
    {
        var userId = GetUserId();
        var file = _db.Files.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId);
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

        _db.Files.Remove(file);
        _db.SaveChanges();

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
}

public record FileDetailDto(string PublicId, string Filename, string FileType, long Size, DateTime UploadedAt);
