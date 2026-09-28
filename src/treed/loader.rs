//! Assimp-backed model loading, a port of `ModelLoader.cs` (plus the material
//! and texture resolvers) on top of `russimp-ng`.
//!
//! Note: the original pipeline resolved a normal/albedo/emissive set of
//! materials, but the software rasteriser only ever samples the albedo colour,
//! albedo texture and emissive term — so this port loads exactly those and
//! skips normal-map decoding (which had no effect on rendered output).

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use russimp_ng::material::{
    DataContent, Material, MaterialProperty, PropertyTypeInfo, TextureType,
};
use russimp_ng::node::Node;
use russimp_ng::scene::{PostProcess, Scene};

use crate::treed::math::{Mat4, Quat, Vec2, Vec3};
use crate::treed::scene::{
    AnimationClip, MaterialData, MeshData, ModelScene, NodeAnimationChannel, NodeData,
    QuaternionKey, TextureImage, VectorKey,
};

const MAX_TEXTURE_SIZE: u32 = 2048;

pub struct ModelLoader;

impl ModelLoader {
    pub fn load(model_path: &str) -> Result<ModelScene, String> {
        let flags = vec![
            PostProcess::Triangulate,
            PostProcess::GenerateNormals,
            PostProcess::JoinIdenticalVertices,
            PostProcess::ImproveCacheLocality,
            PostProcess::FlipUVs,
        ];

        let scene = Scene::from_file(model_path, flags)
            .map_err(|err| format!("failed to import model: {err}"))?;

        if scene.meshes.is_empty() {
            return Err("Model tidak memiliki mesh.".to_string());
        }

        let model_directory = Path::new(model_path)
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from(""));
        let model_base_name = Path::new(model_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        let mut resolver = TextureResolver::new(model_directory.clone(), model_base_name);

        let materials: Vec<MaterialData> = scene
            .materials
            .iter()
            .map(|m| resolve_material(m, &mut resolver))
            .collect();

        let mut meshes: Vec<MeshData> = Vec::with_capacity(scene.meshes.len());
        for mesh in &scene.meshes {
            let vertices: Vec<Vec3> = mesh
                .vertices
                .iter()
                .map(|v| Vec3::new(v.x, v.y, v.z))
                .collect();
            let normals: Vec<Vec3> = if mesh.normals.len() == mesh.vertices.len() {
                mesh.normals
                    .iter()
                    .map(|n| Vec3::new(n.x, n.y, n.z))
                    .collect()
            } else {
                vec![Vec3::UNIT_Y; vertices.len()]
            };
            let uv_channel = mesh.texture_coords.first().and_then(|c| c.as_ref());
            let has_uv0 = uv_channel.is_some();
            let uvs: Vec<Vec2> = match uv_channel {
                Some(coords) => coords.iter().map(|t| Vec2::new(t.x, t.y)).collect(),
                None => vec![Vec2::new(0.0, 0.0); vertices.len()],
            };
            let indices: Vec<i32> = mesh
                .faces
                .iter()
                .flat_map(|face| face.0.iter())
                .map(|&i| i as i32)
                .collect();

            meshes.push(MeshData {
                vertices,
                normals,
                uvs,
                indices,
                material_index: mesh.material_index as i32,
                has_uv0,
                transform: Mat4::IDENTITY,
            });
        }

        let root_node = match &scene.root {
            Some(root) => build_node(root),
            None => NodeData {
                name: String::new(),
                local_transform: Mat4::IDENTITY,
                base_transform: Mat4::IDENTITY,
                mesh_indices: vec![],
                children: vec![],
            },
        };
        apply_node_transforms(&root_node, Mat4::IDENTITY, &mut meshes);

        let mut animations = Vec::with_capacity(scene.animations.len());
        for animation in &scene.animations {
            let mut channels: HashMap<String, NodeAnimationChannel> = HashMap::new();
            for channel in &animation.channels {
                let positions: Vec<VectorKey> = channel
                    .position_keys
                    .iter()
                    .map(|k| VectorKey {
                        time: k.time,
                        value: Vec3::new(k.value.x, k.value.y, k.value.z),
                    })
                    .collect();
                let scales: Vec<VectorKey> = channel
                    .scaling_keys
                    .iter()
                    .map(|k| VectorKey {
                        time: k.time,
                        value: Vec3::new(k.value.x, k.value.y, k.value.z),
                    })
                    .collect();
                let rotations: Vec<QuaternionKey> = channel
                    .rotation_keys
                    .iter()
                    .map(|k| QuaternionKey {
                        time: k.time,
                        value: Quat::new(k.value.x, k.value.y, k.value.z, k.value.w),
                    })
                    .collect();
                channels.insert(
                    channel.name.clone(),
                    NodeAnimationChannel {
                        positions,
                        rotations,
                        scales,
                    },
                );
            }
            animations.push(AnimationClip {
                name: animation.name.clone(),
                duration: animation.duration,
                ticks_per_second: animation.ticks_per_second,
                channels,
            });
        }

        Ok(ModelScene::new(meshes, materials, root_node, animations))
    }
}

