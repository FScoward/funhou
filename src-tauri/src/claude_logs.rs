use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Emitter;

/// Claude Code session log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeLogEntry {
    #[serde(rename = "type")]
    pub entry_type: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub message: Option<ClaudeMessage>,
    pub timestamp: Option<String>,
    pub cwd: Option<String>,
    #[serde(rename = "gitBranch")]
    pub git_branch: Option<String>,
    pub uuid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeMessage {
    pub role: Option<String>,
    pub content: Option<serde_json::Value>,
}

/// Parsed conversation message for display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

/// Session summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub session_id: String,
    pub project_path: String,
    pub cwd: Option<String>,
    pub git_branch: Option<String>,
    pub first_message: Option<String>,
    pub timestamp: Option<String>,
    pub message_count: usize,
}

/// Project directory info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub session_count: usize,
    pub last_updated: Option<String>,
}

/// Claude session finished event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSessionFinishedPayload {
    pub session_id: String,
    pub success: bool,
    pub exit_code: Option<i32>,
}

/// Get Claude logs directory path
fn get_claude_logs_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let claude_projects = home.join(".claude").join("projects");

    if !claude_projects.exists() {
        return Err("Claude projects directory not found".to_string());
    }

    Ok(claude_projects)
}

/// List all projects with Claude Code sessions
#[tauri::command]
pub fn list_claude_projects() -> Result<Vec<ProjectInfo>, String> {
    let projects_dir = get_claude_logs_dir()?;

    let mut projects = Vec::new();

    let entries = fs::read_dir(&projects_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            let dir_name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            // Count session files and find the newest one
            let mut session_count = 0;
            let mut newest_modified: Option<std::time::SystemTime> = None;

            if let Ok(dir_entries) = fs::read_dir(&path) {
                for dir_entry in dir_entries.flatten() {
                    let file_path = dir_entry.path();
                    if file_path.extension().map(|ext| ext == "jsonl").unwrap_or(false) {
                        session_count += 1;
                        // Get file modification time
                        if let Ok(metadata) = fs::metadata(&file_path) {
                            if let Ok(modified) = metadata.modified() {
                                if newest_modified.is_none() || Some(modified) > newest_modified {
                                    newest_modified = Some(modified);
                                }
                            }
                        }
                    }
                }
            }

            if session_count > 0 {
                // Convert SystemTime to ISO 8601 string
                let last_updated = newest_modified.map(|t| {
                    let datetime: chrono::DateTime<chrono::Utc> = t.into();
                    datetime.to_rfc3339()
                });

                projects.push(ProjectInfo {
                    name: dir_name.replace("-", "/"),
                    path: path.to_string_lossy().to_string(),
                    session_count,
                    last_updated,
                });
            }
        }
    }

    // Sort by last_updated descending (newest first)
    projects.sort_by(|a, b| b.last_updated.cmp(&a.last_updated));

    Ok(projects)
}

/// List sessions for a specific project
#[tauri::command]
pub fn list_claude_sessions(project_path: String) -> Result<Vec<SessionSummary>, String> {
    let project_dir = PathBuf::from(&project_path);

    if !project_dir.exists() {
        return Err("Project directory not found".to_string());
    }

    let mut sessions = Vec::new();

    let entries = fs::read_dir(&project_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.extension().map(|ext| ext == "jsonl").unwrap_or(false) {
            let session_id = path.file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            // Read first few lines to get summary
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let lines: Vec<&str> = content.lines().take(10).collect();

            let mut first_message = None;
            let mut timestamp = None;
            let mut git_branch = None;
            let mut cwd = None;

            for line in &lines {
                if let Ok(entry) = serde_json::from_str::<ClaudeLogEntry>(line) {
                    // Get cwd from the first entry that has it
                    if cwd.is_none() {
                        cwd = entry.cwd.clone();
                    }
                    if entry.entry_type.as_deref() == Some("user") {
                        if first_message.is_none() {
                            if let Some(msg) = &entry.message {
                                first_message = extract_text_content(&msg.content);
                            }
                            timestamp = entry.timestamp.clone();
                            git_branch = entry.git_branch.clone();
                        }
                    }
                }
            }

            // Count total messages
            let message_count = content.lines()
                .filter(|line| {
                    serde_json::from_str::<ClaudeLogEntry>(line)
                        .map(|e| e.entry_type.as_deref() == Some("user") || e.entry_type.as_deref() == Some("assistant"))
                        .unwrap_or(false)
                })
                .count();

            sessions.push(SessionSummary {
                session_id,
                project_path: project_path.clone(),
                cwd,
                git_branch,
                first_message,
                timestamp,
                message_count,
            });
        }
    }

    // Sort by timestamp descending
    sessions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(sessions)
}

