using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ditDriveAPI.Migrations
{
    public partial class AddPublicIdToDriveEntities : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PublicId",
                table: "Folders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PublicId",
                table: "Files",
                type: "text",
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE \"Folders\" SET \"PublicId\" = md5(random()::text || clock_timestamp()::text || \"Id\"::text) WHERE \"PublicId\" IS NULL OR \"PublicId\" = '';");
            migrationBuilder.Sql(
                "UPDATE \"Files\" SET \"PublicId\" = md5(random()::text || clock_timestamp()::text || \"Id\"::text) WHERE \"PublicId\" IS NULL OR \"PublicId\" = '';");

            migrationBuilder.AlterColumn<string>(
                name: "PublicId",
                table: "Folders",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "PublicId",
                table: "Files",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Folders_PublicId",
                table: "Folders",
                column: "PublicId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Files_PublicId",
                table: "Files",
                column: "PublicId",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Folders_PublicId",
                table: "Folders");

            migrationBuilder.DropIndex(
                name: "IX_Files_PublicId",
                table: "Files");

            migrationBuilder.DropColumn(
                name: "PublicId",
                table: "Folders");

            migrationBuilder.DropColumn(
                name: "PublicId",
                table: "Files");
        }
    }
}
