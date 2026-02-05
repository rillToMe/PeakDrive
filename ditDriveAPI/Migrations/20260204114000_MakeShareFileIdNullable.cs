using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ditDriveAPI.Data;

#nullable disable

namespace ditDriveAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260204114000_MakeShareFileIdNullable")]
    public partial class MakeShareFileIdNullable : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'Shares'
          AND column_name = 'FileId'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "Shares" ALTER COLUMN "FileId" DROP NOT NULL;
    END IF;
END
$$;
""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'Shares'
          AND column_name = 'FileId'
          AND is_nullable = 'YES'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM "Shares"
        WHERE "FileId" IS NULL
    ) THEN
        ALTER TABLE "Shares" ALTER COLUMN "FileId" SET NOT NULL;
    END IF;
END
$$;
""");
        }
    }
}
