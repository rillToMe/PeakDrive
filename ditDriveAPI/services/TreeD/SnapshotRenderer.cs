using System.Numerics;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace ditDriveAPI.Services.TreeD;

public interface ITreeDRenderer
{
    Image<Rgba32> Render(ModelScene scene, CameraState camera, LightRig lights, int width, int height, Rgba32 background);
    Image<Rgba32> RenderFallback(int width, int height, Rgba32 background);
}

public sealed class SnapshotRenderer : ITreeDRenderer
{
    public Image<Rgba32> Render(ModelScene scene, CameraState camera, LightRig lights, int width, int height, Rgba32 background)
    {
        var image = new Image<Rgba32>(width, height, background);
        var depthBuffer = new float[width * height];
        Array.Fill(depthBuffer, float.MaxValue);

        var view = Matrix4x4.CreateLookAt(camera.Position, camera.Target, Vector3.UnitY);
        var proj = Matrix4x4.CreatePerspectiveFieldOfView(camera.FovRadians, width / (float)height, 0.1f, MathF.Max(camera.Distance * 4f, 10f));
        var viewProj = Matrix4x4.Multiply(view, proj);

        foreach (var mesh in scene.Meshes)
        {
            var material = scene.Materials.ElementAtOrDefault(mesh.MaterialIndex) ?? new MaterialData(new Vector3(0.7f, 0.7f, 0.7f), null, null, 0f, 1f, Vector3.Zero);
            var useTexture = material.AlbedoTexture != null && mesh.HasUv0;
            var hasNormals = mesh.Normals.Length == mesh.Vertices.Length;
            Matrix4x4.Invert(mesh.Transform, out var inverseTransform);
            var normalTransform = Matrix4x4.Transpose(inverseTransform);

            for (var i = 0; i < mesh.Indices.Length; i += 3)
            {
                if (i + 2 >= mesh.Indices.Length)
                {
                    break;
                }

                var i0 = mesh.Indices[i];
                var i1 = mesh.Indices[i + 1];
                var i2 = mesh.Indices[i + 2];

                if (i0 < 0 || i1 < 0 || i2 < 0 ||
                    i0 >= mesh.Vertices.Length || i1 >= mesh.Vertices.Length || i2 >= mesh.Vertices.Length)
                {
                    continue;
                }

                var w0 = Vector3.Transform(mesh.Vertices[i0], mesh.Transform) + scene.NormalizationOffset;
                var w1 = Vector3.Transform(mesh.Vertices[i1], mesh.Transform) + scene.NormalizationOffset;
                var w2 = Vector3.Transform(mesh.Vertices[i2], mesh.Transform) + scene.NormalizationOffset;

                var n = Vector3.Normalize(Vector3.Cross(w1 - w0, w2 - w0));
                if (float.IsNaN(n.X) || float.IsNaN(n.Y) || float.IsNaN(n.Z))
                {
                    continue;
                }

                var c0 = Project(w0, viewProj, width, height);
                var c1 = Project(w1, viewProj, width, height);
                var c2 = Project(w2, viewProj, width, height);
                if (!c0.Valid || !c1.Valid || !c2.Valid)
                {
                    continue;
                }

                var minX = (int)MathF.Max(0, MathF.Min(c0.X, MathF.Min(c1.X, c2.X)));
                var maxX = (int)MathF.Min(width - 1, MathF.Max(c0.X, MathF.Max(c1.X, c2.X)));
                var minY = (int)MathF.Max(0, MathF.Min(c0.Y, MathF.Min(c1.Y, c2.Y)));
                var maxY = (int)MathF.Min(height - 1, MathF.Max(c0.Y, MathF.Max(c1.Y, c2.Y)));

                var area = Edge(c0, c1, c2);
                if (MathF.Abs(area) < 1e-6f)
                {
                    continue;
                }

                for (var y = minY; y <= maxY; y++)
                {
                    for (var x = minX; x <= maxX; x++)
                    {
                        var p = new Vector2(x + 0.5f, y + 0.5f);
                        var wA = Edge(c1, c2, p);
                        var wB = Edge(c2, c0, p);
                        var wC = Edge(c0, c1, p);
                        if (area > 0)
                        {
                            if (wA < 0 || wB < 0 || wC < 0)
                            {
                                continue;
                            }
                        }
                        else
                        {
                            if (wA > 0 || wB > 0 || wC > 0)
                            {
                                continue;
                            }
                        }

                        var u = wA / area;
                        var v = wB / area;
                        var w = wC / area;

                        var depth = c0.Z * u + c1.Z * v + c2.Z * w;
                        var index = y * width + x;
                        if (depth >= depthBuffer[index])
                        {
                            continue;
                        }
                        depthBuffer[index] = depth;

                        var baseColor = ToLinear(material.AlbedoColor);
                        if (useTexture && material.AlbedoTexture != null)
                        {
                            var uv0 = mesh.UVs[i0];
                            var uv1 = mesh.UVs[i1];
                            var uv2 = mesh.UVs[i2];
                            var uv = uv0 * u + uv1 * v + uv2 * w;
                            baseColor *= SampleTexture(material.AlbedoTexture, uv);
                        }

                        var shadingNormal = n;
                        if (hasNormals)
                        {
                            var n0 = Vector3.Normalize(Vector3.TransformNormal(mesh.Normals[i0], normalTransform));
                            var n1 = Vector3.Normalize(Vector3.TransformNormal(mesh.Normals[i1], normalTransform));
                            var n2 = Vector3.Normalize(Vector3.TransformNormal(mesh.Normals[i2], normalTransform));
                            shadingNormal = Vector3.Normalize(n0 * u + n1 * v + n2 * w);
                            if (float.IsNaN(shadingNormal.X) || float.IsNaN(shadingNormal.Y) || float.IsNaN(shadingNormal.Z))
                            {
                                shadingNormal = n;
                            }
                        }

                        var light = ComputeLighting(shadingNormal, lights);
                        var emissive = ToLinear(material.Emissive);
                        var final = ClampColor(baseColor * light + emissive);
                        image[x, y] = ToColor(ToSrgb(final));
                    }
                }
            }
        }

        return image;
    }

