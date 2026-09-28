using Assimp;
using Microsoft.Extensions.Logging;
using Vector2 = System.Numerics.Vector2;
using Vector3 = System.Numerics.Vector3;
using Matrix4x4 = System.Numerics.Matrix4x4;
using Quaternion = System.Numerics.Quaternion;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace ditDriveAPI.Services.TreeD;

public sealed class ModelLoader
{
    private readonly ILogger _logger;

    public ModelLoader(ILogger<ModelLoader> logger)
    {
        _logger = logger;
    }

    public ModelScene Load(string modelPath)
    {
        var context = new AssimpContext();
        var scene = context.ImportFile(modelPath,
            PostProcessSteps.Triangulate |
            PostProcessSteps.GenerateNormals |
            PostProcessSteps.JoinIdenticalVertices |
            PostProcessSteps.ImproveCacheLocality |
            PostProcessSteps.FlipUVs);

        if (scene == null || scene.MeshCount == 0)
        {
            throw new InvalidOperationException("Model tidak memiliki mesh.");
        }

        var modelDirectory = Path.GetDirectoryName(modelPath) ?? "";
        var textureResolver = new TextureResolver(scene, modelDirectory, modelPath, _logger);
        var materialResolver = new MaterialResolver(textureResolver, _logger);
        var materials = scene.Materials.Select(materialResolver.Resolve).ToList();

        var meshes = new List<MeshData>();
        foreach (var mesh in scene.Meshes)
        {
            var vertices = mesh.Vertices.Select(v => new Vector3(v.X, v.Y, v.Z)).ToArray();
            var normals = mesh.HasNormals
                ? mesh.Normals.Select(n => new Vector3(n.X, n.Y, n.Z)).ToArray()
                : Enumerable.Repeat(Vector3.UnitY, vertices.Length).ToArray();
            var hasUv0 = mesh.HasTextureCoords(0);
            var uvs = hasUv0
                ? mesh.TextureCoordinateChannels[0].Select(t => new Vector2(t.X, t.Y)).ToArray()
                : new Vector2[vertices.Length];
            var indices = mesh.Faces.SelectMany(f => f.Indices).ToArray();

            meshes.Add(new MeshData(vertices, normals, uvs, indices, mesh.MaterialIndex, hasUv0));
        }

        WarnMissingUvs(meshes, materials);

        var rootNode = BuildNode(scene.RootNode);
        ApplyNodeTransforms(rootNode, Matrix4x4.Identity, meshes);

        var animations = new List<AnimationClip>();
        foreach (var animation in scene.Animations)
        {
            var channels = new Dictionary<string, NodeAnimationChannel>(StringComparer.OrdinalIgnoreCase);
            foreach (var channel in animation.NodeAnimationChannels)
            {
                var positionKeys = channel.PositionKeys
                    .Select(k => new VectorKey(k.Time, new Vector3(k.Value.X, k.Value.Y, k.Value.Z)))
                    .ToArray();
                var scaleKeys = channel.ScalingKeys
                    .Select(k => new VectorKey(k.Time, new Vector3(k.Value.X, k.Value.Y, k.Value.Z)))
                    .ToArray();
                var rotationKeys = channel.RotationKeys
                    .Select(k => new QuaternionKey(k.Time, new Quaternion(k.Value.X, k.Value.Y, k.Value.Z, k.Value.W)))
                    .ToArray();
                channels[channel.NodeName] = new NodeAnimationChannel(positionKeys, rotationKeys, scaleKeys);
            }
            animations.Add(new AnimationClip(animation.Name, animation.DurationInTicks, animation.TicksPerSecond, channels));
        }

        return new ModelScene(meshes, materials, rootNode, animations);
    }

    private static NodeData BuildNode(Node node)
    {
        var transform = ConvertMatrix(node.Transform);
        var meshIndices = node.MeshIndices?.ToArray() ?? Array.Empty<int>();
        var children = node.Children?.Select(BuildNode).ToList() ?? [];
        return new NodeData(node.Name, transform, transform, meshIndices, children);
    }

    private static void ApplyNodeTransforms(NodeData node, Matrix4x4 parentTransform, IReadOnlyList<MeshData> meshes)
    {
        var world = Matrix4x4.Multiply(node.LocalTransform, parentTransform);
        foreach (var index in node.MeshIndices)
        {
            if (index >= 0 && index < meshes.Count)
            {
                meshes[index].Transform = world;
            }
        }
        foreach (var child in node.Children)
        {
            ApplyNodeTransforms(child, world, meshes);
        }
    }

