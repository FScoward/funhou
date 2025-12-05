// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod autohide;
mod claude_logs;
mod speech;

use autohide::{AutohideConfig, AutohideManager, ScreenEdge};
use speech::{SpeechManager, SpeechRecognitionState};
use font_kit::source::SystemSource;
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::{Manager, State};

/// Application state
pub struct AppState {
    autohide_manager: Mutex<AutohideManager>,
    speech_manager: Mutex<SpeechManager>,
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


/// Start speech recognition
#[tauri::command]
fn start_speech_recognition(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.speech_manager.lock().map_err(|e| e.to_string())?;
    manager.start_recognition(&app)
}

/// Stop speech recognition
#[tauri::command]
fn stop_speech_recognition(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.speech_manager.lock().map_err(|e| e.to_string())?;
    manager.stop_recognition(&app)
}

/// Get current speech recognition state
#[tauri::command]
fn get_speech_state(state: State<'_, AppState>) -> Result<SpeechRecognitionState, String> {
    let manager = state.speech_manager.lock().map_err(|e| e.to_string())?;
    manager.get_state()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            autohide_manager: Mutex::new(AutohideManager::new()),
            speech_manager: Mutex::new(SpeechManager::new()),
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
                    let main_x = 10; // タブの横に寄せる
                    let main_y = 100; // 100px from top

                    let _ = main_window.set_size(tauri::PhysicalSize::new(
                        (main_width as f64 * scale_factor) as u32,
                        window_height,
                    ));
                    let _ = main_window.set_position(tauri::PhysicalPosition::new(
                        (main_x as f64 * scale_factor) as i32,
                        (main_y as f64 * scale_factor) as i32,
                    ));

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
            start_speech_recognition,
            stop_speech_recognition,
            get_speech_state,
            claude_logs::list_claude_projects,
            claude_logs::list_claude_sessions,
            claude_logs::read_claude_session,
            claude_logs::launch_claude_code,
            claude_logs::resume_claude_code,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
