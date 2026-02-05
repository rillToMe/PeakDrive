using ditDriveAPI.Data;

namespace ditDriveAPI.Health;

public class HealthService(AppDbContext db, IConfiguration configuration, IWebHostEnvironment environment)
{
    private readonly AppDbContext _db = db;
    private readonly IConfiguration _configuration = configuration;
    private readonly IWebHostEnvironment _environment = environment;

    public HealthBasicResponse GetBasic()
    {
        return new HealthBasicResponse("ok", "ditDriveAPI", DateTime.UtcNow);
    }

    public async Task<HealthFullResponse> GetFullAsync()
    {
        var database = await HealthChecks.CheckDatabaseAsync(_db);
        var storageRoot = _configuration["Storage:RootPath"] ?? "storage";
        var storage = HealthChecks.CheckStorage(storageRoot, _environment.ContentRootPath);
        var api = true;
        var status = api && database.Connected && storage.Exists && storage.Writable ? "ok" : "fail";
        return new HealthFullResponse(status, api, database, storage);
    }
}