    private static Matrix4x4 ConvertMatrix(Assimp.Matrix4x4 matrix)
    {
        return new Matrix4x4(
            matrix.A1, matrix.B1, matrix.C1, matrix.D1,
            matrix.A2, matrix.B2, matrix.C2, matrix.D2,
            matrix.A3, matrix.B3, matrix.C3, matrix.D3,
            matrix.A4, matrix.B4, matrix.C4, matrix.D4);
    }

    private void WarnMissingUvs(IReadOnlyList<MeshData> meshes, IReadOnlyList<MaterialData> materials)
    {
        for (var i = 0; i < meshes.Count; i++)
        {
            var mesh = meshes[i];
            if (!mesh.HasUv0)
            {
                var material = materials.ElementAtOrDefault(mesh.MaterialIndex);
                if (material != null && material.AlbedoTexture != null)
                {
                    _logger.LogWarning("UV missing pada mesh index {MeshIndex} untuk material {MaterialIndex}", i, mesh.MaterialIndex);
                }
            }
        }
    }
}

public sealed class MaterialResolver
{
    private readonly TextureResolver _textures;
    private readonly ILogger _logger;

    public MaterialResolver(TextureResolver textures, ILogger logger)
    {
        _textures = textures;
        _logger = logger;
    }

    public MaterialData Resolve(Material material)
    {
        var albedoColor = ResolveAlbedoColor(material);
        var albedoTexture = ResolveAlbedoTexture(material, out var textureRequested, out var albedoSlotInfo);
        if (textureRequested && albedoTexture == null)
        {
            _logger.LogWarning("Texture albedo gagal di-resolve untuk material {MaterialName} slot {SlotInfo}", material.Name ?? "unknown", albedoSlotInfo ?? "unknown");
            albedoColor = GenerateVortexColor(material.Name);
        }
        if (IsColorEmpty(albedoColor))
        {
            albedoColor = GenerateVortexColor(material.Name);
        }

        var normalTexture = ResolveFirstTexture(material, new[] { "Normals", "NormalCamera" });
        var emissive = ResolveEmissive(material);
        var metallic = 0f;
        var roughness = 1f;

        _logger.LogInformation(
            "Material {MaterialName} albedoTexture {TextureStatus} slot {SlotInfo} albedoColor {AlbedoColor}",
            material.Name ?? "unknown",
            albedoTexture == null ? "null" : $"{albedoTexture.Width}x{albedoTexture.Height}",
            albedoSlotInfo ?? "none",
            albedoColor);

        return new MaterialData(albedoColor, albedoTexture, normalTexture, metallic, roughness, emissive);
    }

    private Image<Rgba32>? ResolveAlbedoTexture(Material material, out bool requested, out string? slotInfo)
    {
        requested = false;
        slotInfo = null;
        if (TryGetTexture(material, "BaseColor", out var slot))
        {
            requested = true;
            slotInfo = DescribeSlot(slot);
            return ResolveTextureSlot(slot);
        }
        if (material.GetMaterialTexture(TextureType.Diffuse, 0, out var diffuse))
        {
            requested = true;
            slotInfo = DescribeSlot(diffuse);
            return ResolveTextureSlot(diffuse);
        }
        return null;
    }

    private Vector3 ResolveAlbedoColor(Material material)
    {
        if (!IsColorEmpty(material.ColorDiffuse))
        {
            return new Vector3(material.ColorDiffuse.R, material.ColorDiffuse.G, material.ColorDiffuse.B);
        }
        return Vector3.Zero;
    }

    private Vector3 ResolveEmissive(Material material)
    {
        if (!IsColorEmpty(material.ColorEmissive))
        {
            return new Vector3(material.ColorEmissive.R, material.ColorEmissive.G, material.ColorEmissive.B);
        }
        return Vector3.Zero;
    }

    private Image<Rgba32>? ResolveFirstTexture(Material material, string[] typeNames)
    {
        foreach (var name in typeNames)
        {
            if (TryGetTexture(material, name, out var slot))
            {
                var image = ResolveTextureSlot(slot);
                if (image != null)
                {
                    return image;
                }
            }
        }
        return null;
    }

