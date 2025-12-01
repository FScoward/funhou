use core_graphics::display::CGRect;
use serde::{Deserialize, Serialize};

/// Screen edge where the window can be hidden
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ScreenEdge {
    #[default]
    Left,
    Right,
}

impl ScreenEdge {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "right" => ScreenEdge::Right,
            _ => ScreenEdge::Left,
        }
    }
}

/// Monitor bounds information for multi-monitor support
#[derive(Debug, Clone)]
pub struct MonitorBounds {
    pub bounds: CGRect,
}

/// Autohide configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutohideConfig {
    pub enabled: bool,
    pub edge: ScreenEdge,
    /// Pixels visible when window is hidden (the "handle" width)
    pub visible_pixels: f64,
    /// Animation duration in milliseconds
    pub animation_duration_ms: u64,
}

impl Default for AutohideConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            edge: ScreenEdge::Left,
            visible_pixels: 8.0,
            animation_duration_ms: 200,
        }
    }
}

/// Window visibility state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowState {
    /// Window is hidden at screen edge (only handle visible)
    Hidden,
    /// Window is fully visible
    Visible,
}