/// Read a specific session's conversation
#[tauri::command]
pub fn read_claude_session(project_path: String, session_id: String) -> Result<Vec<ConversationMessage>, String> {
    let session_file = PathBuf::from(&project_path).join(format!("{}.jsonl", session_id));

    if !session_file.exists() {
        return Err("Session file not found".to_string());
    }

    let content = fs::read_to_string(&session_file).map_err(|e| e.to_string())?;

    let mut messages = Vec::new();

    for line in content.lines() {
        if let Ok(entry) = serde_json::from_str::<ClaudeLogEntry>(line) {
            let entry_type = entry.entry_type.as_deref();

            if entry_type == Some("user") || entry_type == Some("assistant") {
                if let Some(msg) = &entry.message {
                    if let Some(text) = extract_text_content(&msg.content) {
                        messages.push(ConversationMessage {
                            role: msg.role.clone().unwrap_or_else(|| entry_type.unwrap_or("unknown").to_string()),
                            content: text,
                            timestamp: entry.timestamp.clone().unwrap_or_default(),
                        });
                    }
                }
            }
        }
    }

    Ok(messages)
}

/// Extract text content from message content (handles both string and array formats)
fn extract_text_content(content: &Option<serde_json::Value>) -> Option<String> {
    match content {
        Some(serde_json::Value::String(s)) => Some(s.clone()),
        Some(serde_json::Value::Array(arr)) => {
            let texts: Vec<String> = arr.iter()
                .filter_map(|item| {
                    if let Some(obj) = item.as_object() {
                        if obj.get("type").and_then(|t| t.as_str()) == Some("text") {
                            return obj.get("text").and_then(|t| t.as_str()).map(|s| s.to_string());
                        }
                    }
                    None
                })
                .collect();

            if texts.is_empty() {
                None
            } else {
                Some(texts.join("\n"))
            }
        }
        _ => None,
    }
}

/// Launch Claude Code with specified working directory and optional prompt
#[tauri::command]
pub fn launch_claude_code(cwd: String, prompt: Option<String>) -> Result<(), String> {
    // Build the claude command with arguments
    let claude_cmd = if let Some(p) = prompt {
        // Escape single quotes in the prompt for shell
        let escaped_prompt = p.replace("'", "'\\''");
        format!("cd '{}' && claude -p '{}'", cwd.replace("'", "'\\''"), escaped_prompt)
    } else {
        format!("cd '{}' && claude", cwd.replace("'", "'\\''"))
    };

    // Use login shell to inherit user's PATH (including claude command)
    let mut cmd = Command::new("/bin/zsh");
    cmd.arg("-l").arg("-c").arg(&claude_cmd);

    // Fire and forget - spawn without waiting
    cmd.spawn().map_err(|e| format!("Failed to launch Claude Code: {}", e))?;

    Ok(())
}

/// Resume a Claude Code session with optional prompt
#[tauri::command]
pub fn resume_claude_code(
    app: tauri::AppHandle,
    session_id: String,
    cwd: String,
    prompt: Option<String>,
) -> Result<(), String> {
    // Build the claude command with arguments
    let escaped_cwd = cwd.replace("'", "'\\''");
    let escaped_session_id = session_id.replace("'", "'\\''");

    let claude_cmd = if let Some(p) = prompt {
        let escaped_prompt = p.replace("'", "'\\''");
        format!("cd '{}' && claude --resume '{}' -p '{}'", escaped_cwd, escaped_session_id, escaped_prompt)
    } else {
        format!("cd '{}' && claude --resume '{}'", escaped_cwd, escaped_session_id)
    };

    // Use login shell to inherit user's PATH (including claude command)
    let mut cmd = Command::new("/bin/zsh");
    cmd.arg("-l").arg("-c").arg(&claude_cmd);

    // Spawn the process
    let mut child = cmd.spawn().map_err(|e| format!("Failed to resume Claude Code session: {}", e))?;

    // Clone session_id for the thread
    let session_id_clone = session_id.clone();

    // Monitor process in a separate thread
    std::thread::spawn(move || {
        match child.wait() {
            Ok(status) => {
                let payload = ClaudeSessionFinishedPayload {
                    session_id: session_id_clone,
                    success: status.success(),
                    exit_code: status.code(),
                };
                let _ = app.emit("claude-session-finished", payload);
            }
            Err(e) => {
                eprintln!("Failed to wait for Claude Code process: {}", e);
                let payload = ClaudeSessionFinishedPayload {
                    session_id: session_id_clone,
                    success: false,
                    exit_code: None,
                };
                let _ = app.emit("claude-session-finished", payload);
            }
        }
    });

    Ok(())
}