    private static bool TryGetTexture(Material material, string typeName, out TextureSlot slot)
    {
        slot = default;
        if (!Enum.TryParse<TextureType>(typeName, true, out var type))
        {
            return false;
        }
        return material.GetMaterialTexture(type, 0, out slot);
    }

    private Image<Rgba32>? ResolveTextureSlot(TextureSlot slot)
    {
        if (!string.IsNullOrWhiteSpace(slot.FilePath))
        {
            return _textures.Resolve(slot.FilePath);
        }
        if (slot.TextureIndex >= 0)
        {
            return _textures.ResolveEmbedded(slot.TextureIndex);
        }
        return _textures.ResolveEmbeddedFallback();
    }

    private static string DescribeSlot(TextureSlot slot)
    {
        var path = string.IsNullOrWhiteSpace(slot.FilePath) ? "null" : slot.FilePath;
        return $"path={path}, index={slot.TextureIndex}";
    }

    private static bool IsColorEmpty(Vector3 color)
    {
        return color.X <= 0f && color.Y <= 0f && color.Z <= 0f;
    }

    private static bool IsColorEmpty(Color4D color)
    {
        return color.R <= 0f && color.G <= 0f && color.B <= 0f;
    }

    private static Vector3 GenerateVortexColor(string? seed)
    {
        var hash = 2166136261u;
        if (!string.IsNullOrEmpty(seed))
        {
            foreach (var ch in seed)
            {
                hash ^= ch;
                hash *= 16777619;
            }
        }
        var hue = (hash % 360) / 360f;
        return HsvToRgb(hue, 0.75f, 0.9f);
    }

    private static Vector3 HsvToRgb(float h, float s, float v)
    {
        var i = (int)MathF.Floor(h * 6f);
        var f = h * 6f - i;
        var p = v * (1f - s);
        var q = v * (1f - f * s);
        var t = v * (1f - (1f - f) * s);
        return (i % 6) switch
        {
            0 => new Vector3(v, t, p),
            1 => new Vector3(q, v, p),
            2 => new Vector3(p, v, t),
            3 => new Vector3(p, q, v),
            4 => new Vector3(t, p, v),
            _ => new Vector3(v, p, q)
        };
    }
}

public sealed class TextureResolver
{
    private readonly Scene _scene;
    private readonly string _modelDirectory;
    private readonly string _modelPath;
    private readonly string _modelBaseName;
    private readonly ILogger _logger;
    private readonly Dictionary<string, Image<Rgba32>> _cache = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _warnings = new(StringComparer.OrdinalIgnoreCase);

    public TextureResolver(Scene scene, string modelDirectory, string modelPath, ILogger logger)
    {
        _scene = scene;
        _modelDirectory = modelDirectory;
        _modelPath = modelPath;
        _modelBaseName = string.IsNullOrWhiteSpace(modelPath)
            ? string.Empty
            : Path.GetFileNameWithoutExtension(modelPath);
        _logger = logger;
    }

    public Image<Rgba32>? Resolve(string? filePath)
    {
        if (string.IsNullOrWhiteSpace(filePath))
        {
            return null;
        }

        if (filePath.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            var dataImage = LoadDataUri(filePath);
            if (dataImage == null)
            {
                WarnOnce($"data:{filePath.Length}", "Gagal decode data URI texture");
            }
            return dataImage;
        }

        if (filePath.StartsWith('*') && int.TryParse(filePath[1..], out var index))
        {
            return LoadEmbedded(index);
        }

        var candidate = Path.IsPathRooted(filePath)
            ? filePath
            : Path.GetFullPath(Path.Combine(_modelDirectory, filePath));

        if (File.Exists(candidate))
        {
            return LoadExternal(candidate);
        }

        var byName = TryResolveByFilename(filePath);
        if (byName != null)
        {
            return byName;
        }

        WarnOnce($"missing:{filePath}", $"Texture tidak ditemukan: {filePath}");

        return ResolveEmbeddedFallback();
    }

    public Image<Rgba32>? ResolveEmbeddedFallback()
    {
        if (_scene.TextureCount == 1)
        {
            return LoadEmbedded(0);
        }
        return null;
    }

    public Image<Rgba32>? ResolveEmbedded(int index)
    {
        return LoadEmbedded(index);
    }

