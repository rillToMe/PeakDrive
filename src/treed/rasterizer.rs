//! CPU software rasteriser, a faithful port of `SnapshotRenderer.cs`.

use crate::treed::math::{Mat4, Vec2, Vec3, Vec4};
use crate::treed::scene::MeshData;
use crate::treed::scene::{MaterialData, ModelScene, TextureImage};
use crate::treed::setup::{BoundingBoxUtil, CameraSetup, CameraState, LightRig, LightingSetup};

#[derive(Clone, Copy)]
struct ProjectedVertex {
    valid: bool,
    x: f32,
    y: f32,
    z: f32,
}

fn project(world: Vec3, view_proj: &Mat4, width: u32, height: u32) -> ProjectedVertex {
    let clip = Vec4::new(world.x, world.y, world.z, 1.0).transform(view_proj);
    if clip.w <= 0.0001 {
        return ProjectedVertex {
            valid: false,
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };
    }
    let inv_w = 1.0 / clip.w;
    let ndc = Vec3::new(clip.x * inv_w, clip.y * inv_w, clip.z * inv_w);
    let x = (ndc.x + 1.0) * 0.5 * width as f32;
    let y = (1.0 - ndc.y) * 0.5 * height as f32;
    ProjectedVertex {
        valid: true,
        x,
        y,
        z: ndc.z,
    }
}

#[inline]
fn edge_vv(a: ProjectedVertex, b: ProjectedVertex, c: ProjectedVertex) -> f32 {
    (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)
}

#[inline]
fn edge_vp(a: ProjectedVertex, b: ProjectedVertex, c: Vec2) -> f32 {
    (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)
}

fn sample_texture(texture: &TextureImage, uv: Vec2) -> Vec3 {
    if uv.x.is_nan() || uv.y.is_nan() || uv.x.is_infinite() || uv.y.is_infinite() {
        return Vec3::ONE;
    }
    let mut u = uv.x - uv.x.floor();
    let mut v = uv.y - uv.y.floor();
    u = u.clamp(0.0, 1.0);
    v = v.clamp(0.0, 1.0);

    let x = u * (texture.width as f32 - 1.0);
    let y = (1.0 - v) * (texture.height as f32 - 1.0);
    let x0f = x.floor();
    let y0f = y.floor();
    let mut x0 = x0f as i32;
    let mut y0 = y0f as i32;
    let x1 = (x0 + 1).clamp(0, texture.width as i32 - 1);
    let y1 = (y0 + 1).clamp(0, texture.height as i32 - 1);
    x0 = x0.clamp(0, texture.width as i32 - 1);
    y0 = y0.clamp(0, texture.height as i32 - 1);
    let tx = x - x0 as f32;
    let ty = y - y0 as f32;

    let c00 = to_linear_rgba(texture.get(x0 as u32, y0 as u32));
    let c10 = to_linear_rgba(texture.get(x1 as u32, y0 as u32));
    let c01 = to_linear_rgba(texture.get(x0 as u32, y1 as u32));
    let c11 = to_linear_rgba(texture.get(x1 as u32, y1 as u32));
    let c0 = Vec3::lerp(c00, c10, tx);
    let c1 = Vec3::lerp(c01, c11, tx);
    Vec3::lerp(c0, c1, ty)
}

fn compute_lighting(normal: Vec3, lights: &LightRig) -> f32 {
    let n = normal.normalize();
    let ambient = 0.25f32;
    let key = n.dot(lights.key.direction).max(0.0) * lights.key.intensity;
    let fill = n.dot(lights.fill.direction).max(0.0) * lights.fill.intensity;
    let back = n.dot(lights.back.direction).max(0.0) * lights.back.intensity;
    (ambient + key + fill + back).min(1.0)
}

fn clamp_color(color: Vec3) -> Vec3 {
    Vec3::new(
        color.x.clamp(0.0, 1.0),
        color.y.clamp(0.0, 1.0),
        color.z.clamp(0.0, 1.0),
    )
}

fn to_color(color: Vec3) -> [u8; 4] {
    [
        (color.x * 255.0) as u8,
        (color.y * 255.0) as u8,
        (color.z * 255.0) as u8,
        255,
    ]
}

