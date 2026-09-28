using System.Numerics;

namespace ditDriveAPI.Services.TreeD;

public sealed class CameraSetup
{
    public CameraState Build(BoundingBoxResult bounds, Vector3 target)
    {
        var fovDegrees = 45f;
        var fovRad = fovDegrees * MathF.PI / 180f;
        var distance = bounds.Radius / MathF.Tan(fovRad / 2f);
        distance *= 1.2f;

        var h = 45f * MathF.PI / 180f;
        var v = 30f * MathF.PI / 180f;

        var camX = target.X + distance * MathF.Cos(v) * MathF.Cos(h);
        var camY = target.Y + distance * MathF.Sin(v);
        var camZ = target.Z + distance * MathF.Cos(v) * MathF.Sin(h);

        var position = new Vector3(camX, camY, camZ);
        return new CameraState(position, target, fovRad, distance);
    }
}

public sealed record CameraState(Vector3 Position, Vector3 Target, float FovRadians, float Distance)
{
    public Vector3 Forward => Vector3.Normalize(Target - Position);
}
