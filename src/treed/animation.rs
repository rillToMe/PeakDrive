//! Animation seeking, port of `AnimationHandler.cs`.

use crate::treed::math::{Mat4, Quat, Vec3};
use crate::treed::scene::{ModelScene, NodeAnimationChannel, NodeData, QuaternionKey, VectorKey};

pub struct AnimationHandler;

impl AnimationHandler {
    pub fn get_snapshot_time(&self, scene: &ModelScene) -> Option<f64> {
        let clip = scene.animations.first()?;
        let ticks_per_second = if clip.ticks_per_second > 0.0 {
            clip.ticks_per_second
        } else {
            25.0
        };
        let duration_seconds = clip.duration / ticks_per_second;
        Some(duration_seconds * 0.15)
    }

    pub fn seek(&self, scene: &mut ModelScene, time_seconds: f64) {
        let clip = match scene.animations.first() {
            Some(clip) => clip.clone(),
            None => return,
        };
        let ticks_per_second = if clip.ticks_per_second > 0.0 {
            clip.ticks_per_second
        } else {
            25.0
        };
        let time_ticks = time_seconds * ticks_per_second;

        // Take meshes out temporarily to satisfy the borrow checker while the
        // node tree is walked mutably.
        let mut meshes = std::mem::take(&mut scene.meshes);
        apply_node(
            &mut scene.root_node,
            Mat4::IDENTITY,
            &mut meshes,
            &clip.channels,
            time_ticks,
        );
        scene.meshes = meshes;
    }
}

fn apply_node(
    node: &mut NodeData,
    parent: Mat4,
    meshes: &mut [crate::treed::scene::MeshData],
    channels: &std::collections::HashMap<String, NodeAnimationChannel>,
    time_ticks: f64,
) {
    node.local_transform = node.base_transform;
    if let Some(channel) = channels.get(&node.name) {
        let position = interpolate_vector(&channel.positions, time_ticks, Vec3::ZERO);
        let scale = interpolate_vector(&channel.scales, time_ticks, Vec3::ONE);
        let rotation = interpolate_quaternion(&channel.rotations, time_ticks, Quat::IDENTITY);
        let local = Mat4::multiply(
            &Mat4::multiply(
                &Mat4::create_scale(scale),
                &Mat4::create_from_quaternion(rotation),
            ),
            &Mat4::create_translation(position),
        );
        node.local_transform = local;
    }

    let world = Mat4::multiply(&node.local_transform, &parent);
    for mesh_index in &node.mesh_indices {
        if *mesh_index >= 0 && (*mesh_index as usize) < meshes.len() {
            meshes[*mesh_index as usize].transform = world;
        }
    }

    for child in node.children.iter_mut() {
        apply_node(child, world, meshes, channels, time_ticks);
    }
}

fn interpolate_vector(keys: &[VectorKey], time_ticks: f64, fallback: Vec3) -> Vec3 {
    if keys.is_empty() {
        return fallback;
    }
    if keys.len() == 1 || time_ticks <= keys[0].time {
        return keys[0].value;
    }
    if time_ticks >= keys[keys.len() - 1].time {
        return keys[keys.len() - 1].value;
    }
    for i in 0..keys.len() - 1 {
        let left = &keys[i];
        let right = &keys[i + 1];
        if time_ticks >= left.time && time_ticks <= right.time {
            let span = right.time - left.time;
            let factor = if span <= 0.0 {
                0.0
            } else {
                ((time_ticks - left.time) / span) as f32
            };
            return Vec3::lerp(left.value, right.value, factor);
        }
    }
    keys[keys.len() - 1].value
}

fn interpolate_quaternion(keys: &[QuaternionKey], time_ticks: f64, fallback: Quat) -> Quat {
    if keys.is_empty() {
        return fallback;
    }
    if keys.len() == 1 || time_ticks <= keys[0].time {
        return keys[0].value;
    }
    if time_ticks >= keys[keys.len() - 1].time {
        return keys[keys.len() - 1].value;
    }
    for i in 0..keys.len() - 1 {
        let left = &keys[i];
        let right = &keys[i + 1];
        if time_ticks >= left.time && time_ticks <= right.time {
            let span = right.time - left.time;
            let factor = if span <= 0.0 {
                0.0
            } else {
                ((time_ticks - left.time) / span) as f32
            };
            return Quat::slerp(left.value, right.value, factor);
        }
    }
    keys[keys.len() - 1].value
}
