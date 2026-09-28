using System.Numerics;

namespace ditDriveAPI.Services.TreeD;

public sealed class BoundingBoxUtil
{
    public BoundingBoxResult Calculate(ModelScene scene)
    {
        if (scene.Meshes.Count == 0)
        {
            return new BoundingBoxResult(Vector3.Zero, Vector3.Zero, Vector3.Zero, Vector3.Zero, 0f);
        }

        var min = new Vector3(float.MaxValue, float.MaxValue, float.MaxValue);
        var max = new Vector3(float.MinValue, float.MinValue, float.MinValue);

        foreach (var mesh in scene.Meshes)
        {
            for (var i = 0; i < mesh.Vertices.Length; i++)
            {
                var world = Vector3.Transform(mesh.Vertices[i], mesh.Transform) + scene.NormalizationOffset;
                min = Vector3.Min(min, world);
                max = Vector3.Max(max, world);
            }
        }

        var size = max - min;
        var center = (min + max) / 2f;
        var radius = MathF.Sqrt(size.X * size.X + size.Y * size.Y + size.Z * size.Z) / 2f;

        return new BoundingBoxResult(min, max, size, center, radius);
    }
}

public sealed record BoundingBoxResult(Vector3 Min, Vector3 Max, Vector3 Size, Vector3 Center, float Radius);
