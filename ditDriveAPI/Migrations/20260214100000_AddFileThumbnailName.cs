using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ditDriveAPI.Migrations
{
    public partial class AddFileThumbnailName : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ThumbnailName",
                table: "Files",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ThumbnailName",
                table: "Files");
        }
    }
}
