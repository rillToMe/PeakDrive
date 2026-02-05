using Microsoft.EntityFrameworkCore;

namespace ditDriveAPI.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<DriveFolder> Folders => Set<DriveFolder>();
    public DbSet<DriveFile> Files => Set<DriveFile>();
    public DbSet<ShareLink> Shares => Set<ShareLink>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasIndex(e => e.Email).IsUnique();
        });

        modelBuilder.Entity<DriveFolder>(entity =>
        {
            entity.ToTable("Folders");
            entity.HasIndex(e => e.PublicId).IsUnique();
            entity.HasOne(e => e.User)
                .WithMany(e => e.Folders)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Parent)
                .WithMany(e => e.Children)
                .HasForeignKey(e => e.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DriveFile>(entity =>
        {
            entity.ToTable("Files");
            entity.HasIndex(e => e.PublicId).IsUnique();
            entity.HasOne(e => e.User)
                .WithMany(e => e.Files)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Folder)
                .WithMany(e => e.Files)
                .HasForeignKey(e => e.FolderId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ShareLink>(entity =>
        {
            entity.ToTable("Shares");
            entity.HasIndex(e => e.Token).IsUnique();
            entity.HasOne(e => e.File)
                .WithMany(e => e.Shares)
                .HasForeignKey(e => e.FileId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Folder)
                .WithMany(e => e.Shares)
                .HasForeignKey(e => e.FolderId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}

public enum UserRole
{
    MasterAdmin = 0,
    Admin = 1,
    User = 2
}

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<DriveFolder> Folders { get; set; } = [];
    public ICollection<DriveFile> Files { get; set; } = [];
}

public class DriveFolder
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string PublicId { get; set; } = "";
    public string Name { get; set; } = "";
    public int? ParentId { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public DriveFolder? Parent { get; set; }
    public ICollection<DriveFolder> Children { get; set; } = [];
    public ICollection<DriveFile> Files { get; set; } = [];
    public ICollection<ShareLink> Shares { get; set; } = [];
}

public class DriveFile
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? FolderId { get; set; }
    public string PublicId { get; set; } = "";
    public string Filename { get; set; } = "";
    public string StoredName { get; set; } = "";
    public string FileType { get; set; } = "";
    public long Size { get; set; }
    public DateTime UploadedAt { get; set; }

    public User User { get; set; } = null!;
    public DriveFolder? Folder { get; set; }
    public ICollection<ShareLink> Shares { get; set; } = [];
}

public class ShareLink
{
    public int Id { get; set; }
    public int? FileId { get; set; }
    public int? FolderId { get; set; }
    public string Token { get; set; } = "";
    public DateTime CreatedAt { get; set; }

    public DriveFile? File { get; set; }
    public DriveFolder? Folder { get; set; }
}