fn build_node(node: &Node) -> NodeData {
    let transform = convert_matrix(&node.transformation);
    let mesh_indices: Vec<i32> = node.meshes.iter().map(|&i| i as i32).collect();
    let children: Vec<NodeData> = node
        .children
        .borrow()
        .iter()
        .map(|child| build_node(child))
        .collect();
    NodeData {
        name: node.name.clone(),
        local_transform: transform,
        base_transform: transform,
        mesh_indices,
        children,
    }
}

fn apply_node_transforms(node: &NodeData, parent_transform: Mat4, meshes: &mut [MeshData]) {
    let world = Mat4::multiply(&node.local_transform, &parent_transform);
    for index in &node.mesh_indices {
        if *index >= 0 && (*index as usize) < meshes.len() {
            meshes[*index as usize].transform = world;
        }
    }
    for child in &node.children {
        apply_node_transforms(child, world, meshes);
    }
}

fn convert_matrix(matrix: &russimp_ng::Matrix4x4) -> Mat4 {
    Mat4::new(
        matrix.a1, matrix.b1, matrix.c1, matrix.d1, matrix.a2, matrix.b2, matrix.c2, matrix.d2,
        matrix.a3, matrix.b3, matrix.c3, matrix.d3, matrix.a4, matrix.b4, matrix.c4, matrix.d4,
    )
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

fn resolve_material(material: &Material, resolver: &mut TextureResolver) -> MaterialData {
    let mut albedo_color = color_from_property(material, "$clr.diffuse")
        .or_else(|| color_from_property(material, "$clr.base"))
        .unwrap_or(Vec3::ZERO);

    let albedo_texture = resolve_albedo_texture(material, resolver);
    if albedo_texture.is_none() && is_texture_requested(material) {
        albedo_color = generate_vortex_color(material_name(material));
    }
    if is_color_empty(albedo_color) {
        albedo_color = generate_vortex_color(material_name(material));
    }

    let emissive = color_from_property(material, "$clr.emissive").unwrap_or(Vec3::ZERO);

    MaterialData {
        albedo_color,
        albedo_texture,
        normal_texture: None,
        metallic: 0.0,
        roughness: 1.0,
        emissive,
    }
}

fn material_name(material: &Material) -> Option<String> {
    material
        .properties
        .iter()
        .find(|p| p.key == "$mat.name")
        .and_then(|p| match &p.data {
            PropertyTypeInfo::String(s) => Some(s.clone()),
            _ => None,
        })
}

fn color_from_property(material: &Material, key: &str) -> Option<Vec3> {
    let property = material.properties.iter().find(|p| p.key == key)?;
    match &property.data {
        PropertyTypeInfo::FloatArray(values) if values.len() >= 3 => {
            Some(Vec3::new(values[0], values[1], values[2]))
        }
        _ => None,
    }
}

fn texture_filename(material: &Material, semantics: &[TextureType]) -> Option<String> {
    for semantic in semantics {
        for property in &material.properties {
            if property.key == "$tex.file" && property.index == 0 && property.semantic == *semantic
            {
                if let PropertyTypeInfo::String(value) = &property.data {
                    if !value.trim().is_empty() {
                        return Some(value.clone());
                    }
                }
            }
        }
    }
    None
}

fn is_texture_requested(material: &Material) -> bool {
    texture_filename(material, &[TextureType::BaseColor, TextureType::Diffuse]).is_some()
        || material.textures.contains_key(&TextureType::BaseColor)
        || material.textures.contains_key(&TextureType::Diffuse)
}

fn resolve_albedo_texture(
    material: &Material,
    resolver: &mut TextureResolver,
) -> Option<TextureImage> {
    // Embedded textures (including `*N` references) are already decoded by
    // russimp-ng and keyed by texture type.
    if let Some(texture) = material
        .textures
        .get(&TextureType::BaseColor)
        .or_else(|| material.textures.get(&TextureType::Diffuse))
    {
        let texture = texture.borrow();
        if let Some(image) = decode_assimp_texture(&texture) {
            return Some(clamp_texture_size(image));
        }
    }

    // External texture reference resolved from the material property.
    if let Some(filename) =
        texture_filename(material, &[TextureType::BaseColor, TextureType::Diffuse])
    {
        return resolver.resolve(&filename).map(clamp_texture_size);
    }

    None
}

fn texture_from_assimp(texture: &russimp_ng::material::Texture) -> TextureImage {
    match &texture.data {
        DataContent::Texel(texels) => {
            let mut image = TextureImage::new(texture.width.max(1), texture.height.max(1));
            for (i, texel) in texels.iter().enumerate() {
                let x = (i as u32) % image.width;
                let y = (i as u32) / image.width;
                if y >= image.height {
                    break;
                }
                image.set(x, y, [texel.r, texel.g, texel.b, texel.a]);
            }
            image
        }
        DataContent::Bytes(bytes) => image::load_from_memory(bytes)
            .map(|img| img.to_rgba8())
            .map(|rgba| TextureImage {
                width: rgba.width(),
                height: rgba.height(),
                pixels: rgba.into_raw(),
            })
            .unwrap_or_else(|_| TextureImage::new(1, 1)),
    }
}

/// Decode an already-parsed Assimp texture (embedded) into RGBA8.
fn decode_assimp_texture(texture: &russimp_ng::material::Texture) -> Option<TextureImage> {
    Some(texture_from_assimp(texture))
}

fn clamp_texture_size(image: TextureImage) -> TextureImage {
    if image.width <= MAX_TEXTURE_SIZE && image.height <= MAX_TEXTURE_SIZE {
        return image;
    }
    let scale = (MAX_TEXTURE_SIZE as f32 / image.width as f32)
        .min(MAX_TEXTURE_SIZE as f32 / image.height as f32);
    let target_w = ((image.width as f32 * scale).round() as u32).max(1);
    let target_h = ((image.height as f32 * scale).round() as u32).max(1);

    let mut out = TextureImage::new(target_w, target_h);
    for y in 0..target_h {
        for x in 0..target_w {
            let src_x = ((x as f32 / target_w as f32) * image.width as f32) as u32;
            let src_y = ((y as f32 / target_h as f32) * image.height as f32) as u32;
            let src_x = src_x.min(image.width - 1);
            let src_y = src_y.min(image.height - 1);
            out.set(x, y, image.get(src_x, src_y));
        }
    }
    out
}

fn is_color_empty(color: Vec3) -> bool {
    color.x <= 0.0 && color.y <= 0.0 && color.z <= 0.0
}

fn generate_vortex_color(seed: Option<String>) -> Vec3 {
    let mut hash: u32 = 2166136261;
    if let Some(seed) = seed {
        for ch in seed.chars() {
            hash ^= ch as u32;
            hash = hash.wrapping_mul(16777619);
        }
    }
    let hue = (hash % 360) as f32 / 360.0;
    hsv_to_rgb(hue, 0.75, 0.9)
}

fn hsv_to_rgb(h: f32, s: f32, v: f32) -> Vec3 {
    let i = (h * 6.0).floor() as i32;
    let f = h * 6.0 - i as f32;
    let p = v * (1.0 - s);
    let q = v * (1.0 - f * s);
    let t = v * (1.0 - (1.0 - f) * s);
    match i.rem_euclid(6) {
        0 => Vec3::new(v, t, p),
        1 => Vec3::new(q, v, p),
        2 => Vec3::new(p, v, t),
        3 => Vec3::new(p, q, v),
        4 => Vec3::new(t, p, v),
        _ => Vec3::new(v, p, q),
    }
}

// ---------------------------------------------------------------------------
// Texture resolution (external files / data URIs / embedded fallback)
// ---------------------------------------------------------------------------

struct TextureResolver {
    model_directory: PathBuf,
    model_base_name: String,
    cache: HashMap<String, Option<TextureImage>>,
}

impl TextureResolver {
    fn new(model_directory: PathBuf, model_base_name: String) -> Self {
        Self {
            model_directory,
            model_base_name,
            cache: HashMap::new(),
        }
    }

    fn resolve(&mut self, file_path: &str) -> Option<TextureImage> {
        if file_path.trim().is_empty() {
            return None;
        }
        if let Some(cached) = self.cache.get(file_path) {
            return cached.clone();
        }
        let result = self.resolve_uncached(file_path);
        self.cache.insert(file_path.to_string(), result.clone());
        result
    }

    fn resolve_uncached(&self, file_path: &str) -> Option<TextureImage> {
        if file_path.to_lowercase().starts_with("data:") {
            return self.load_data_uri(file_path);
        }

        if let Some(index) = file_path
            .strip_prefix('*')
            .and_then(|s| s.parse::<usize>().ok())
        {
            // `*N` refers to an embedded texture; those are decoded directly
            // from `material.textures`, so an unresolved reference falls through.
            let _ = index;
            return None;
        }

        let candidate = if Path::new(file_path).is_absolute() {
            PathBuf::from(file_path)
        } else {
            self.model_directory.join(file_path)
        };
        if candidate.is_file() {
            return load_image_file(&candidate);
        }

        if let Some(by_name) = self.try_resolve_by_filename(file_path) {
            return Some(by_name);
        }

        None
    }

    fn try_resolve_by_filename(&self, file_path: &str) -> Option<TextureImage> {
        let file_name = Path::new(file_path)
            .file_name()?
            .to_string_lossy()
            .to_string();
        if file_name.is_empty() {
            return None;
        }

        let direct = self.model_directory.join(&file_name);
        if direct.is_file() {
            return load_image_file(&direct);
        }

        let textures = self.model_directory.join("textures").join(&file_name);
        if textures.is_file() {
            return load_image_file(&textures);
        }

        if !self.model_base_name.is_empty() {
            let fbm = self
                .model_directory
                .join(format!("{}.fbm", self.model_base_name))
                .join(&file_name);
            if fbm.is_file() {
                return load_image_file(&fbm);
            }
        }

        None
    }

    fn load_data_uri(&self, data_uri: &str) -> Option<TextureImage> {
        let marker = "base64,";
        let idx = data_uri.to_lowercase().find(marker)?;
        let base64 = &data_uri[idx + marker.len()..];
        use base64::Engine as _;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(base64.trim())
            .ok()?;
        image::load_from_memory(&bytes)
            .ok()
            .map(|img| img.to_rgba8())
            .map(|rgba| TextureImage {
                width: rgba.width(),
                height: rgba.height(),
                pixels: rgba.into_raw(),
            })
    }
}

fn load_image_file(path: &Path) -> Option<TextureImage> {
    let img = image::open(path).ok()?.to_rgba8();
    Some(TextureImage {
        width: img.width(),
        height: img.height(),
        pixels: img.into_raw(),
    })
}

#[allow(dead_code)]
fn _assert_property_is_send(_p: &MaterialProperty) {}
