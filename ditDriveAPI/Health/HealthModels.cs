namespace ditDriveAPI.Health;

public record HealthBasicResponse(string Status, string Service, DateTime Time);

public record HealthDatabaseStatus(bool Connected, string Provider, int LatencyMs);

public record HealthStorageStatus(bool Exists, bool Writable, string Path);

public record HealthFullResponse(
    string Status,
    bool Api,
    HealthDatabaseStatus Database,
    HealthStorageStatus Storage
);