fn to_linear(color: Vec3) -> Vec3 {
    Vec3::new(color.x.powf(2.2), color.y.powf(2.2), color.z.powf(2.2))
}

fn to_linear_rgba(color: [u8; 4]) -> Vec3 {
    to_linear(Vec3::new(
        color[0] as f32 / 255.0,
        color[1] as f32 / 255.0,
        color[2] as f32 / 255.0,
    ))
}

fn to_srgb(color: Vec3) -> Vec3 {
    Vec3::new(
        color.x.powf(1.0 / 2.2),
        color.y.powf(1.0 / 2.2),
        color.z.powf(1.0 / 2.2),
    )
}

pub struct SnapshotRenderer;

impl SnapshotRenderer {
    pub fn render(
        &self,
        scene: &ModelScene,
        camera: &CameraState,
        lights: &LightRig,
        width: u32,
        height: u32,
        background: [u8; 4],
    ) -> TextureImage {
        let mut image = TextureImage::new(width, height);
        // Fill background.
        for y in 0..height {
            for x in 0..width {
                image.set(x, y, background);
            }
        }
        let mut depth_buffer = vec![f32::MAX; (width as usize) * (height as usize)];

        let view = Mat4::create_look_at(camera.position, camera.target, Vec3::UNIT_Y);
        let proj = Mat4::create_perspective_fov(
            camera.fov_radians,
            width as f32 / height as f32,
            0.1,
            (camera.distance * 4.0).max(10.0),
        );
        let view_proj = Mat4::multiply(&view, &proj);

        for mesh in &scene.meshes {
            let material = scene
                .materials
                .get(mesh.material_index.max(0) as usize)
                .cloned()
                .unwrap_or_else(MaterialData::default_material);
            let use_texture = material.albedo_texture.is_some() && mesh.has_uv0;
            let has_normals = mesh.normals.len() == mesh.vertices.len();
            let inverse_transform = Mat4::invert(&mesh.transform).unwrap_or(Mat4::IDENTITY);
            let normal_transform = Mat4::transpose(&inverse_transform);

            let mut i = 0usize;
            while i < mesh.indices.len() {
                if i + 2 >= mesh.indices.len() {
                    break;
                }
                let i0 = mesh.indices[i];
                let i1 = mesh.indices[i + 1];
                let i2 = mesh.indices[i + 2];
                i += 3;

                if i0 < 0
                    || i1 < 0
                    || i2 < 0
                    || i0 as usize >= mesh.vertices.len()
                    || i1 as usize >= mesh.vertices.len()
                    || i2 as usize >= mesh.vertices.len()
                {
                    continue;
                }

                let w0 = mesh.vertices[i0 as usize]
                    .transform_position(&mesh.transform)
                    .add(scene.normalization_offset);
                let w1 = mesh.vertices[i1 as usize]
                    .transform_position(&mesh.transform)
                    .add(scene.normalization_offset);
                let w2 = mesh.vertices[i2 as usize]
                    .transform_position(&mesh.transform)
                    .add(scene.normalization_offset);

                let n = w1.sub(w0).cross(w2.sub(w0)).normalize();
                if n.is_nan() {
                    continue;
                }

                let c0 = project(w0, &view_proj, width, height);
                let c1 = project(w1, &view_proj, width, height);
                let c2 = project(w2, &view_proj, width, height);
                if !c0.valid || !c1.valid || !c2.valid {
                    continue;
                }

                let min_x = c0.x.min(c1.x.min(c2.x)).max(0.0) as i32;
                let max_x = c0.x.max(c1.x.max(c2.x)).min(width as f32 - 1.0) as i32;
                let min_y = c0.y.min(c1.y.min(c2.y)).max(0.0) as i32;
                let max_y = c0.y.max(c1.y.max(c2.y)).min(height as f32 - 1.0) as i32;

                let area = edge_vv(c0, c1, c2);
                if area.abs() < 1e-6 {
                    continue;
                }

                for y in min_y..=max_y {
                    for x in min_x..=max_x {
                        let p = Vec2::new(x as f32 + 0.5, y as f32 + 0.5);
                        let w_a = edge_vp(c1, c2, p);
                        let w_b = edge_vp(c2, c0, p);
                        let w_c = edge_vp(c0, c1, p);
                        if area > 0.0 {
                            if w_a < 0.0 || w_b < 0.0 || w_c < 0.0 {
                                continue;
                            }
                        } else if w_a > 0.0 || w_b > 0.0 || w_c > 0.0 {
                            continue;
                        }

                        let u = w_a / area;
                        let v = w_b / area;
                        let w = w_c / area;

                        let depth = c0.z * u + c1.z * v + c2.z * w;
                        let index = (y as usize) * (width as usize) + (x as usize);
                        if depth >= depth_buffer[index] {
                            continue;
                        }
                        depth_buffer[index] = depth;

                        let mut base_color = to_linear(material.albedo_color);
                        if use_texture {
                            if let Some(texture) = &material.albedo_texture {
                                let uv0 = mesh.uvs[i0 as usize];
                                let uv1 = mesh.uvs[i1 as usize];
                                let uv2 = mesh.uvs[i2 as usize];
                                let uv = Vec2::new(
                                    uv0.x * u + uv1.x * v + uv2.x * w,
                                    uv0.y * u + uv1.y * v + uv2.y * w,
                                );
                                base_color = base_color.mul(sample_texture(texture, uv));
                            }
                        }

                        let mut shading_normal = n;
                        if has_normals {
                            let n0 = mesh.normals[i0 as usize]
                                .transform_normal(&normal_transform)
                                .normalize();
                            let n1 = mesh.normals[i1 as usize]
                                .transform_normal(&normal_transform)
                                .normalize();
                            let n2 = mesh.normals[i2 as usize]
                                .transform_normal(&normal_transform)
                                .normalize();
                            shading_normal = n0
                                .mul_scalar(u)
                                .add(n1.mul_scalar(v))
                                .add(n2.mul_scalar(w))
                                .normalize();
                            if shading_normal.is_nan() {
                                shading_normal = n;
                            }
                        }

                        let light = compute_lighting(shading_normal, lights);
                        let emissive = to_linear(material.emissive);
                        let final_color = clamp_color(base_color.mul_scalar(light).add(emissive));
                        image.set(x as u32, y as u32, to_color(to_srgb(final_color)));
                    }
                }
            }
        }

        image
    }

