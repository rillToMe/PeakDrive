//! Thumbnail generation service, a port of `TreeDThumbnailService.cs` and
//! `ThumbnailStorage.cs`.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::config::Config;
use crate::models::FileRow;
use crate::storage;
use crate::treed::animation::AnimationHandler;
use crate::treed::loader::ModelLoader;
use crate::treed::math::Vec3;
use crate::treed::rasterizer::SnapshotRenderer;
use crate::treed::scene::{ModelScene, TextureImage};
use crate::treed::setup::{warmup, BoundingBoxUtil, CameraSetup, LightingSetup};

const BACKGROUND: [u8; 4] = [226, 236, 248, 255];
const FALLBACK_BACKGROUND: [u8; 4] = [230, 230, 230, 255];

#[derive(Clone)]
pub struct ThumbnailService {
    config: Arc<Config>,
}

impl ThumbnailService {
    pub fn new(config: Arc<Config>) -> Self {
        Self { config }
    }

    pub fn is_model_file(&self, filename: &str) -> bool {
        let lower = filename.to_lowercase();
        lower.ends_with(".glb")
            || lower.ends_with(".gltf")
            || lower.ends_with(".fbx")
            || lower.ends_with(".obj")
    }

    /// Generate (or reuse) a thumbnail for a model file. Returns the stored
    /// relative thumbnail name on success.
    pub fn try_generate_model_thumbnail(
        &self,
        model_path: &str,
        file: &FileRow,
        user_id: i32,
    ) -> Option<String> {
        if !Path::new(model_path).is_file() {
            return None;
        }

        if let Some(existing) = &file.thumbnail_name {
            if !existing.trim().is_empty() {
                if let Some(path) = storage::thumbnail_path(&self.config, existing) {
                    if path.is_file() {
                        return Some(existing.clone());
                    }
                }
            }
        }

        let (name, output_path) =
            storage::thumbnail_output_path(&self.config, user_id, &file.public_id)?;

        if self.try_render_to_file(Some(model_path), &output_path, 512) {
            return Some(name);
        }

        if self.try_render_to_file(None, &output_path, 512) {
            return Some(name);
        }

        None
    }

    pub fn ensure_thumbnail_in_background(&self, model_path: String, file: FileRow, user_id: i32) {
        let service = self.clone();
        tokio::task::spawn_blocking(move || {
            let _ = service.try_generate_model_thumbnail(&model_path, &file, user_id);
        });
    }

    pub fn try_get_thumbnail_output_path(
        &self,
        user_id: i32,
        public_id: &str,
    ) -> Option<(String, PathBuf)> {
        storage::thumbnail_output_path(&self.config, user_id, public_id)
    }

    pub fn try_build_thumbnail_path(&self, file: &FileRow) -> Option<PathBuf> {
        let name = file.thumbnail_name.as_ref()?;
        if name.trim().is_empty() {
            return None;
        }
        storage::thumbnail_path(&self.config, name)
    }

    /// Move a file's thumbnail into the user's trash directory. Returns the new
    /// relative thumbnail name on success.
    pub fn try_move_thumbnail_to_trash(&self, file: &FileRow, user_id: i32) -> Option<String> {
        let current_name = file.thumbnail_name.as_ref()?;
        let next_name = storage::thumbnail_trash_name(current_name, user_id)?;

        let current_path = storage::thumbnail_path(&self.config, current_name)?;
        let target_path = storage::thumbnail_path(&self.config, &next_name)?;
        storage::ensure_parent_dir(&target_path).ok()?;
        if current_path.is_file() {
            std::fs::rename(&current_path, &target_path).ok()?;
        }
        Some(next_name)
    }

    /// Restore a file's thumbnail from the user's trash directory.
    pub fn try_restore_thumbnail_from_trash(&self, file: &FileRow, user_id: i32) -> Option<String> {
        let current_name = file.thumbnail_name.as_ref()?;
        let next_name = storage::thumbnail_restore_name(current_name, user_id)?;

        let current_path = storage::thumbnail_path(&self.config, current_name)?;
        let target_path = storage::thumbnail_path(&self.config, &next_name)?;
        storage::ensure_parent_dir(&target_path).ok()?;
        if current_path.is_file() {
            std::fs::rename(&current_path, &target_path).ok()?;
        }
        Some(next_name)
    }

    pub fn render_fallback_thumbnail(&self) -> TextureImage {
        SnapshotRenderer.render_fallback(512, 512, FALLBACK_BACKGROUND)
    }

    fn try_render_to_file(&self, model_path: Option<&str>, output_path: &Path, size: u32) -> bool {
        let renderer = SnapshotRenderer;
        let render_size = (size * 2).clamp(size, 1024);

        let image = match model_path {
            Some(path) => match self.render_model(path, render_size) {
                Ok(image) => image,
                Err(err) => {
                    tracing::warn!("failed to render model thumbnail: {err}");
                    return false;
                }
            },
            None => renderer.render_fallback(render_size, render_size, BACKGROUND),
        };

        let image = if render_size != size {
            resize_lanczos(&image, size, size)
        } else {
            image
        };

        if let Err(err) = storage::ensure_parent_dir(output_path) {
            tracing::warn!("failed to create thumbnail directory: {err}");
            return false;
        }

        match save_png(&image, output_path) {
            Ok(()) => true,
            Err(err) => {
                tracing::warn!("failed to save thumbnail: {err}");
                false
            }
        }
    }

    fn render_model(&self, model_path: &str, size: u32) -> Result<TextureImage, String> {
        let mut scene: ModelScene = ModelLoader::load(model_path)?;
        let bounds = BoundingBoxUtil.calculate(&scene);
        scene.normalization_offset = bounds.center.neg();
        let camera = CameraSetup.build(&bounds, Vec3::ZERO);
        let lights = LightingSetup.build(&camera);

        let animation = AnimationHandler;
        if let Some(snapshot_time) = animation.get_snapshot_time(&scene) {
            animation.seek(&mut scene, snapshot_time);
        }

        let renderer = SnapshotRenderer;
        warmup(
            &renderer, &scene, &camera, &lights, size, size, BACKGROUND, 10,
        );
        Ok(renderer.render(&scene, &camera, &lights, size, size, BACKGROUND))
    }
}

/// Box-filter downscale used as a stand-in for ImageSharp's Lanczos3 resample.
fn resize_lanczos(source: &TextureImage, target_w: u32, target_h: u32) -> TextureImage {
    let mut out = TextureImage::new(target_w, target_h);
    for y in 0..target_h {
        for x in 0..target_w {
            let src_x = ((x as f32 + 0.5) / target_w as f32 * source.width as f32) as u32;
            let src_y = ((y as f32 + 0.5) / target_h as f32 * source.height as f32) as u32;
            let src_x = src_x.min(source.width.saturating_sub(1));
            let src_y = src_y.min(source.height.saturating_sub(1));
            out.set(x, y, source.get(src_x, src_y));
        }
    }
    out
}

fn save_png(image: &TextureImage, path: &Path) -> Result<(), String> {
    let buffer = image::RgbaImage::from_raw(image.width, image.height, image.pixels.clone())
        .ok_or_else(|| "invalid image buffer".to_string())?;
    buffer
        .save_with_format(path, image::ImageFormat::Png)
        .map_err(|e| e.to_string())
}
