using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ditDriveAPI.Migrations
{
    public partial class AddFolderIdToShares : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'Shares' AND column_name = 'FolderId'
    ) THEN
        ALTER TABLE "Shares" ADD COLUMN "FolderId" integer;
    END IF;
END
$$;
""");

            migrationBuilder.Sql("""
CREATE INDEX IF NOT EXISTS "IX_Shares_FolderId" ON "Shares" ("FolderId");
""");

            migrationBuilder.Sql("""
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'FK_Shares_Folders_FolderId'
    ) THEN
        ALTER TABLE "Shares"
            ADD CONSTRAINT "FK_Shares_Folders_FolderId"
            FOREIGN KEY ("FolderId")
            REFERENCES "Folders" ("Id")
            ON DELETE CASCADE;
    END IF;
END
$$;
""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
ALTER TABLE "Shares" DROP CONSTRAINT IF EXISTS "FK_Shares_Folders_FolderId";
""");

            migrationBuilder.Sql("""
DROP INDEX IF EXISTS "IX_Shares_FolderId";
""");

            migrationBuilder.Sql("""
ALTER TABLE "Shares" DROP COLUMN IF EXISTS "FolderId";
""");
        }
    }
}