    pub fn render_fallback(&self, width: u32, height: u32, background: [u8; 4]) -> TextureImage {
        let mesh = build_fallback_cube();
        let mut scene = ModelScene::new(
            vec![mesh],
            vec![MaterialData {
                albedo_color: Vec3::new(0.22, 0.55, 0.9),
                albedo_texture: None,
                normal_texture: None,
                metallic: 0.0,
                roughness: 1.0,
                emissive: Vec3::ZERO,
            }],
            crate::treed::scene::NodeData {
                name: "root".to_string(),
                local_transform: Mat4::IDENTITY,
                base_transform: Mat4::IDENTITY,
                mesh_indices: vec![0],
                children: vec![],
            },
            vec![],
        );
        let bounds = BoundingBoxUtil.calculate(&scene);
        let camera = CameraSetup.build(&bounds, Vec3::ZERO);
        let lights = LightingSetup.build(&camera);
        scene.normalization_offset = bounds.center.neg();
        self.render(&scene, &camera, &lights, width, height, background)
    }
}

fn build_fallback_cube() -> MeshData {
    let vertices = vec![
        Vec3::new(-0.5, -0.5, -0.5),
        Vec3::new(0.5, -0.5, -0.5),
        Vec3::new(0.5, 0.5, -0.5),
        Vec3::new(-0.5, 0.5, -0.5),
        Vec3::new(-0.5, -0.5, 0.5),
        Vec3::new(0.5, -0.5, 0.5),
        Vec3::new(0.5, 0.5, 0.5),
        Vec3::new(-0.5, 0.5, 0.5),
    ];
    let indices = vec![
        0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3,
        3, 7, 4, 3, 4, 0,
    ];
    let normals = vec![Vec3::UNIT_Z; vertices.len()];
    let uvs = vec![Vec2::new(0.0, 0.0); vertices.len()];
    MeshData {
        vertices,
        normals,
        uvs,
        indices,
        material_index: 0,
        has_uv0: false,
        transform: Mat4::IDENTITY,
    }
}
