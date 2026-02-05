using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ditDriveAPI.Health;

[ApiController]
[Route("health")]
public class HealthController(HealthService healthService) : ControllerBase
{
    private readonly HealthService _healthService = healthService;

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Basic()
    {
        var response = _healthService.GetBasic();
        return Ok(response);
    }

    [HttpGet("full")]
    [AllowAnonymous]
    public async Task<IActionResult> Full()
    {
        var response = await _healthService.GetFullAsync();
        return Ok(response);
    }
}
