// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod autohide;

use autohide::{AutohideConfig, AutohideManager, ScreenEdge};
use font_kit::source::SystemSource;
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::{Manager, State};

/// Application state
pub struct AppState {
    autohide_manager: Mutex<AutohideManager>,
}

#[tauri::command]
fn get_system_fonts() -> Result<Vec<String>, String> {
    let source = SystemSource::new();
    let mut font_names = HashSet::new();

    // Get all font families
    let families = source.all_families().map_err(|e| e.to_string())?;

    for family in families {
        font_names.insert(family);
    }

    // Convert to sorted vector
    let mut fonts: Vec<String> = font_names.into_iter().collect();
    fonts.sort();

    Ok(fonts)
}

/// Enable or disable autohide mode
#[tauri::command]
fn set_autohide_enabled(
    enabled: bool,
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state
        .autohide_manager
        .lock()
        .map_err(|e| e.to_string())?;

    if enabled {
        manager.enable(&window)?;
    } else {
        manager.disable(&window)?;
    }

    Ok(())
}

/// Toggle sidebar visibility (Sidenotes-style)
/// Returns true if now visible, false if now hidden
#[tauri::command]
fn toggle_sidebar(
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let manager = state
        .autohide_manager
        .lock()
        .map_err(|e| e.to_string())?;

    manager.toggle(&window)
}

/// Set autohide edge (left or right)
#[tauri::command]
fn set_autohide_edge(edge: String, state: State<'_, AppState>) -> Result<(), String> {
    let manager = state
        .autohide_manager
        .lock()
        .map_err(|e| e.to_string())?;

    let screen_edge = ScreenEdge::from_str(&edge);
    manager.set_edge(screen_edge)?;

    Ok(())
}

/// Get current autohide config
#[tauri::command]
fn get_autohide_config(state: State<'_, AppState>) -> Result<AutohideConfig, String> {
    let manager = state
        .autohide_manager
        .lock()
        .map_err(|e| e.to_string())?;

    manager.get_config()
}

/// Check if sidebar is currently visible
#[tauri::command]
fn is_sidebar_visible(state: State<'_, AppState>) -> Result<bool, String> {
    let manager = state
        .autohide_manager
        .lock()
        .map_err(|e| e.to_string())?;

    Ok(manager.is_visible())
}

/// Toggle main window visibility (TabTab-style)
#[tauri::command]
fn toggle_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    if main_window.is_visible().unwrap_or(false) {
        main_window.hide().map_err(|e| e.to_string())?;
    } else {
        main_window.show().map_err(|e| e.to_string())?;
        main_window.set_focus().map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(AppState {
            autohide_manager: Mutex::new(AutohideManager::new()),
        })
        .setup(|app| {
            // Get primary monitor size and adjust window heights
            if let Some(main_window) = app.get_webview_window("main") {
                if let Some(monitor) = main_window.primary_monitor().ok().flatten() {
                    let screen_size = monitor.size();
                    let scale_factor = monitor.scale_factor();

                    // Calculate height (leave 100px margin top and bottom)
                    let vertical_margin = 100.0;
                    let window_height = (screen_size.height as f64 - vertical_margin * 2.0 * scale_factor) as u32;

                    // Set main window size and position
                    let main_width = 430;
                    let main_x = 20;
                    let main_y = 100; // 100px from top

                    let _ = main_window.set_size(tauri::PhysicalSize::new(
                        (main_width as f64 * scale_factor) as u32,
                        window_height,
                    ));
                    let _ = main_window.set_position(tauri::PhysicalPosition::new(
                        (main_x as f64 * scale_factor) as i32,
                        (main_y as f64 * scale_factor) as i32,
                    ));

                    // Set tab window size and position
                    let tab_width = 20;
                    if let Some(tab_window) = app.get_webview_window("tab") {
                        let _ = tab_window.set_size(tauri::PhysicalSize::new(
                            (tab_width as f64 * scale_factor) as u32,
                            window_height,
                        ));
                        let _ = tab_window.set_position(tauri::PhysicalPosition::new(
                            0,
                            (main_y as f64 * scale_factor) as i32,
                        ));
                    }

                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_fonts,
            set_autohide_enabled,
            toggle_sidebar,
            set_autohide_edge,
            get_autohide_config,
            is_sidebar_visible,
            toggle_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
