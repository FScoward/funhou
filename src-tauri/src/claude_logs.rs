use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

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
    /// Sidechain sessions are created by subagents and cannot be resumed
    #[serde(rename = "isSidechain")]
    pub is_sidechain: Option<bool>,
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
    // Convert project_path (which might be actual cwd) to Claude's project directory
    let project_dir = get_claude_project_dir(&project_path)?;

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

            // Skip sidechain sessions (created by subagents, not resumable)
            if let Some(first_line) = lines.first() {
                if let Ok(first_entry) = serde_json::from_str::<ClaudeLogEntry>(first_line) {
                    if first_entry.is_sidechain == Some(true) {
                        continue;
                    }
                }
            }

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

/// Convert a project path (cwd) to Claude's project directory path
fn get_claude_project_dir(cwd: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let claude_projects = home.join(".claude").join("projects");

    // Check if the path is already a Claude projects path
    if cwd.starts_with(&claude_projects.to_string_lossy().to_string()) {
        return Ok(PathBuf::from(cwd));
    }

    // Convert cwd to Claude's directory name format:
    // - Replace / with -
    // - Replace . with -
    // Result: /Users/foo/github.com/bar -> -Users-foo-github-com-bar
    let encoded_name = cwd.replace("/", "-").replace(".", "-");
    let project_dir = claude_projects.join(&encoded_name);

    if project_dir.exists() {
        return Ok(project_dir);
    }

    Err(format!("Claude project directory not found for: {} (tried: {:?})", cwd, project_dir))
}

/// Read a specific session's conversation
#[tauri::command]
pub fn read_claude_session(project_path: String, session_id: String) -> Result<Vec<ConversationMessage>, String> {
    // Convert project_path (which might be actual cwd) to Claude's project directory
    let claude_project_dir = get_claude_project_dir(&project_path)?;
    let session_file = claude_project_dir.join(format!("{}.jsonl", session_id));

    if !session_file.exists() {
        return Err(format!("Session file not found: {:?}", session_file));
    }

    let content = fs::read_to_string(&session_file).map_err(|e| e.to_string())?;

    // Check if this is a sidechain session (not resumable)
    // Sidechain sessions are created by subagents and cannot be resumed with --resume
    if let Some(first_line) = content.lines().next() {
        if let Ok(entry) = serde_json::from_str::<ClaudeLogEntry>(first_line) {
            if entry.is_sidechain == Some(true) {
                return Err(format!("Session {} is a sidechain session and cannot be resumed", session_id));
            }
        }
    }

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

/// Launch Claude Code in interactive mode in a new terminal window
#[tauri::command]
pub fn launch_claude_code(
    _app: tauri::AppHandle,
    cwd: String,
    prompt: Option<String>,
) -> Result<String, String> {
    // Generate a unique session ID for tracking
    let session_id = uuid::Uuid::new_v4().to_string();

    // Build the claude command for interactive mode
    let escaped_cwd = cwd.replace("\"", "\\\"").replace("\\", "\\\\");
    let claude_cmd = if let Some(p) = prompt {
        // Escape for AppleScript string
        let escaped_prompt = p.replace("\\", "\\\\").replace("\"", "\\\"");
        format!("cd \"{}\" && claude \"{}\"", escaped_cwd, escaped_prompt)
    } else {
        format!("cd \"{}\" && claude", escaped_cwd)
    };

    // Use AppleScript to open a new Terminal window with claude in interactive mode
    let apple_script = format!(
        r#"tell application "Terminal"
            activate
            do script "source ~/.zshrc; {}"
        end tell"#,
        claude_cmd.replace("\"", "\\\"")
    );

    let mut cmd = Command::new("osascript");
    cmd.arg("-e").arg(&apple_script);

    // Spawn the process
    cmd.spawn().map_err(|e| format!("Failed to launch Claude Code: {}", e))?;

    Ok(session_id)
}

/// Get current working directory
#[tauri::command]
pub fn get_current_working_directory() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Get the Claude project directory path for a given cwd
/// Returns the project path if it exists, otherwise None
#[tauri::command]
pub fn get_project_path_for_cwd(cwd: String) -> Result<Option<String>, String> {
    match get_claude_project_dir(&cwd) {
        Ok(path) => Ok(Some(path.to_string_lossy().to_string())),
        Err(_) => Ok(None),
    }
}

/// List sessions for the current working directory
/// This is a convenience function that automatically finds the Claude project directory
#[tauri::command]
pub fn list_sessions_for_cwd(cwd: String) -> Result<Vec<SessionSummary>, String> {
    // Use the existing list_claude_sessions which already handles cwd to project dir conversion
    list_claude_sessions(cwd)
}

/// Get the latest session for a given cwd
/// Returns the most recently updated session in the project
#[tauri::command]
pub fn get_latest_session_for_cwd(cwd: String) -> Result<Option<SessionSummary>, String> {
    let sessions = list_sessions_for_cwd(cwd)?;
    Ok(sessions.into_iter().next())
}

/// Resume a Claude Code session in interactive mode in a new terminal window
#[tauri::command]
pub fn resume_claude_code(
    _app: tauri::AppHandle,
    session_id: String,
    cwd: String,
    _prompt: Option<String>,
) -> Result<(), String> {
    // Build the claude command for interactive mode with resume
    let escaped_cwd = cwd.replace("\"", "\\\"").replace("\\", "\\\\");
    let escaped_session_id = session_id.replace("\"", "\\\"").replace("\\", "\\\\");

    // For resume, we use --resume flag (prompt is ignored in interactive mode)
    let claude_cmd = format!("cd \"{}\" && claude --resume \"{}\"", escaped_cwd, escaped_session_id);

    // Use AppleScript to open a new Terminal window with claude in interactive mode
    let apple_script = format!(
        r#"tell application "Terminal"
            activate
            do script "source ~/.zshrc; {}"
        end tell"#,
        claude_cmd.replace("\"", "\\\"")
    );

    let mut cmd = Command::new("osascript");
    cmd.arg("-e").arg(&apple_script);

    // Spawn the process
    cmd.spawn().map_err(|e| format!("Failed to resume Claude Code session: {}", e))?;

    Ok(())
}
