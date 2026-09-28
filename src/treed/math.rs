//! Minimal math primitives matching the exact semantics of `System.Numerics`
//! (row-vector / row-major convention) so the rasteriser port is behaviourally
//! identical to the original C# implementation.

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

impl Vec2 {
    pub const fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

// Method names intentionally mirror `System.Numerics.Vector3`/`Matrix4x4` from
// the original C# so the ported math reads the same; do not rename to operators.
#[allow(clippy::should_implement_trait)]
impl Vec3 {
    pub const ZERO: Vec3 = Vec3 {
        x: 0.0,
        y: 0.0,
        z: 0.0,
    };
    pub const ONE: Vec3 = Vec3 {
        x: 1.0,
        y: 1.0,
        z: 1.0,
    };
    pub const UNIT_X: Vec3 = Vec3 {
        x: 1.0,
        y: 0.0,
        z: 0.0,
    };
    pub const UNIT_Y: Vec3 = Vec3 {
        x: 0.0,
        y: 1.0,
        z: 0.0,
    };
    pub const UNIT_Z: Vec3 = Vec3 {
        x: 0.0,
        y: 0.0,
        z: 1.0,
    };

    pub const fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    pub fn add(self, o: Vec3) -> Vec3 {
        Vec3::new(self.x + o.x, self.y + o.y, self.z + o.z)
    }

    pub fn sub(self, o: Vec3) -> Vec3 {
        Vec3::new(self.x - o.x, self.y - o.y, self.z - o.z)
    }

    pub fn mul_scalar(self, s: f32) -> Vec3 {
        Vec3::new(self.x * s, self.y * s, self.z * s)
    }

    pub fn mul(self, o: Vec3) -> Vec3 {
        Vec3::new(self.x * o.x, self.y * o.y, self.z * o.z)
    }

    pub fn div_scalar(self, s: f32) -> Vec3 {
        Vec3::new(self.x / s, self.y / s, self.z / s)
    }

    pub fn neg(self) -> Vec3 {
        Vec3::new(-self.x, -self.y, -self.z)
    }

    pub fn dot(self, o: Vec3) -> f32 {
        self.x * o.x + self.y * o.y + self.z * o.z
    }

    pub fn cross(self, o: Vec3) -> Vec3 {
        Vec3::new(
            self.y * o.z - self.z * o.y,
            self.z * o.x - self.x * o.z,
            self.x * o.y - self.y * o.x,
        )
    }

    pub fn length(self) -> f32 {
        self.dot(self).sqrt()
    }

    pub fn normalize(self) -> Vec3 {
        let len = self.length();
        if len <= f32::EPSILON {
            Vec3::ZERO
        } else {
            self.div_scalar(len)
        }
    }

    pub fn min(self, o: Vec3) -> Vec3 {
        Vec3::new(self.x.min(o.x), self.y.min(o.y), self.z.min(o.z))
    }

    pub fn max(self, o: Vec3) -> Vec3 {
        Vec3::new(self.x.max(o.x), self.y.max(o.y), self.z.max(o.z))
    }

    pub fn lerp(a: Vec3, b: Vec3, t: f32) -> Vec3 {
        Vec3::new(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t,
            a.z + (b.z - a.z) * t,
        )
    }

    pub fn is_nan(self) -> bool {
        self.x.is_nan() || self.y.is_nan() || self.z.is_nan()
    }

    /// `System.Numerics.Vector3.Transform(position, matrix)`.
    pub fn transform_position(self, m: &Mat4) -> Vec3 {
        Vec3::new(
            self.x * m.m11 + self.y * m.m21 + self.z * m.m31 + m.m41,
            self.x * m.m12 + self.y * m.m22 + self.z * m.m32 + m.m42,
            self.x * m.m13 + self.y * m.m23 + self.z * m.m33 + m.m43,
        )
    }

