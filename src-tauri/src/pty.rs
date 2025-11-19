use portable_pty::{native_pty_system, Child, CommandBuilder, PtyPair, PtySize};
use std::{
    io::{Read, Write},
    sync::{Arc, Mutex},
    thread,
};
use tauri::{Emitter, Window};

pub struct PtyState {
    pub pty_pair: Arc<Mutex<Option<PtyPair>>>,
    pub writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
    pub child: Arc<Mutex<Option<Box<dyn Child + Send + Sync>>>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            pty_pair: Arc::new(Mutex::new(None)),
            writer: Arc::new(Mutex::new(None)),
            child: Arc::new(Mutex::new(None)),
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
    // Kill existing child if any
    if let Some(mut child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }

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
    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let mut writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    if let Some(command) = initial_command {
        write!(writer, "{}\n", command).map_err(|e| e.to_string())?;
    }

    *state.pty_pair.lock().unwrap() = Some(pair);
    *state.writer.lock().unwrap() = Some(writer);
    
    // Store child in state
    // We need to clone the Arc to pass to the thread, but we can't clone the Box<dyn Child>.
    // So we put the Box in the Arc<Mutex<Option<...>>> which is already done in PtyState.
    // But we need to put the *new* child into the state.
    *state.child.lock().unwrap() = Some(child);

    // Clone the Arc to pass to the thread
    let child_ref = state.child.clone();

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
        
        // Wait for child to exit to avoid zombies
        if let Some(child) = child_ref.lock().unwrap().as_mut() {
             let _ = child.wait();
        }
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

#[tauri::command]
pub fn kill_pty(state: tauri::State<'_, PtyState>) -> Result<(), String> {
    if let Some(mut child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    *state.pty_pair.lock().unwrap() = None;
    *state.writer.lock().unwrap() = None;
    Ok(())
}
