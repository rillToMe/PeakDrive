//! Scene data model, mirroring the C# `ModelScene` / `MeshData` / `MaterialData`
//! / `NodeData` / animation records.

use crate::treed::math::{Mat4, Quat, Vec2, Vec3};

/// Decoded texture kept in memory as RGBA8 (row-major, top-left origin).
#[derive(Clone)]
pub struct TextureImage {
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

impl TextureImage {
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            pixels: vec![0; (width as usize) * (height as usize) * 4],
        }
    }

    #[inline]
    pub fn get(&self, x: u32, y: u32) -> [u8; 4] {
        let idx = ((y as usize) * (self.width as usize) + (x as usize)) * 4;
        [
            self.pixels[idx],
            self.pixels[idx + 1],
            self.pixels[idx + 2],
            self.pixels[idx + 3],
        ]
    }

    #[inline]
    pub fn set(&mut self, x: u32, y: u32, rgba: [u8; 4]) {
        let idx = ((y as usize) * (self.width as usize) + (x as usize)) * 4;
        self.pixels[idx] = rgba[0];
        self.pixels[idx + 1] = rgba[1];
        self.pixels[idx + 2] = rgba[2];
        self.pixels[idx + 3] = rgba[3];
    }
}

#[derive(Clone)]
pub struct MaterialData {
    pub albedo_color: Vec3,
    pub albedo_texture: Option<TextureImage>,
    pub normal_texture: Option<TextureImage>,
    pub metallic: f32,
    pub roughness: f32,
    pub emissive: Vec3,
}

impl MaterialData {
    pub fn default_material() -> Self {
        Self {
            albedo_color: Vec3::new(0.7, 0.7, 0.7),
            albedo_texture: None,
            normal_texture: None,
            metallic: 0.0,
            roughness: 1.0,
            emissive: Vec3::ZERO,
        }
    }
}

#[derive(Clone)]
pub struct MeshData {
    pub vertices: Vec<Vec3>,
    pub normals: Vec<Vec3>,
    pub uvs: Vec<Vec2>,
    pub indices: Vec<i32>,
    pub material_index: i32,
    pub has_uv0: bool,
    pub transform: Mat4,
}

#[derive(Clone)]
pub struct NodeData {
    pub name: String,
    pub local_transform: Mat4,
    pub base_transform: Mat4,
    pub mesh_indices: Vec<i32>,
    pub children: Vec<NodeData>,
}

#[derive(Clone)]
pub struct VectorKey {
    pub time: f64,
    pub value: Vec3,
}

#[derive(Clone)]
pub struct QuaternionKey {
    pub time: f64,
    pub value: Quat,
}

#[derive(Clone)]
pub struct NodeAnimationChannel {
    pub positions: Vec<VectorKey>,
    pub rotations: Vec<QuaternionKey>,
    pub scales: Vec<VectorKey>,
}

#[derive(Clone)]
pub struct AnimationClip {
    pub name: String,
    pub duration: f64,
    pub ticks_per_second: f64,
    pub channels: std::collections::HashMap<String, NodeAnimationChannel>,
}

pub struct ModelScene {
    pub meshes: Vec<MeshData>,
    pub materials: Vec<MaterialData>,
    pub root_node: NodeData,
    pub animations: Vec<AnimationClip>,
    pub normalization_offset: Vec3,
}

impl ModelScene {
    pub fn new(
        meshes: Vec<MeshData>,
        materials: Vec<MaterialData>,
        root_node: NodeData,
        animations: Vec<AnimationClip>,
    ) -> Self {
        Self {
            meshes,
            materials,
            root_node,
            animations,
            normalization_offset: Vec3::ZERO,
        }
    }
}
