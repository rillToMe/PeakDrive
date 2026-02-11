using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ditDriveAPI.Data;

namespace ditDriveAPI.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "AdminOnly")]
public class AdminController(AppDbContext db) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly PasswordHasher<User> _hasher = new();

    [HttpPost("create-user")]
    public IActionResult CreateUser([FromBody] CreateUserRequest request)
    {
        return CreateAccount(request, UserRole.User);
    }

    [HttpPost("create-admin")]
    [Authorize(Policy = "MasterAdminOnly")]
    public IActionResult CreateAdmin([FromBody] CreateUserRequest request)
    {
        return CreateAccount(request, UserRole.Admin);
    }

    [HttpGet("list-users")]
    public IActionResult ListUsers()
    {
        var users = _db.Users
            .OrderBy(u => u.Id)
            .Select(u => new UserSummary(u.Id, u.Email, u.Role.ToString(), u.CreatedAt))
            .ToList();
        return Ok(users);
    }

    [HttpGet("activity-logs")]
    public IActionResult GetActivityLogs([FromQuery] int? take)
    {
        var limit = take.GetValueOrDefault(200);
        if (limit <= 0)
        {
            limit = 200;
        }
        if (limit > 1000)
        {
            limit = 1000;
        }

        var logs = _db.ActivityLogs
            .OrderByDescending(l => l.CreatedAt)
            .Take(limit)
            .Select(l => new ActivityLogDto(
                l.Id,
                l.UserId,
                _db.Users.Where(u => u.Id == l.UserId).Select(u => u.Email).FirstOrDefault(),
                l.Action,
                l.Status,
                l.Message,
                l.CreatedAt
            ))
            .ToList();

        return Ok(logs);
    }

    [HttpPost("reset-password")]
    public IActionResult ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (request.UserId <= 0 || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest("UserId and new password are required.");
        }

        var user = _db.Users.FirstOrDefault(u => u.Id == request.UserId);
        if (user == null)
        {
            return NotFound();
        }

        var currentRole = GetCurrentRole();
        if (user.Role == UserRole.Admin && currentRole != UserRole.MasterAdmin)
        {
            return Forbid();
        }

        if (user.Role == UserRole.MasterAdmin)
        {
            return Forbid();
        }

        user.PasswordHash = _hasher.HashPassword(user, request.NewPassword);
        _db.SaveChanges();

        return Ok();
    }

    [HttpDelete("delete-user/{id:int}")]
    public IActionResult DeleteUser(int id)
    {
        var user = _db.Users.FirstOrDefault(u => u.Id == id);
        if (user == null)
        {
            return NotFound();
        }

        var currentRole = GetCurrentRole();
        if (user.Role == UserRole.Admin && currentRole != UserRole.MasterAdmin)
        {
            return Forbid();
        }

        if (user.Role == UserRole.MasterAdmin)
        {
            return Forbid();
        }

        _db.Users.Remove(user);
        _db.SaveChanges();

        return Ok();
    }

    private IActionResult CreateAccount(CreateUserRequest request, UserRole role)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest("Email and password are required.");
        }

        var existing = _db.Users.Any(u => u.Email == request.Email);
        if (existing)
        {
            return Conflict("Email already exists.");
        }

        var user = new User
        {
            Email = request.Email,
            Role = role,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = _hasher.HashPassword(user, request.Password);

        _db.Users.Add(user);
        _db.SaveChanges();

        return Ok(new UserSummary(user.Id, user.Email, user.Role.ToString(), user.CreatedAt));
    }

    private UserRole GetCurrentRole()
    {
        var roleValue = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        return Enum.TryParse<UserRole>(roleValue, out var role) ? role : UserRole.User;
    }
}

public record CreateUserRequest(string Email, string Password);
public record UserSummary(int Id, string Email, string Role, DateTime CreatedAt);
public record ResetPasswordRequest(int UserId, string NewPassword);
public record ActivityLogDto(
    int Id,
    int? UserId,
    string? UserEmail,
    string Action,
    string Status,
    string Message,
    DateTime CreatedAt
);
