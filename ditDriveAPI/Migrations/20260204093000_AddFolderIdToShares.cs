using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ditDriveAPI.Migrations
{
    public partial class AddFolderIdToShares : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FolderId",
                table: "Shares",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Shares_FolderId",
                table: "Shares",
                column: "FolderId");

            migrationBuilder.AddForeignKey(
                name: "FK_Shares_Folders_FolderId",
                table: "Shares",
                column: "FolderId",
                principalTable: "Folders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Shares_Folders_FolderId",
                table: "Shares");

            migrationBuilder.DropIndex(
                name: "IX_Shares_FolderId",
                table: "Shares");

            migrationBuilder.DropColumn(
                name: "FolderId",
                table: "Shares");
        }
    }
}
