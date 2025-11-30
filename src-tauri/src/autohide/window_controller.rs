use crate::autohide::config::{AutohideConfig, MonitorBounds, ScreenEdge};
use core_graphics::display::CGDisplay;
use tauri::{PhysicalPosition, PhysicalSize, Window};

/// Window controller for positioning and showing/hiding the window
pub struct WindowController {
    /// Cached monitor bounds for performance
    monitor_bounds: Option<MonitorBounds>,
    /// Original window position (when visible)
    original_position: Option<PhysicalPosition<i32>>,
    /// Original window size
    window_size: Option<PhysicalSize<u32>>,
}

impl WindowController {
    pub fn new() -> Self {
        let mut controller = Self {
            monitor_bounds: None,
            original_position: None,
            window_size: None,
        };
        controller.refresh_monitor_bounds();
        controller
    }

    /// Refresh cached monitor bounds
    pub fn refresh_monitor_bounds(&mut self) {
        let main_display = CGDisplay::main();
        let main_bounds = main_display.bounds();
        self.monitor_bounds = Some(MonitorBounds {
            bounds: main_bounds,
        });
    }

    /// Cache window position and size
    pub fn cache_window_state(&mut self, window: &Window) -> Result<(), String> {
        self.original_position = window.outer_position().ok();
        self.window_size = window.outer_size().ok();

        if self.original_position.is_none() || self.window_size.is_none() {
            return Err("Failed to get window state".to_string());
        }
        Ok(())
    }

    /// Calculate hidden position for the window
    fn calculate_hidden_position(
        &self,
        config: &AutohideConfig,
    ) -> Result<PhysicalPosition<i32>, String> {
        let size = self.window_size.ok_or("Failed to get window size")?;
        let monitor = self.monitor_bounds.as_ref().ok_or("No monitor found")?;
        let bounds = &monitor.bounds;

        let hidden_pos = match config.edge {
            ScreenEdge::Left => PhysicalPosition::new(
                bounds.origin.x as i32 - size.width as i32 + config.visible_pixels as i32,
                self.original_position.map(|p| p.y).unwrap_or(100),
            ),
            ScreenEdge::Right => PhysicalPosition::new(
                (bounds.origin.x + bounds.size.width) as i32 - config.visible_pixels as i32,
                self.original_position.map(|p| p.y).unwrap_or(100),
            ),
        };

        Ok(hidden_pos)
    }

    /// Calculate visible position for the window (snapped to edge)
    fn calculate_visible_position(
        &self,
        config: &AutohideConfig,
    ) -> Result<PhysicalPosition<i32>, String> {
        let monitor = self.monitor_bounds.as_ref().ok_or("No monitor found")?;
        let bounds = &monitor.bounds;
        let size = self.window_size.ok_or("Window size not cached")?;

        let visible_pos = match config.edge {
            ScreenEdge::Left => PhysicalPosition::new(
                bounds.origin.x as i32,
                self.original_position.map(|p| p.y).unwrap_or(100),
            ),
            ScreenEdge::Right => PhysicalPosition::new(
                (bounds.origin.x + bounds.size.width) as i32 - size.width as i32,
                self.original_position.map(|p| p.y).unwrap_or(100),
            ),
        };

        Ok(visible_pos)
    }

    /// Move window to hidden position
    pub fn hide_window(
        &self,
        window: &Window,
        config: &AutohideConfig,
    ) -> Result<(), String> {
        let hidden_pos = self.calculate_hidden_position(config)?;
        window
            .set_position(tauri::Position::Physical(hidden_pos))
            .map_err(|e| e.to_string())
    }

    /// Move window to visible position
    pub fn show_window(
        &self,
        window: &Window,
        config: &AutohideConfig,
    ) -> Result<(), String> {
        let visible_pos = self.calculate_visible_position(config)?;
        window
            .set_position(tauri::Position::Physical(visible_pos))
            .map_err(|e| e.to_string())
    }

    /// Restore window to original position
    pub fn restore_original_position(&mut self, window: &Window) -> Result<(), String> {
        if let Some(pos) = self.original_position {
            window
                .set_position(tauri::Position::Physical(pos))
                .map_err(|e| e.to_string())?;
        }
        self.original_position = None;
        self.window_size = None;
        Ok(())
    }
}

impl Default for WindowController {
    fn default() -> Self {
        Self::new()
    }
}
