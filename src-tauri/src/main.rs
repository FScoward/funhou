// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod pty;

use font_kit::source::SystemSource;
use std::collections::HashSet;

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:funhou.db", vec![
                    tauri_plugin_sql::Migration {
                        version: 1,
                        description: "create_terminal_sessions_table",
                        sql: "CREATE TABLE IF NOT EXISTS terminal_sessions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            entry_id INTEGER NOT NULL,
                            output TEXT NOT NULL DEFAULT '',
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
                        );",
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }
                ])
                .build(),
        )
        .manage(pty::PtyState::default())
        .invoke_handler(tauri::generate_handler![
            get_system_fonts,
            pty::spawn_pty,
            pty::write_pty,
            pty::resize_pty,
            pty::kill_pty
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