    public Image<Rgba32> RenderFallback(int width, int height, Rgba32 background)
    {
        var mesh = BuildFallbackCube();
        var scene = new ModelScene([mesh], [new MaterialData(new Vector3(0.22f, 0.55f, 0.9f), null, null, 0f, 1f, Vector3.Zero)], new NodeData("root", Matrix4x4.Identity, Matrix4x4.Identity, [0], []), []);
        var bounds = new BoundingBoxUtil().Calculate(scene);
        var camera = new CameraSetup().Build(bounds, Vector3.Zero);
        var lights = new LightingSetup().Build(camera);
        scene.NormalizationOffset = -bounds.Center;
        var result = Render(scene, camera, lights, width, height, background);
        scene.Dispose();
        return result;
    }

    private static MeshData BuildFallbackCube()
    {
        var vertices = new[]
        {
            new Vector3(-0.5f, -0.5f, -0.5f),
            new Vector3(0.5f, -0.5f, -0.5f),
            new Vector3(0.5f, 0.5f, -0.5f),
            new Vector3(-0.5f, 0.5f, -0.5f),
            new Vector3(-0.5f, -0.5f, 0.5f),
            new Vector3(0.5f, -0.5f, 0.5f),
            new Vector3(0.5f, 0.5f, 0.5f),
            new Vector3(-0.5f, 0.5f, 0.5f)
        };

        var indices = new[]
        {
            0, 1, 2, 0, 2, 3,
            4, 6, 5, 4, 7, 6,
            0, 4, 5, 0, 5, 1,
            1, 5, 6, 1, 6, 2,
            2, 6, 7, 2, 7, 3,
            3, 7, 4, 3, 4, 0
        };

        var normals = Enumerable.Repeat(Vector3.UnitZ, vertices.Length).ToArray();
        var uvs = new Vector2[vertices.Length];
        return new MeshData(vertices, normals, uvs, indices, 0, false);
    }

