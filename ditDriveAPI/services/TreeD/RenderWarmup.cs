using SixLabors.ImageSharp.PixelFormats;

namespace ditDriveAPI.Services.TreeD;

public sealed class RenderWarmup
{
    private readonly ITreeDRenderer _renderer;

    public RenderWarmup(ITreeDRenderer renderer)
    {
        _renderer = renderer;
    }

    public void Warmup(ModelScene scene, CameraState camera, LightRig lights, int width, int height, Rgba32 background, int frames)
    {
        for (var i = 0; i < frames; i++)
        {
            using var image = _renderer.Render(scene, camera, lights, width, height, background);
        }
    }
}
