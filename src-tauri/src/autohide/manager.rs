use crate::autohide::config::{AutohideConfig, ScreenEdge, WindowState};
use crate::autohide::window_controller::WindowController;
use std::sync::Mutex;
use tauri::Window;

/// Autohide manager - Sidenotes-style toggle sidebar
///
/// The window slides in/out from the screen edge when toggled.
/// A small portion remains visible as a "handle" when hidden.
pub struct AutohideManager {
    config: Mutex<AutohideConfig>,
    state: Mutex<WindowState>,
    window_controller: Mutex<WindowController>,
}

impl AutohideManager {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(AutohideConfig::default()),
            state: Mutex::new(WindowState::Visible),
            window_controller: Mutex::new(WindowController::new()),
        }
    }

    /// Enable autohide mode - moves window to hidden position
    pub fn enable(&self, window: &Window) -> Result<(), String> {
        // Update config
        {
            let mut config = self.config.lock().map_err(|e| e.to_string())?;
            config.enabled = true;
        }

        // Cache window state
        {
            let mut controller = self.window_controller.lock().map_err(|e| e.to_string())?;
            controller.cache_window_state(window)?;
        }

        // Hide window initially
        self.hide(window)?;

        Ok(())
    }

    /// Disable autohide mode - restores window to original position
    pub fn disable(&self, window: &Window) -> Result<(), String> {
        // Update config
        {
            let mut config = self.config.lock().map_err(|e| e.to_string())?;
            config.enabled = false;
        }

        // Restore original position
        {
            let mut controller = self.window_controller.lock().map_err(|e| e.to_string())?;
            controller.restore_original_position(window)?;
        }

        // Update state
        {
            let mut state = self.state.lock().map_err(|e| e.to_string())?;
            *state = WindowState::Visible;
        }

        Ok(())
    }

    /// Toggle window visibility (show/hide)
    pub fn toggle(&self, window: &Window) -> Result<bool, String> {
        let current_state = {
            let state = self.state.lock().map_err(|e| e.to_string())?;
            *state
        };

        match current_state {
            WindowState::Hidden => {
                self.show(window)?;
                Ok(true) // Now visible
            }
            WindowState::Visible => {
                self.hide(window)?;
                Ok(false) // Now hidden
            }
        }
    }

    /// Show the window (slide in from edge)
    pub fn show(&self, window: &Window) -> Result<(), String> {
        let config = self.config.lock().map_err(|e| e.to_string())?;

        if !config.enabled {
            return Ok(());
        }

        let controller = self.window_controller.lock().map_err(|e| e.to_string())?;
        controller.show_window(window, &config)?;

        drop(config);
        drop(controller);

        let mut state = self.state.lock().map_err(|e| e.to_string())?;
        *state = WindowState::Visible;

        Ok(())
    }

    /// Hide the window (slide out to edge, leaving handle visible)
    pub fn hide(&self, window: &Window) -> Result<(), String> {
        let config = self.config.lock().map_err(|e| e.to_string())?;

        if !config.enabled {
            return Ok(());
        }

        let controller = self.window_controller.lock().map_err(|e| e.to_string())?;
        controller.hide_window(window, &config)?;

        drop(config);
        drop(controller);

        let mut state = self.state.lock().map_err(|e| e.to_string())?;
        *state = WindowState::Hidden;

        Ok(())
    }

    /// Set autohide edge
    pub fn set_edge(&self, edge: ScreenEdge) -> Result<(), String> {
        let mut config = self.config.lock().map_err(|e| e.to_string())?;
        config.edge = edge;
        Ok(())
    }

    /// Get current config
    pub fn get_config(&self) -> Result<AutohideConfig, String> {
        let config = self.config.lock().map_err(|e| e.to_string())?;
        Ok(config.clone())
    }

    /// Check if autohide is enabled
    pub fn is_enabled(&self) -> bool {
        self.config
            .lock()
            .map(|c| c.enabled)
            .unwrap_or(false)
    }

    /// Check if window is currently visible
    pub fn is_visible(&self) -> bool {
        self.state
            .lock()
            .map(|s| *s == WindowState::Visible)
            .unwrap_or(true)
    }
}

impl Default for AutohideManager {
    fn default() -> Self {
        Self::new()
    }
}
