using System.IO.Compression;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ditDriveAPI.Data;

namespace ditDriveAPI.Controllers;

[ApiController]
public class ShareController(AppDbContext db, IConfiguration configuration, IWebHostEnvironment environment) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly IConfiguration _configuration = configuration;
    private readonly IWebHostEnvironment _environment = environment;

    [Authorize]
    [HttpPost("api/share/{publicId}")]
    public IActionResult CreateShare(string publicId)
    {
        var userId = GetUserId();
        var file = _db.Files.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId);
        if (file == null)
        {
            return NotFound();
        }

        var token = Guid.NewGuid().ToString("N");
        var share = new ShareLink
        {
            FileId = file.Id,
            Token = token,
            CreatedAt = DateTime.UtcNow
        };

        _db.Shares.Add(share);
        _db.SaveChanges();

        return Ok(new { token, url = BuildShareUrl(token, "file") });
    }

    [Authorize]
    [HttpPost("api/share/folder/{publicId}")]
    public IActionResult CreateFolderShare(string publicId)
    {
        var userId = GetUserId();
        var folder = _db.Folders.FirstOrDefault(f => f.PublicId == publicId && f.UserId == userId);
        if (folder == null)
        {
            return NotFound();
        }

        var token = Guid.NewGuid().ToString("N");
        var share = new ShareLink
        {
            FolderId = folder.Id,
            Token = token,
            CreatedAt = DateTime.UtcNow
        };

        _db.Shares.Add(share);
        _db.SaveChanges();

        return Ok(new { token, url = BuildShareUrl(token, "folder") });
    }

    [AllowAnonymous]
    [HttpGet("/s/{token}")]
    [HttpGet("/s/file/{token}")]
    public IActionResult GetSharedFile(string token)
    {
        var share = _db.Shares.FirstOrDefault(s => s.Token == token);
        if (share == null || !share.FileId.HasValue)
        {
            return NotFound();
        }

        var file = _db.Files.FirstOrDefault(f => f.Id == share.FileId.Value);
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
        if (file.FileType.StartsWith("image/") || file.FileType.StartsWith("video/"))
        {
            return File(stream, file.FileType, enableRangeProcessing: true);
        }

        return File(stream, file.FileType, file.Filename);
    }

    [AllowAnonymous]
    [HttpGet("/s/folder/{token}")]
    public IActionResult GetSharedFolder(string token)
    {
        var share = _db.Shares.FirstOrDefault(s => s.Token == token);
        if (share == null || !share.FolderId.HasValue)
        {
            return NotFound();
        }

        var folder = _db.Folders.FirstOrDefault(f => f.Id == share.FolderId.Value);
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
                AddFolderToZip(archive, folder, folder.UserId, folder.Name);
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
            .Where(f => f.UserId == userId && f.ParentId == folder.Id)
            .OrderBy(f => f.Name)
            .ToList();

        foreach (var child in children)
        {
            AddFolderToZip(archive, child, userId, Path.Combine(currentPath, child.Name).Replace("\\", "/"));
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

    private string BuildShareUrl(string token, string kind)
    {
        var baseUrl = _configuration["Share:BaseUrl"] ?? "https://drive.aetherstudio.web.id";
        var normalized = baseUrl.TrimEnd('/');
        if (normalized.EndsWith("/s", StringComparison.OrdinalIgnoreCase))
        {
            return $"{normalized}/{kind}/{token}";
        }
        return $"{normalized}/s/{kind}/{token}";
    }
}