    public Image<Rgba32> CreateFallbackTexture()
    {
        const string key = "__fallback_checker__";
        if (_cache.TryGetValue(key, out var cached))
        {
            return cached;
        }

        var image = new Image<Rgba32>(8, 8);
        var light = new Rgba32(200, 200, 200);
        var dark = new Rgba32(120, 120, 120);
        for (var y = 0; y < 8; y++)
        {
            for (var x = 0; x < 8; x++)
            {
                var useLight = ((x + y) & 1) == 0;
                image[x, y] = useLight ? light : dark;
            }
        }
        _cache[key] = image;
        return image;
    }

    private Image<Rgba32>? LoadExternal(string path)
    {
        if (_cache.TryGetValue(path, out var cached))
        {
            return cached;
        }

        try
        {
            var image = Image.Load<Rgba32>(path);
            image = ClampTextureSize(image, path);
            _cache[path] = image;
            return image;
        }
        catch
        {
            WarnOnce($"decode:{path}", $"Gagal decode texture: {path}");
            return null;
        }
    }

    private Image<Rgba32>? TryResolveByFilename(string filePath)
    {
        var fileName = Path.GetFileName(filePath);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return null;
        }

        var direct = Path.Combine(_modelDirectory, fileName);
        if (File.Exists(direct))
        {
            return LoadExternal(direct);
        }

        var texturesDir = Path.Combine(_modelDirectory, "textures");
        var texturesCandidate = Path.Combine(texturesDir, fileName);
        if (File.Exists(texturesCandidate))
        {
            return LoadExternal(texturesCandidate);
        }

        if (!string.IsNullOrWhiteSpace(_modelBaseName))
        {
            var fbmDir = Path.Combine(_modelDirectory, $"{_modelBaseName}.fbm");
            var fbmCandidate = Path.Combine(fbmDir, fileName);
            if (File.Exists(fbmCandidate))
            {
                return LoadExternal(fbmCandidate);
            }
        }

        return null;
    }

    private Image<Rgba32>? LoadEmbedded(int index)
    {
        if (_scene.TextureCount == 0)
        {
            WarnOnce("embedded:none", "Embedded texture tidak tersedia pada scene");
            return null;
        }
        var key = $"*{index}";
        if (_cache.TryGetValue(key, out var cached))
        {
            return cached;
        }

        if (index < 0 || index >= _scene.Textures.Count)
        {
            WarnOnce($"embedded:{index}", $"Embedded texture index tidak valid: {index}");
            return null;
        }

        var texture = _scene.Textures[index];
        var image = LoadAssimpTexture(texture);
        if (image == null)
        {
            WarnOnce($"embedded:{index}", $"Gagal decode embedded texture: {index}");
            return null;
        }
        image = ClampTextureSize(image, $"*{index}");
        _cache[key] = image;
        return image;
    }

    private Image<Rgba32>? LoadDataUri(string dataUri)
    {
        var marker = "base64,";
        var idx = dataUri.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (idx < 0)
        {
            return null;
        }
        var base64 = dataUri[(idx + marker.Length)..];
        try
        {
            var bytes = Convert.FromBase64String(base64);
            using var stream = new MemoryStream(bytes);
            var image = Image.Load<Rgba32>(stream);
            return ClampTextureSize(image, "data-uri");
        }
        catch
        {
            return null;
        }
    }

    private static Image<Rgba32> ClampTextureSize(Image<Rgba32> image, string key)
    {
        const int maxSize = 2048;
        if (image.Width <= maxSize && image.Height <= maxSize)
        {
            return image;
        }
        var scale = MathF.Min(maxSize / (float)image.Width, maxSize / (float)image.Height);
        var targetW = Math.Max(1, (int)MathF.Round(image.Width * scale));
        var targetH = Math.Max(1, (int)MathF.Round(image.Height * scale));
        image.Mutate(ctx => ctx.Resize(targetW, targetH, KnownResamplers.Lanczos3));
        return image;
    }

    private static Image<Rgba32>? LoadAssimpTexture(dynamic texture)
    {
        if (texture == null)
        {
            return null;
        }

        try
        {
            if (texture.IsCompressed)
            {
                var compressed = texture.CompressedData as byte[];
                if (compressed == null || compressed.Length == 0)
                {
                    return null;
                }
                using var stream = new MemoryStream(compressed);
                return Image.Load<Rgba32>(stream);
            }

            if (texture.Width <= 0 || texture.Height <= 0)
            {
                return null;
            }

            var image = new Image<Rgba32>(texture.Width, texture.Height);
            var data = texture.NonCompressedData as Array;
            if (data == null || data.Length < texture.Width * texture.Height)
            {
                image.Dispose();
                return null;
            }

            var index = 0;
            for (var y = 0; y < texture.Height; y++)
            {
                for (var x = 0; x < texture.Width; x++)
                {
                    var texel = data!.GetValue(index++);
                    if (texel == null)
                    {
                        continue;
                    }
                    dynamic color = texel;
                    image[x, y] = new Rgba32(color.R, color.G, color.B, color.A);
                }
            }

            return image;
        }
        catch
        {
            return null;
        }
    }

    private void WarnOnce(string key, string message)
    {
        if (_warnings.Add(key))
        {
            _logger.LogWarning(message);
        }
    }
}

