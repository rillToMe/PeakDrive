using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ditDriveAPI.Data;

#nullable disable

namespace ditDriveAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260210121000_AddDeletedAtToDriveEntities")]
    public partial class AddDeletedAtToDriveEntities : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'Folders' AND column_name = 'DeletedAt'
    ) THEN
        ALTER TABLE "Folders" ADD COLUMN "DeletedAt" timestamp with time zone;
    END IF;
END
$$;
""");

            migrationBuilder.Sql("""
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'Files' AND column_name = 'DeletedAt'
    ) THEN
        ALTER TABLE "Files" ADD COLUMN "DeletedAt" timestamp with time zone;
    END IF;
END
$$;
""");

            migrationBuilder.Sql("""
CREATE INDEX IF NOT EXISTS "IX_Folders_DeletedAt" ON "Folders" ("DeletedAt");
""");

            migrationBuilder.Sql("""
CREATE INDEX IF NOT EXISTS "IX_Files_DeletedAt" ON "Files" ("DeletedAt");
""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
DROP INDEX IF EXISTS "IX_Folders_DeletedAt";
""");

            migrationBuilder.Sql("""
DROP INDEX IF EXISTS "IX_Files_DeletedAt";
""");

            migrationBuilder.Sql("""
ALTER TABLE "Folders" DROP COLUMN IF EXISTS "DeletedAt";
""");

            migrationBuilder.Sql("""
ALTER TABLE "Files" DROP COLUMN IF EXISTS "DeletedAt";
""");
        }
    }
}
