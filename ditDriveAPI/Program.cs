using System.Text;
using System.Threading;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ditDriveAPI.Data;
using ditDriveAPI.Health;

static void LoadDotEnv(string filePath)
{
    if (!File.Exists(filePath))
    {
        return;
    }

    foreach (var line in File.ReadAllLines(filePath))
    {
        var trimmed = line.Trim();
        if (trimmed.Length == 0)
        {
            continue;
        }

        if (trimmed.StartsWith('#'))
        {
            continue;
        }

        var separatorIndex = trimmed.IndexOf('=');
        if (separatorIndex <= 0)
        {
            continue;
        }

        var key = trimmed[..separatorIndex].Trim();
        var value = trimmed[(separatorIndex + 1)..].Trim();
        if (value.Length >= 2 && value.StartsWith('"') && value.EndsWith('"'))
        {
            value = value[1..^1];
        }

        Environment.SetEnvironmentVariable(key, value);
    }
}

static async Task RunTrashCleanup(IServiceProvider services, ILogger logger, string storageRoot, int retentionDays)
{
    try
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cutoff = DateTime.UtcNow.AddDays(-retentionDays);

        var foldersToDelete = db.Folders
            .Where(f => f.DeletedAt != null && f.DeletedAt < cutoff)
            .Where(f => f.ParentId == null || db.Folders.Any(p => p.Id == f.ParentId && p.DeletedAt == null))
            .ToList();
        foreach (var folder in foldersToDelete)
        {
            DeleteFolderTree(db, folder, storageRoot);
        }

        var filesToDelete = db.Files
            .Where(f => f.DeletedAt != null && f.DeletedAt < cutoff)
            .Where(f => f.FolderId == null || db.Folders.Any(p => p.Id == f.FolderId && p.DeletedAt == null))
            .ToList();
        foreach (var file in filesToDelete)
        {
            if (!TryBuildFilePath(file, storageRoot, out var fullPath))
            {
                continue;
            }
            if (System.IO.File.Exists(fullPath))
            {
                System.IO.File.Delete(fullPath);
            }
        }
        db.Files.RemoveRange(filesToDelete);
        await db.SaveChangesAsync();
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Trash cleanup failed.");
    }
}

static void DeleteFolderTree(AppDbContext db, DriveFolder folder, string storageRoot)
{
    var files = db.Files.Where(f => f.UserId == folder.UserId && f.FolderId == folder.Id).ToList();
    foreach (var file in files)
    {
        if (!TryBuildFilePath(file, storageRoot, out var fullPath))
        {
            throw new InvalidOperationException("Invalid storage path.");
        }
        if (System.IO.File.Exists(fullPath))
        {
            System.IO.File.Delete(fullPath);
        }
    }
    db.Files.RemoveRange(files);

    var children = db.Folders.Where(f => f.UserId == folder.UserId && f.ParentId == folder.Id).ToList();
    foreach (var child in children)
    {
        DeleteFolderTree(db, child, storageRoot);
    }

    db.Folders.Remove(folder);
}

static bool TryBuildFilePath(DriveFile file, string storageRoot, out string fullPath)
{
    var root = storageRoot.EndsWith(Path.DirectorySeparatorChar) || storageRoot.EndsWith(Path.AltDirectorySeparatorChar)
        ? storageRoot
        : storageRoot + Path.DirectorySeparatorChar;
    var folderSegment = file.FolderId.HasValue ? $"folder_{file.FolderId}" : "folder_root";
    fullPath = Path.GetFullPath(Path.Combine(root, $"user_{file.UserId}", folderSegment, file.StoredName));
    return fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase);
}

LoadDotEnv(Path.Combine(Directory.GetCurrentDirectory(), ".env"));

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
);

builder.Services.AddControllers();
builder.Services.AddScoped<HealthService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

int? httpsPort = builder.Configuration.GetValue<int?>("Https:Port");
if (!httpsPort.HasValue)
{
    var httpsPortEnv = builder.Configuration["ASPNETCORE_HTTPS_PORT"];
    if (int.TryParse(httpsPortEnv, out var parsedHttpsPort))
    {
        httpsPort = parsedHttpsPort;
    }
}

if (httpsPort.HasValue)
{
    builder.Services.AddHttpsRedirection(options =>
    {
        options.HttpsPort = httpsPort.Value;
    });
}

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 5L * 1024 * 1024 * 1024;
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 5L * 1024 * 1024 * 1024;
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartHeadersLengthLimit = int.MaxValue;
});

var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "PeakDrive";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "PeakDriveUsers";
if (string.IsNullOrWhiteSpace(jwtKey))
{
    throw new InvalidOperationException("JWT key is missing. Set Jwt:Key in configuration or environment variables.");
}

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateIssuerSigningKey = true,
        ValidateLifetime = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
});

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", policy => policy.RequireRole(UserRole.Admin.ToString(), UserRole.MasterAdmin.ToString()))
    .AddPolicy("MasterAdminOnly", policy => policy.RequireRole(UserRole.MasterAdmin.ToString()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    if (!db.Users.Any())
    {
        var seedEmail = builder.Configuration["Seed:MasterEmail"];
        var seedPassword = builder.Configuration["Seed:MasterPassword"];
        if (!string.IsNullOrWhiteSpace(seedEmail) && !string.IsNullOrWhiteSpace(seedPassword))
        {
            var hasher = new PasswordHasher<User>();
            var master = new User
            {
                Email = seedEmail,
                Role = UserRole.MasterAdmin,
                CreatedAt = DateTime.UtcNow
            };
            master.PasswordHash = hasher.HashPassword(master, seedPassword);
            db.Users.Add(master);
            db.SaveChanges();
        }
        else
        {
            app.Logger.LogWarning("MasterAdmin seed skipped: Seed:MasterEmail or Seed:MasterPassword not set.");
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

var storageRoot = builder.Configuration["Storage:RootPath"] ?? "storage";
var storageFullPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, storageRoot));
Directory.CreateDirectory(storageFullPath);

var retentionDays = builder.Configuration.GetValue<int?>("Trash:RetentionDays") ?? 30;
if (retentionDays > 0)
{
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        _ = Task.Run(async () =>
        {
            await RunTrashCleanup(app.Services, app.Logger, storageFullPath, retentionDays);
            using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
            while (await timer.WaitForNextTickAsync())
            {
                await RunTrashCleanup(app.Services, app.Logger, storageFullPath, retentionDays);
            }
        });
    });
}

if (httpsPort.HasValue)
{
    app.UseHttpsRedirection();
}
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