public sealed class ModelScene : IDisposable
{
    public ModelScene(IReadOnlyList<MeshData> meshes, IReadOnlyList<MaterialData> materials, NodeData rootNode, IReadOnlyList<AnimationClip> animations)
    {
        Meshes = meshes;
        Materials = materials;
        RootNode = rootNode;
        Animations = animations;
    }

    public IReadOnlyList<MeshData> Meshes { get; }
    public IReadOnlyList<MaterialData> Materials { get; }
    public NodeData RootNode { get; }
    public IReadOnlyList<AnimationClip> Animations { get; }
    public Vector3 NormalizationOffset { get; set; } = Vector3.Zero;

    public void Dispose()
    {
        var disposed = new HashSet<Image<Rgba32>>();
        foreach (var material in Materials)
        {
            if (material.AlbedoTexture != null && disposed.Add(material.AlbedoTexture))
            {
                material.AlbedoTexture.Dispose();
            }
            if (material.NormalTexture != null && disposed.Add(material.NormalTexture))
            {
                material.NormalTexture.Dispose();
            }
        }
    }
}

public sealed class MeshData
{
    public MeshData(Vector3[] vertices, Vector3[] normals, Vector2[] uvs, int[] indices, int materialIndex, bool hasUv0)
    {
        Vertices = vertices;
        Normals = normals;
        UVs = uvs;
        Indices = indices;
        MaterialIndex = materialIndex;
        HasUv0 = hasUv0;
    }

    public Vector3[] Vertices { get; }
    public Vector3[] Normals { get; }
    public Vector2[] UVs { get; }
    public int[] Indices { get; }
    public int MaterialIndex { get; }
    public Matrix4x4 Transform { get; set; } = Matrix4x4.Identity;
    public bool HasUv0 { get; }
}

public sealed class MaterialData
{
    public MaterialData(Vector3 albedoColor, Image<Rgba32>? albedoTexture, Image<Rgba32>? normalTexture, float metallic, float roughness, Vector3 emissive)
    {
        AlbedoColor = albedoColor;
        AlbedoTexture = albedoTexture;
        NormalTexture = normalTexture;
        Metallic = metallic;
        Roughness = roughness;
        Emissive = emissive;
    }

    public Vector3 AlbedoColor { get; }
    public Image<Rgba32>? AlbedoTexture { get; }
    public Image<Rgba32>? NormalTexture { get; }
    public float Metallic { get; }
    public float Roughness { get; }
    public Vector3 Emissive { get; }
}

public sealed class NodeData
{
    public NodeData(string name, Matrix4x4 localTransform, Matrix4x4 baseTransform, int[] meshIndices, List<NodeData> children)
    {
        Name = name;
        LocalTransform = localTransform;
        BaseTransform = baseTransform;
        MeshIndices = meshIndices;
        Children = children;
    }

    public string Name { get; }
    public Matrix4x4 LocalTransform { get; set; }
    public Matrix4x4 BaseTransform { get; }
    public int[] MeshIndices { get; }
    public List<NodeData> Children { get; }
}

public sealed record AnimationClip(string Name, double Duration, double TicksPerSecond, IReadOnlyDictionary<string, NodeAnimationChannel> Channels);
public sealed record NodeAnimationChannel(VectorKey[] Positions, QuaternionKey[] Rotations, VectorKey[] Scales);
public sealed record VectorKey(double Time, Vector3 Value);
public sealed record QuaternionKey(double Time, Quaternion Value);
