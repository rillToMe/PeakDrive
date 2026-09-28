using System.Numerics;
using ditDriveAPI.Data;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace ditDriveAPI.Services.TreeD;

public sealed class TreeDThumbnailService
{
    private readonly ThumbnailStorage _storage;
    private readonly TreeDPipeline _pipeline;

    public TreeDThumbnailService(IConfiguration configuration, IWebHostEnvironment environment, ILoggerFactory loggerFactory)
    {
        _storage = new ThumbnailStorage(configuration, environment);
        var renderer = new SnapshotRenderer();
        _pipeline = new TreeDPipeline(
            new ModelLoader(loggerFactory.CreateLogger<ModelLoader>()),
            new BoundingBoxUtil(),
            new ModelNormalizer(),
            new CameraSetup(),
            new LightingSetup(),
            renderer,
            new RenderWarmup(renderer),
            new AnimationHandler());
    }

    public bool IsModelFile(string filename)
    {
        var lower = filename.ToLowerInvariant();
        return lower.EndsWith(".glb") || lower.EndsWith(".gltf") || lower.EndsWith(".fbx") || lower.EndsWith(".obj");
    }

    public bool TryGenerateModelThumbnail(string modelPath, DriveFile file, int userId, out string thumbnailName)
    {
        thumbnailName = "";
        if (!File.Exists(modelPath))
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(file.ThumbnailName) &&
            _storage.TryBuildThumbnailPath(file, out var existingPath) &&
            File.Exists(existingPath))
        {
            thumbnailName = file.ThumbnailName!;
            return true;
        }

        if (!_storage.TryGetThumbnailOutputPath(userId, file.PublicId, out var name, out var outputPath))
        {
            return false;
        }

        if (TryRenderToFile(modelPath, outputPath, 512))
        {
            thumbnailName = name;
            return true;
        }

        if (TryRenderToFile("__fallback__", outputPath, 512))
        {
            thumbnailName = name;
            return true;
        }

        return false;
    }

    public Task EnsureThumbnailInBackground(string modelPath, DriveFile file, int userId)
    {
        return Task.Run(() => TryGenerateModelThumbnail(modelPath, file, userId, out _));
    }

    public bool TryGetThumbnailOutputPath(int userId, string publicId, out string name, out string fullPath)
    {
        return _storage.TryGetThumbnailOutputPath(userId, publicId, out name, out fullPath);
    }

    public bool TryBuildThumbnailPath(DriveFile file, out string fullPath)
    {
        return _storage.TryBuildThumbnailPath(file, out fullPath);
    }

    public bool TryMoveThumbnailToTrash(DriveFile file, int userId, out string nextThumbnailName)
    {
        nextThumbnailName = "";
        if (!_storage.TryMoveToTrash(file, userId, out var nextName))
        {
            return false;
        }
        if (!_storage.TryBuildThumbnailPath(file, out var currentPath))
        {
            return false;
        }
        var tempFile = new DriveFile { ThumbnailName = nextName };
        if (!_storage.TryBuildThumbnailPath(tempFile, out var targetPath))
        {
            return false;
        }
        _storage.EnsureDirectory(targetPath);
        if (File.Exists(currentPath))
        {
            File.Move(currentPath, targetPath, true);
        }
        nextThumbnailName = nextName;
        return true;
    }

    public bool TryRestoreThumbnailFromTrash(DriveFile file, int userId, out string nextThumbnailName)
    {
        nextThumbnailName = "";
        if (!_storage.TryRestoreFromTrash(file, userId, out var nextName))
        {
            return false;
        }
        if (!_storage.TryBuildThumbnailPath(file, out var currentPath))
        {
            return false;
        }
        var tempFile = new DriveFile { ThumbnailName = nextName };
        if (!_storage.TryBuildThumbnailPath(tempFile, out var targetPath))
        {
            return false;
        }
        _storage.EnsureDirectory(targetPath);
        if (File.Exists(currentPath))
        {
            File.Move(currentPath, targetPath, true);
        }
        nextThumbnailName = nextName;
        return true;
    }

    public Image<Rgba32> RenderFallbackThumbnail()
    {
        return _pipeline.RenderFallback(512, 512, new Rgba32(230, 230, 230));
    }

    private bool TryRenderToFile(string modelPath, string outputPath, int size)
    {
        try
        {
            var background = new Rgba32(226, 236, 248);
            var renderSize = Math.Clamp(size * 2, size, 1024);
            if (modelPath == "__fallback__")
            {
                using var fallback = _pipeline.RenderFallback(renderSize, renderSize, background);
                if (renderSize != size)
                {
                    fallback.Mutate(ctx => ctx.Resize(size, size, KnownResamplers.Lanczos3));
                }
                _storage.EnsureDirectory(outputPath);
                fallback.Save(outputPath);
                return true;
            }

            using var image = _pipeline.RenderModel(modelPath, renderSize, background, 10);
            if (renderSize != size)
            {
                image.Mutate(ctx => ctx.Resize(size, size, KnownResamplers.Lanczos3));
            }
            _storage.EnsureDirectory(outputPath);
            image.Save(outputPath);
            return true;
        }
        catch
        {
            return false;
        }
    }
}

public sealed class TreeDPipeline
{
    private readonly ModelLoader _modelLoader;
    private readonly BoundingBoxUtil _bounds;
    private readonly ModelNormalizer _normalizer;
    private readonly CameraSetup _cameraSetup;
    private readonly LightingSetup _lightingSetup;
    private readonly ITreeDRenderer _renderer;
    private readonly RenderWarmup _warmup;
    private readonly AnimationHandler _animationHandler;

    public TreeDPipeline(
        ModelLoader modelLoader,
        BoundingBoxUtil bounds,
        ModelNormalizer normalizer,
        CameraSetup cameraSetup,
        LightingSetup lightingSetup,
        ITreeDRenderer renderer,
        RenderWarmup warmup,
        AnimationHandler animationHandler)
    {
        _modelLoader = modelLoader;
        _bounds = bounds;
        _normalizer = normalizer;
        _cameraSetup = cameraSetup;
        _lightingSetup = lightingSetup;
        _renderer = renderer;
        _warmup = warmup;
        _animationHandler = animationHandler;
    }

    public Image<Rgba32> RenderFallback(int width, int height, Rgba32 background)
    {
        return _renderer.RenderFallback(width, height, background);
    }

    public Image<Rgba32> RenderModel(string modelPath, int size, Rgba32 background, int warmupFrames)
    {
        using var scene = _modelLoader.Load(modelPath);
        var bounds = _bounds.Calculate(scene);
        _normalizer.NormalizeToOrigin(scene, bounds.Center);
        var camera = _cameraSetup.Build(bounds, Vector3.Zero);
        var lights = _lightingSetup.Build(camera);

        var snapshotTime = _animationHandler.GetSnapshotTime(scene);
        if (snapshotTime.HasValue)
        {
            _animationHandler.Seek(scene, snapshotTime.Value);
        }

        if (warmupFrames > 0)
        {
            _warmup.Warmup(scene, camera, lights, size, size, background, warmupFrames);
        }

        return _renderer.Render(scene, camera, lights, size, size, background);
    }
}