    /// `System.Numerics.Vector3.TransformNormal(normal, matrix)`.
    pub fn transform_normal(self, m: &Mat4) -> Vec3 {
        Vec3::new(
            self.x * m.m11 + self.y * m.m21 + self.z * m.m31,
            self.x * m.m12 + self.y * m.m22 + self.z * m.m32,
            self.x * m.m13 + self.y * m.m23 + self.z * m.m33,
        )
    }
}

impl std::ops::Add for Vec3 {
    type Output = Vec3;
    fn add(self, o: Vec3) -> Vec3 {
        Vec3::new(self.x + o.x, self.y + o.y, self.z + o.z)
    }
}

impl std::ops::Sub for Vec3 {
    type Output = Vec3;
    fn sub(self, o: Vec3) -> Vec3 {
        Vec3::new(self.x - o.x, self.y - o.y, self.z - o.z)
    }
}

impl std::ops::Mul<f32> for Vec3 {
    type Output = Vec3;
    fn mul(self, s: f32) -> Vec3 {
        self.mul_scalar(s)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Vec4 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub w: f32,
}

impl Vec4 {
    pub const fn new(x: f32, y: f32, z: f32, w: f32) -> Self {
        Self { x, y, z, w }
    }

    /// `System.Numerics.Vector4.Transform(vector, matrix)`.
    pub fn transform(self, m: &Mat4) -> Vec4 {
        Vec4::new(
            self.x * m.m11 + self.y * m.m21 + self.z * m.m31 + self.w * m.m41,
            self.x * m.m12 + self.y * m.m22 + self.z * m.m32 + self.w * m.m42,
            self.x * m.m13 + self.y * m.m23 + self.z * m.m33 + self.w * m.m43,
            self.x * m.m14 + self.y * m.m24 + self.z * m.m34 + self.w * m.m44,
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Mat4 {
    pub m11: f32,
    pub m12: f32,
    pub m13: f32,
    pub m14: f32,
    pub m21: f32,
    pub m22: f32,
    pub m23: f32,
    pub m24: f32,
    pub m31: f32,
    pub m32: f32,
    pub m33: f32,
    pub m34: f32,
    pub m41: f32,
    pub m42: f32,
    pub m43: f32,
    pub m44: f32,
}

impl Default for Mat4 {
    fn default() -> Self {
        Self::IDENTITY
    }
}

impl Mat4 {
    pub const IDENTITY: Mat4 = Mat4 {
        m11: 1.0,
        m12: 0.0,
        m13: 0.0,
        m14: 0.0,
        m21: 0.0,
        m22: 1.0,
        m23: 0.0,
        m24: 0.0,
        m31: 0.0,
        m32: 0.0,
        m33: 1.0,
        m34: 0.0,
        m41: 0.0,
        m42: 0.0,
        m43: 0.0,
        m44: 1.0,
    };

    #[allow(clippy::too_many_arguments)]
    pub const fn new(
        m11: f32,
        m12: f32,
        m13: f32,
        m14: f32,
        m21: f32,
        m22: f32,
        m23: f32,
        m24: f32,
        m31: f32,
        m32: f32,
        m33: f32,
        m34: f32,
        m41: f32,
        m42: f32,
        m43: f32,
        m44: f32,
    ) -> Self {
        Self {
            m11,
            m12,
            m13,
            m14,
            m21,
            m22,
            m23,
            m24,
            m31,
            m32,
            m33,
            m34,
            m41,
            m42,
            m43,
            m44,
        }
    }

    /// Row-major matrix product `a * b` (`System.Numerics.Matrix4x4.Multiply`).
    pub fn multiply(a: &Mat4, b: &Mat4) -> Mat4 {
        Mat4 {
            m11: a.m11 * b.m11 + a.m12 * b.m21 + a.m13 * b.m31 + a.m14 * b.m41,
            m12: a.m11 * b.m12 + a.m12 * b.m22 + a.m13 * b.m32 + a.m14 * b.m42,
            m13: a.m11 * b.m13 + a.m12 * b.m23 + a.m13 * b.m33 + a.m14 * b.m43,
            m14: a.m11 * b.m14 + a.m12 * b.m24 + a.m13 * b.m34 + a.m14 * b.m44,
            m21: a.m21 * b.m11 + a.m22 * b.m21 + a.m23 * b.m31 + a.m24 * b.m41,
            m22: a.m21 * b.m12 + a.m22 * b.m22 + a.m23 * b.m32 + a.m24 * b.m42,
            m23: a.m21 * b.m13 + a.m22 * b.m23 + a.m23 * b.m33 + a.m24 * b.m43,
            m24: a.m21 * b.m14 + a.m22 * b.m24 + a.m23 * b.m34 + a.m24 * b.m44,
            m31: a.m31 * b.m11 + a.m32 * b.m21 + a.m33 * b.m31 + a.m34 * b.m41,
            m32: a.m31 * b.m12 + a.m32 * b.m22 + a.m33 * b.m32 + a.m34 * b.m42,
            m33: a.m31 * b.m13 + a.m32 * b.m23 + a.m33 * b.m33 + a.m34 * b.m43,
            m34: a.m31 * b.m14 + a.m32 * b.m24 + a.m33 * b.m34 + a.m34 * b.m44,
            m41: a.m41 * b.m11 + a.m42 * b.m21 + a.m43 * b.m31 + a.m44 * b.m41,
            m42: a.m41 * b.m12 + a.m42 * b.m22 + a.m43 * b.m32 + a.m44 * b.m42,
            m43: a.m41 * b.m13 + a.m42 * b.m23 + a.m43 * b.m33 + a.m44 * b.m43,
            m44: a.m41 * b.m14 + a.m42 * b.m24 + a.m43 * b.m34 + a.m44 * b.m44,
        }
    }

    pub fn transpose(m: &Mat4) -> Mat4 {
        Mat4 {
            m11: m.m11,
            m12: m.m21,
            m13: m.m31,
            m14: m.m41,
            m21: m.m12,
            m22: m.m22,
            m23: m.m32,
            m24: m.m42,
            m31: m.m13,
            m32: m.m23,
            m33: m.m33,
            m34: m.m43,
            m41: m.m14,
            m42: m.m24,
            m43: m.m34,
            m44: m.m44,
        }
    }

    pub fn create_translation(t: Vec3) -> Mat4 {
        Mat4 {
            m41: t.x,
            m42: t.y,
            m43: t.z,
            ..Mat4::IDENTITY
        }
    }

    pub fn create_scale(s: Vec3) -> Mat4 {
        Mat4 {
            m11: s.x,
            m22: s.y,
            m33: s.z,
            ..Mat4::IDENTITY
        }
    }

    pub fn create_from_quaternion(q: Quat) -> Mat4 {
        let xx = q.x * q.x;
        let yy = q.y * q.y;
        let zz = q.z * q.z;
        let xy = q.x * q.y;
        let wz = q.w * q.z;
        let xz = q.x * q.z;
        let wy = q.w * q.y;
        let yz = q.y * q.z;
        let wx = q.w * q.x;

        Mat4 {
            m11: 1.0 - 2.0 * (yy + zz),
            m12: 2.0 * (xy + wz),
            m13: 2.0 * (xz - wy),
            m14: 0.0,
            m21: 2.0 * (xy - wz),
            m22: 1.0 - 2.0 * (zz + xx),
            m23: 2.0 * (yz + wx),
            m24: 0.0,
            m31: 2.0 * (xz + wy),
            m32: 2.0 * (yz - wx),
            m33: 1.0 - 2.0 * (yy + xx),
            m34: 0.0,
            m41: 0.0,
            m42: 0.0,
            m43: 0.0,
            m44: 1.0,
        }
    }

    /// `System.Numerics.Matrix4x4.CreateLookAt`.
    pub fn create_look_at(camera_position: Vec3, camera_target: Vec3, camera_up: Vec3) -> Mat4 {
        let zaxis = camera_position.sub(camera_target).normalize();
        let xaxis = camera_up.cross(zaxis).normalize();
        let yaxis = zaxis.cross(xaxis);
        Mat4 {
            m11: xaxis.x,
            m12: yaxis.x,
            m13: zaxis.x,
            m14: 0.0,
            m21: xaxis.y,
            m22: yaxis.y,
            m23: zaxis.y,
            m24: 0.0,
            m31: xaxis.z,
            m32: yaxis.z,
            m33: zaxis.z,
            m34: 0.0,
            m41: -xaxis.dot(camera_position),
            m42: -yaxis.dot(camera_position),
            m43: -zaxis.dot(camera_position),
            m44: 1.0,
        }
    }

    /// `System.Numerics.Matrix4x4.CreatePerspectiveFieldOfView`.
    pub fn create_perspective_fov(fov: f32, aspect: f32, near: f32, far: f32) -> Mat4 {
        let y_scale = 1.0 / (fov * 0.5).tan();
        let x_scale = y_scale / aspect;
        Mat4 {
            m11: x_scale,
            m12: 0.0,
            m13: 0.0,
            m14: 0.0,
            m21: 0.0,
            m22: y_scale,
            m23: 0.0,
            m24: 0.0,
            m31: 0.0,
            m32: 0.0,
            m33: far / (near - far),
            m34: -1.0,
            m41: 0.0,
            m42: 0.0,
            m43: near * far / (near - far),
            m44: 0.0,
        }
    }

    /// `System.Numerics.Matrix4x4.Invert`; returns `None` for singular matrices.
    pub fn invert(m: &Mat4) -> Option<Mat4> {
        let a = [
            [m.m11, m.m12, m.m13, m.m14],
            [m.m21, m.m22, m.m23, m.m24],
            [m.m31, m.m32, m.m33, m.m34],
            [m.m41, m.m42, m.m43, m.m44],
        ];

        let mut inv = [[0f32; 4]; 4];
        inv[0][0] =
            a[1][1] * a[2][2] * a[3][3] - a[1][1] * a[2][3] * a[3][2] - a[2][1] * a[1][2] * a[3][3]
                + a[2][1] * a[1][3] * a[3][2]
                + a[3][1] * a[1][2] * a[2][3]
                - a[3][1] * a[1][3] * a[2][2];
        inv[1][0] = -a[1][0] * a[2][2] * a[3][3]
            + a[1][0] * a[2][3] * a[3][2]
            + a[2][0] * a[1][2] * a[3][3]
            - a[2][0] * a[1][3] * a[3][2]
            - a[3][0] * a[1][2] * a[2][3]
            + a[3][0] * a[1][3] * a[2][2];
        inv[2][0] =
            a[1][0] * a[2][1] * a[3][3] - a[1][0] * a[2][3] * a[3][1] - a[2][0] * a[1][1] * a[3][3]
                + a[2][0] * a[1][3] * a[3][1]
                + a[3][0] * a[1][1] * a[2][3]
                - a[3][0] * a[1][3] * a[2][1];
        inv[3][0] = -a[1][0] * a[2][1] * a[3][2]
            + a[1][0] * a[2][2] * a[3][1]
            + a[2][0] * a[1][1] * a[3][2]
            - a[2][0] * a[1][2] * a[3][1]
            - a[3][0] * a[1][1] * a[2][2]
            + a[3][0] * a[1][2] * a[2][1];
        inv[0][1] = -a[0][1] * a[2][2] * a[3][3]
            + a[0][1] * a[2][3] * a[3][2]
            + a[2][1] * a[0][2] * a[3][3]
            - a[2][1] * a[0][3] * a[3][2]
            - a[3][1] * a[0][2] * a[2][3]
            + a[3][1] * a[0][3] * a[2][2];
        inv[1][1] =
            a[0][0] * a[2][2] * a[3][3] - a[0][0] * a[2][3] * a[3][2] - a[2][0] * a[0][2] * a[3][3]
                + a[2][0] * a[0][3] * a[3][2]
                + a[3][0] * a[0][2] * a[2][3]
                - a[3][0] * a[0][3] * a[2][2];
        inv[2][1] = -a[0][0] * a[2][1] * a[3][3]
            + a[0][0] * a[2][3] * a[3][1]
            + a[2][0] * a[0][1] * a[3][3]
            - a[2][0] * a[0][3] * a[3][1]
            - a[3][0] * a[0][1] * a[2][3]
            + a[3][0] * a[0][3] * a[2][1];
        inv[3][1] =
            a[0][0] * a[2][1] * a[3][2] - a[0][0] * a[2][2] * a[3][1] - a[2][0] * a[0][1] * a[3][2]
                + a[2][0] * a[0][2] * a[3][1]
                + a[3][0] * a[0][1] * a[2][2]
                - a[3][0] * a[0][2] * a[2][1];
        inv[0][2] =
            a[0][1] * a[1][2] * a[3][3] - a[0][1] * a[1][3] * a[3][2] - a[1][1] * a[0][2] * a[3][3]
                + a[1][1] * a[0][3] * a[3][2]
                + a[3][1] * a[0][2] * a[1][3]
                - a[3][1] * a[0][3] * a[1][2];
        inv[1][2] = -a[0][0] * a[1][2] * a[3][3]
            + a[0][0] * a[1][3] * a[3][2]
            + a[1][0] * a[0][2] * a[3][3]
            - a[1][0] * a[0][3] * a[3][2]
            - a[3][0] * a[0][2] * a[1][3]
            + a[3][0] * a[0][3] * a[1][2];
        inv[2][2] =
            a[0][0] * a[1][1] * a[3][3] - a[0][0] * a[1][3] * a[3][1] - a[1][0] * a[0][1] * a[3][3]
                + a[1][0] * a[0][3] * a[3][1]
                + a[3][0] * a[0][1] * a[1][3]
                - a[3][0] * a[0][3] * a[1][1];
        inv[3][2] = -a[0][0] * a[1][1] * a[3][2]
            + a[0][0] * a[1][2] * a[3][1]
            + a[1][0] * a[0][1] * a[3][2]
            - a[1][0] * a[0][2] * a[3][1]
            - a[3][0] * a[0][1] * a[1][2]
            + a[3][0] * a[0][2] * a[1][1];
        inv[0][3] = -a[0][1] * a[1][2] * a[2][3]
            + a[0][1] * a[1][3] * a[2][2]
            + a[1][1] * a[0][2] * a[2][3]
            - a[1][1] * a[0][3] * a[2][2]
            - a[2][1] * a[0][2] * a[1][3]
            + a[2][1] * a[0][3] * a[1][2];
        inv[1][3] =
            a[0][0] * a[1][2] * a[2][3] - a[0][0] * a[1][3] * a[2][2] - a[1][0] * a[0][2] * a[2][3]
                + a[1][0] * a[0][3] * a[2][2]
                + a[2][0] * a[0][2] * a[1][3]
                - a[2][0] * a[0][3] * a[1][2];
        inv[2][3] = -a[0][0] * a[1][1] * a[2][3]
            + a[0][0] * a[1][3] * a[2][1]
            + a[1][0] * a[0][1] * a[2][3]
            - a[1][0] * a[0][3] * a[2][1]
            - a[2][0] * a[0][1] * a[1][3]
            + a[2][0] * a[0][3] * a[1][1];
        inv[3][3] =
            a[0][0] * a[1][1] * a[2][2] - a[0][0] * a[1][2] * a[2][1] - a[1][0] * a[0][1] * a[2][2]
                + a[1][0] * a[0][2] * a[2][1]
                + a[2][0] * a[0][1] * a[1][2]
                - a[2][0] * a[0][2] * a[1][1];

        let det =
            a[0][0] * inv[0][0] + a[0][1] * inv[1][0] + a[0][2] * inv[2][0] + a[0][3] * inv[3][0];
        if det == 0.0 {
            return None;
        }
        let inv_det = 1.0 / det;
        for row in inv.iter_mut() {
            for value in row.iter_mut() {
                *value *= inv_det;
            }
        }

        Some(Mat4 {
            m11: inv[0][0],
            m12: inv[0][1],
            m13: inv[0][2],
            m14: inv[0][3],
            m21: inv[1][0],
            m22: inv[1][1],
            m23: inv[1][2],
            m24: inv[1][3],
            m31: inv[2][0],
            m32: inv[2][1],
            m33: inv[2][2],
            m34: inv[2][3],
            m41: inv[3][0],
            m42: inv[3][1],
            m43: inv[3][2],
            m44: inv[3][3],
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Quat {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub w: f32,
}

impl Quat {
    pub const IDENTITY: Quat = Quat {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        w: 1.0,
    };

    pub const fn new(x: f32, y: f32, z: f32, w: f32) -> Self {
        Self { x, y, z, w }
    }

    /// `System.Numerics.Quaternion.Slerp`.
    pub fn slerp(a: Quat, b: Quat, t: f32) -> Quat {
        let mut cos_omega = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
        let mut b = b;
        if cos_omega < 0.0 {
            cos_omega = -cos_omega;
            b = Quat::new(-b.x, -b.y, -b.z, -b.w);
        }

        if cos_omega > 0.999999 {
            return Quat::new(
                a.x + (b.x - a.x) * t,
                a.y + (b.y - a.y) * t,
                a.z + (b.z - a.z) * t,
                a.w + (b.w - a.w) * t,
            );
        }

        let sin_omega = (1.0 - cos_omega * cos_omega).sqrt();
        let omega = sin_omega.atan2(cos_omega);
        let inv_sin = 1.0 / sin_omega;
        let scale0 = ((1.0 - t) * omega).sin() * inv_sin;
        let scale1 = (t * omega).sin() * inv_sin;
        Quat::new(
            a.x * scale0 + b.x * scale1,
            a.y * scale0 + b.y * scale1,
            a.z * scale0 + b.z * scale1,
            a.w * scale0 + b.w * scale1,
        )
    }
}
