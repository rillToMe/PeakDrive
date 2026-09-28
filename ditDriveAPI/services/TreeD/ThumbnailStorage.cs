using ditDriveAPI.Data;

namespace ditDriveAPI.Services.TreeD;

public sealed class ThumbnailStorage
{
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;

    public ThumbnailStorage(IConfiguration configuration, IWebHostEnvironment environment)
    {
        _configuration = configuration;
        _environment = environment;
    }

    public bool TryBuildThumbnailPath(DriveFile file, out string fullPath)
    {
        fullPath = "";
        if (string.IsNullOrWhiteSpace(file.ThumbnailName))
        {
            return false;
        }

        var root = GetThumbnailRoot();
        fullPath = Path.GetFullPath(Path.Combine(root, file.ThumbnailName));
        return IsWithinRoot(fullPath, root);
    }

    public bool TryGetThumbnailOutputPath(int userId, string publicId, out string name, out string fullPath)
    {
        name = Path.Combine($"user_{userId}", $"{publicId}.png");
        var root = GetThumbnailRoot();
        fullPath = Path.GetFullPath(Path.Combine(root, name));
        return IsWithinRoot(fullPath, root);
    }

    public bool TryMoveToTrash(DriveFile file, int userId, out string nextName)
    {
        nextName = "";
        if (string.IsNullOrWhiteSpace(file.ThumbnailName))
        {
            return false;
        }

        var relative = file.ThumbnailName.Replace("\\", "/");
        var userPrefix = $"user_{userId}/";
        if (!relative.StartsWith(userPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }
        var fileName = Path.GetFileName(relative);
        nextName = Path.Combine($"user_{userId}", "trash", fileName);
        return true;
    }

    public bool TryRestoreFromTrash(DriveFile file, int userId, out string nextName)
    {
        nextName = "";
        if (string.IsNullOrWhiteSpace(file.ThumbnailName))
        {
            return false;
        }

        var relative = file.ThumbnailName.Replace("\\", "/");
        var trashPrefix = $"user_{userId}/trash/";
        if (!relative.StartsWith(trashPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }
        var fileName = Path.GetFileName(relative);
        nextName = Path.Combine($"user_{userId}", fileName);
        return true;
    }

    public void EnsureDirectory(string fullPath)
    {
        var directory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }
    }

    private string GetStorageRoot()
    {
        var storageRoot = _configuration["Storage:RootPath"] ?? "storage";
        var basePath = Path.Combine(_environment.ContentRootPath, storageRoot);
        return Path.GetFullPath(basePath);
    }

    private string GetThumbnailRoot()
    {
        return Path.Combine(GetStorageRoot(), "thumbnails");
    }

    private static bool IsWithinRoot(string fullPath, string root)
    {
        var rootPath = root.EndsWith(Path.DirectorySeparatorChar) || root.EndsWith(Path.AltDirectorySeparatorChar)
            ? root
            : root + Path.DirectorySeparatorChar;
        return fullPath.StartsWith(rootPath, StringComparison.OrdinalIgnoreCase);
    }
}
