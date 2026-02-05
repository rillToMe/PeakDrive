using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using ditDriveAPI.Data;

namespace ditDriveAPI.Health;

public static class HealthChecks
{
    public static async Task<HealthDatabaseStatus> CheckDatabaseAsync(AppDbContext db)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            await db.Database.ExecuteSqlRawAsync("SELECT 1");
            stopwatch.Stop();
            return new HealthDatabaseStatus(true, "Neon PostgreSQL", (int)stopwatch.ElapsedMilliseconds);
        }
        catch
        {
            return new HealthDatabaseStatus(false, "Neon PostgreSQL", -1);
        }
    }

    public static HealthStorageStatus CheckStorage(string storageRoot, string contentRootPath)
    {
        var relativePath = storageRoot.TrimEnd('/', '\\') + "/";
        var fullPath = Path.Combine(contentRootPath, storageRoot);
        var exists = Directory.Exists(fullPath);

        if (!exists)
        {
            try
            {
                Directory.CreateDirectory(fullPath);
                exists = Directory.Exists(fullPath);
            }
            catch
            {
                exists = false;
            }
        }

        var writable = false;
        if (exists)
        {
            try
            {
                var tempFile = Path.Combine(fullPath, $"health_{Guid.NewGuid():N}.tmp");
                File.WriteAllText(tempFile, "ok");
                File.Delete(tempFile);
                writable = true;
            }
            catch
            {
                writable = false;
            }
        }

        return new HealthStorageStatus(exists, writable, relativePath);
    }
}
