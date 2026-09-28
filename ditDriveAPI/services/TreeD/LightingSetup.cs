using System.Numerics;

namespace ditDriveAPI.Services.TreeD;

public sealed class LightingSetup
{
    public LightRig Build(CameraState camera)
    {
        var keyDirection = Vector3.Normalize(camera.Position - camera.Target);
        var fillDirection = Vector3.Normalize(-keyDirection);
        var backDirection = Vector3.Normalize(-keyDirection + Vector3.UnitY * 0.5f);

        var key = new LightSource(keyDirection, 1.0f);
        var fill = new LightSource(fillDirection, 0.5f);
        var back = new LightSource(backDirection, 0.25f);
        return new LightRig(key, fill, back);
    }
}

public sealed record LightSource(Vector3 Direction, float Intensity);
public sealed record LightRig(LightSource Key, LightSource Fill, LightSource Back);
