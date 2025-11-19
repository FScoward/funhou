use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use std::{
    io::{Read, Write},
    sync::{Arc, Mutex},
    thread::{self, JoinHandle},
};
use tauri::{Emitter, Window};

pub struct PtyState {
    pub pty_pair: Arc<Mutex<Option<PtyPair>>>,
    pub writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            pty_pair: Arc::new(Mutex::new(None)),
            writer: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub fn spawn_pty(
    state: tauri::State<'_, PtyState>,
    window: Window,
    cols: u16,
    rows: u16,
    initial_command: Option<String>,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let cmd = CommandBuilder::new("zsh"); // Default to zsh for macOS
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let mut writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    if let Some(command) = initial_command {
        write!(writer, "{}\n", command).map_err(|e| e.to_string())?;
    }

    *state.pty_pair.lock().unwrap() = Some(pair);
    *state.writer.lock().unwrap() = Some(writer);

    // Spawn a thread to read from the PTY and emit events
    thread::spawn(move || {
        let mut buffer = [0u8; 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(n) if n > 0 => {
                    let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                    if let Err(e) = window.emit("pty-output", data) {
                        eprintln!("Failed to emit pty-output: {}", e);
                        break;
                    }
                }
                Ok(_) => break, // EOF
                Err(e) => {
                    eprintln!("Error reading from PTY: {}", e);
                    break;
                }
            }
        }
        let _ = child.wait();
    });

    Ok(())
}

#[tauri::command]
pub fn write_pty(state: tauri::State<'_, PtyState>, data: String) -> Result<(), String> {
    if let Some(writer) = state.writer.lock().unwrap().as_mut() {
        write!(writer, "{}", data).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn resize_pty(state: tauri::State<'_, PtyState>, cols: u16, rows: u16) -> Result<(), String> {
    if let Some(pair) = state.pty_pair.lock().unwrap().as_ref() {
        pair.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
