using System.Numerics;

namespace ditDriveAPI.Services.TreeD;

public sealed class ModelNormalizer
{
    public NormalizationResult NormalizeToOrigin(ModelScene scene, Vector3 center)
    {
        var offset = -center;
        scene.NormalizationOffset = offset;
        return new NormalizationResult(Vector3.Zero, offset);
    }
}

public sealed record NormalizationResult(Vector3 Target, Vector3 Offset);