    private static ProjectedVertex Project(Vector3 world, Matrix4x4 viewProj, int width, int height)
    {
        var clip = Vector4.Transform(new Vector4(world, 1f), viewProj);
        if (clip.W <= 0.0001f)
        {
            return new ProjectedVertex(false, 0, 0, 0);
        }
        var invW = 1f / clip.W;
        var ndc = new Vector3(clip.X * invW, clip.Y * invW, clip.Z * invW);
        var x = (ndc.X + 1f) * 0.5f * width;
        var y = (1f - ndc.Y) * 0.5f * height;
        return new ProjectedVertex(true, x, y, ndc.Z);
    }

    private static float Edge(ProjectedVertex a, ProjectedVertex b, ProjectedVertex c)
    {
        return (c.X - a.X) * (b.Y - a.Y) - (c.Y - a.Y) * (b.X - a.X);
    }

    private static float Edge(ProjectedVertex a, ProjectedVertex b, Vector2 c)
    {
        return (c.X - a.X) * (b.Y - a.Y) - (c.Y - a.Y) * (b.X - a.X);
    }

    private static Vector3 SampleTexture(Image<Rgba32> texture, Vector2 uv)
    {
        if (float.IsNaN(uv.X) || float.IsNaN(uv.Y) || float.IsInfinity(uv.X) || float.IsInfinity(uv.Y))
        {
            return Vector3.One;
        }
        var u = uv.X - MathF.Floor(uv.X);
        var v = uv.Y - MathF.Floor(uv.Y);
        u = Math.Clamp(u, 0f, 1f);
        v = Math.Clamp(v, 0f, 1f);
        var x = u * (texture.Width - 1);
        var y = (1f - v) * (texture.Height - 1);
        var x0 = (int)MathF.Floor(x);
        var y0 = (int)MathF.Floor(y);
        var x1 = Math.Clamp(x0 + 1, 0, texture.Width - 1);
        var y1 = Math.Clamp(y0 + 1, 0, texture.Height - 1);
        x0 = Math.Clamp(x0, 0, texture.Width - 1);
        y0 = Math.Clamp(y0, 0, texture.Height - 1);
        var tx = x - x0;
        var ty = y - y0;

        var c00 = ToLinear(texture[x0, y0]);
        var c10 = ToLinear(texture[x1, y0]);
        var c01 = ToLinear(texture[x0, y1]);
        var c11 = ToLinear(texture[x1, y1]);
        var c0 = Vector3.Lerp(c00, c10, tx);
        var c1 = Vector3.Lerp(c01, c11, tx);
        return Vector3.Lerp(c0, c1, ty);
    }

    private static float ComputeLighting(Vector3 normal, LightRig lights)
    {
        var n = Vector3.Normalize(normal);
        var ambient = 0.25f;
        var key = MathF.Max(0f, Vector3.Dot(n, lights.Key.Direction)) * lights.Key.Intensity;
        var fill = MathF.Max(0f, Vector3.Dot(n, lights.Fill.Direction)) * lights.Fill.Intensity;
        var back = MathF.Max(0f, Vector3.Dot(n, lights.Back.Direction)) * lights.Back.Intensity;
        return MathF.Min(1f, ambient + key + fill + back);
    }

    private static Vector3 ClampColor(Vector3 color)
    {
        return new Vector3(
            Math.Clamp(color.X, 0f, 1f),
            Math.Clamp(color.Y, 0f, 1f),
            Math.Clamp(color.Z, 0f, 1f));
    }

    private static Rgba32 ToColor(Vector3 color)
    {
        return new Rgba32((byte)(color.X * 255f), (byte)(color.Y * 255f), (byte)(color.Z * 255f), 255);
    }


    private static Vector3 ToLinear(Vector3 color)
    {
        return new Vector3(
            MathF.Pow(color.X, 2.2f),
            MathF.Pow(color.Y, 2.2f),
            MathF.Pow(color.Z, 2.2f));
    }

    private static Vector3 ToLinear(Rgba32 color)
    {
        return ToLinear(new Vector3(color.R / 255f, color.G / 255f, color.B / 255f));
    }

    private static Vector3 ToSrgb(Vector3 color)
    {
        return new Vector3(
            MathF.Pow(color.X, 1f / 2.2f),
            MathF.Pow(color.Y, 1f / 2.2f),
            MathF.Pow(color.Z, 1f / 2.2f));
    }

    private readonly record struct ProjectedVertex(bool Valid, float X, float Y, float Z);
}
