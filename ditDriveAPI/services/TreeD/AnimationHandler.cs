using System.Numerics;

namespace ditDriveAPI.Services.TreeD;

public sealed class AnimationHandler
{
    public double? GetSnapshotTime(ModelScene scene)
    {
        if (scene.Animations.Count == 0)
        {
            return null;
        }

        var clip = scene.Animations[0];
        var ticksPerSecond = clip.TicksPerSecond > 0 ? clip.TicksPerSecond : 25d;
        var durationSeconds = clip.Duration / ticksPerSecond;
        return durationSeconds * 0.15d;
    }

    public void Seek(ModelScene scene, double timeSeconds)
    {
        if (scene.Animations.Count == 0)
        {
            return;
        }

        var clip = scene.Animations[0];
        var ticksPerSecond = clip.TicksPerSecond > 0 ? clip.TicksPerSecond : 25d;
        var timeTicks = timeSeconds * ticksPerSecond;
        ApplyNode(scene.RootNode, Matrix4x4.Identity, scene.Meshes, clip, timeTicks);
    }

    private void ApplyNode(NodeData node, Matrix4x4 parent, IReadOnlyList<MeshData> meshes, AnimationClip clip, double timeTicks)
    {
        node.LocalTransform = node.BaseTransform;
        if (clip.Channels.TryGetValue(node.Name, out var channel))
        {
            var position = InterpolateVector(channel.Positions, timeTicks, Vector3.Zero);
            var scale = InterpolateVector(channel.Scales, timeTicks, Vector3.One);
            var rotation = InterpolateQuaternion(channel.Rotations, timeTicks, Quaternion.Identity);
            var local = Matrix4x4.CreateScale(scale) *
                        Matrix4x4.CreateFromQuaternion(rotation) *
                        Matrix4x4.CreateTranslation(position);
            node.LocalTransform = local;
        }

        var world = Matrix4x4.Multiply(node.LocalTransform, parent);
        foreach (var meshIndex in node.MeshIndices)
        {
            if (meshIndex >= 0 && meshIndex < meshes.Count)
            {
                meshes[meshIndex].Transform = world;
            }
        }

        foreach (var child in node.Children)
        {
            ApplyNode(child, world, meshes, clip, timeTicks);
        }
    }

    private static Vector3 InterpolateVector(VectorKey[] keys, double timeTicks, Vector3 fallback)
    {
        if (keys.Length == 0)
        {
            return fallback;
        }
        if (keys.Length == 1 || timeTicks <= keys[0].Time)
        {
            return keys[0].Value;
        }
        if (timeTicks >= keys[^1].Time)
        {
            return keys[^1].Value;
        }
        for (var i = 0; i < keys.Length - 1; i++)
        {
            var left = keys[i];
            var right = keys[i + 1];
            if (timeTicks >= left.Time && timeTicks <= right.Time)
            {
                var span = right.Time - left.Time;
                var factor = span <= 0 ? 0 : (float)((timeTicks - left.Time) / span);
                return Vector3.Lerp(left.Value, right.Value, factor);
            }
        }
        return keys[^1].Value;
    }

    private static Quaternion InterpolateQuaternion(QuaternionKey[] keys, double timeTicks, Quaternion fallback)
    {
        if (keys.Length == 0)
        {
            return fallback;
        }
        if (keys.Length == 1 || timeTicks <= keys[0].Time)
        {
            return keys[0].Value;
        }
        if (timeTicks >= keys[^1].Time)
        {
            return keys[^1].Value;
        }
        for (var i = 0; i < keys.Length - 1; i++)
        {
            var left = keys[i];
            var right = keys[i + 1];
            if (timeTicks >= left.Time && timeTicks <= right.Time)
            {
                var span = right.Time - left.Time;
                var factor = span <= 0 ? 0 : (float)((timeTicks - left.Time) / span);
                return Quaternion.Slerp(left.Value, right.Value, factor);
            }
        }
        return keys[^1].Value;
    }
}
