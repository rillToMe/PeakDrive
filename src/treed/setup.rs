//! Bounding box / camera / lighting setup and warmup, ports of the corresponding
//! C# `TreeD` helper classes.

use crate::treed::math::Vec3;
use crate::treed::scene::ModelScene;

#[derive(Debug, Clone, Copy)]
pub struct BoundingBoxResult {
    pub min: Vec3,
    pub max: Vec3,
    pub size: Vec3,
    pub center: Vec3,
    pub radius: f32,
}

pub struct BoundingBoxUtil;

impl BoundingBoxUtil {
    pub fn calculate(&self, scene: &ModelScene) -> BoundingBoxResult {
        if scene.meshes.is_empty() {
            return BoundingBoxResult {
                min: Vec3::ZERO,
                max: Vec3::ZERO,
                size: Vec3::ZERO,
                center: Vec3::ZERO,
                radius: 0.0,
            };
        }

        let mut min = Vec3::new(f32::MAX, f32::MAX, f32::MAX);
        let mut max = Vec3::new(f32::MIN, f32::MIN, f32::MIN);

        for mesh in &scene.meshes {
            for vertex in &mesh.vertices {
                let world = vertex
                    .transform_position(&mesh.transform)
                    .add(scene.normalization_offset);
                min = min.min(world);
                max = max.max(world);
            }
        }

        let size = max.sub(min);
        let center = min.add(max).div_scalar(2.0);
        let radius = (size.x * size.x + size.y * size.y + size.z * size.z).sqrt() / 2.0;

        BoundingBoxResult {
            min,
            max,
            size,
            center,
            radius,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct CameraState {
    pub position: Vec3,
    pub target: Vec3,
    pub fov_radians: f32,
    pub distance: f32,
}

pub struct CameraSetup;

impl CameraSetup {
    pub fn build(&self, bounds: &BoundingBoxResult, target: Vec3) -> CameraState {
        let fov_degrees = 45.0f32;
        let fov_rad = fov_degrees * std::f32::consts::PI / 180.0;
        let mut distance = bounds.radius / (fov_rad / 2.0).tan();
        distance *= 1.2;

        let h = 45.0f32 * std::f32::consts::PI / 180.0;
        let v = 30.0f32 * std::f32::consts::PI / 180.0;

        let cam_x = target.x + distance * v.cos() * h.cos();
        let cam_y = target.y + distance * v.sin();
        let cam_z = target.z + distance * v.cos() * h.sin();

        CameraState {
            position: Vec3::new(cam_x, cam_y, cam_z),
            target,
            fov_radians: fov_rad,
            distance,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct LightSource {
    pub direction: Vec3,
    pub intensity: f32,
}

#[derive(Debug, Clone, Copy)]
pub struct LightRig {
    pub key: LightSource,
    pub fill: LightSource,
    pub back: LightSource,
}

pub struct LightingSetup;

impl LightingSetup {
    pub fn build(&self, camera: &CameraState) -> LightRig {
        let key_direction = camera.position.sub(camera.target).normalize();
        let fill_direction = key_direction.neg().normalize();
        let back_direction = key_direction
            .neg()
            .add(Vec3::UNIT_Y.mul_scalar(0.5))
            .normalize();

        LightRig {
            key: LightSource {
                direction: key_direction,
                intensity: 1.0,
            },
            fill: LightSource {
                direction: fill_direction,
                intensity: 0.5,
            },
            back: LightSource {
                direction: back_direction,
                intensity: 0.25,
            },
        }
    }
}

/// Warmup renders (kept for behavioural parity; the software rasteriser is
/// deterministic so repeated renders are identical, but the original pipeline
/// performed them, so we preserve the loop).
#[allow(clippy::too_many_arguments)]
pub fn warmup(
    renderer: &crate::treed::rasterizer::SnapshotRenderer,
    scene: &ModelScene,
    camera: &CameraState,
    lights: &LightRig,
    width: u32,
    height: u32,
    background: [u8; 4],
    frames: u32,
) {
    for _ in 0..frames {
        let _ = renderer.render(scene, camera, lights, width, height, background);
    }
}
