use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasteResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub bundle_id: Option<String>,
}

/// 実行中のアプリ一覧を取得（funhou以外）
#[tauri::command]
pub fn get_running_apps() -> Result<Vec<AppInfo>, String> {
    let script = r#"
        set appList to {}
        tell application "System Events"
            set visibleApps to (every process whose visible is true)
            repeat with proc in visibleApps
                set appName to name of proc
                if appName is not "funhou" then
                    try
                        set bundleId to bundle identifier of proc
                    on error
                        set bundleId to ""
                    end try
                    set end of appList to appName & "|" & bundleId
                end if
            end repeat
        end tell
        return appList
    "#;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("Failed to execute AppleScript: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(error);
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // パース: "app1|bundle1, app2|bundle2, ..."
    let apps: Vec<AppInfo> = stdout
        .split(", ")
        .filter(|s| !s.is_empty())
        .map(|s| {
            let parts: Vec<&str> = s.split('|').collect();
            AppInfo {
                name: parts.get(0).unwrap_or(&"").to_string(),
                bundle_id: parts.get(1).filter(|s| !s.is_empty()).map(|s| s.to_string()),
            }
        })
        .filter(|app| !app.name.is_empty())
        .collect();

    Ok(apps)
}

/// 指定したアプリにテキストをペースト
#[tauri::command]
pub fn paste_text_to_app(text: String, target_app: String) -> Result<PasteResult, String> {
    let preview: String = text.chars().take(20).collect();
    println!("[paste_to_app] Called with text: {}, target: {}", preview, target_app);

    // エスケープ処理
    let escaped_text = text
        .replace('\\', "\\\\")
        .replace('"', "\\\"");

    let escaped_app = target_app
        .replace('\\', "\\\\")
        .replace('"', "\\\"");

    let script = format!(
        r#"
        set the clipboard to "{escaped_text}"
        tell application "{escaped_app}" to activate

        -- Wait for target app to become frontmost (max 1 second)
        set maxWait to 10
        set waited to 0
        repeat while waited < maxWait
            delay 0.1
            tell application "System Events"
                set frontApp to name of first process whose frontmost is true
                if frontApp is "{escaped_app}" then
                    exit repeat
                end if
            end tell
            set waited to waited + 1
        end repeat

        -- Send keystroke to the specific process
        tell application "System Events"
            tell process "{escaped_app}"
                keystroke "v" using command down
            end tell
        end tell
        "#
    );

    println!("[paste_to_app] Running AppleScript...");

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to execute AppleScript: {}", e))?;

    println!("[paste_to_app] AppleScript finished, success: {}", output.status.success());

    if output.status.success() {
        Ok(PasteResult {
            success: true,
            error: None,
        })
    } else {
        let error = String::from_utf8_lossy(&output.stderr).to_string();
        println!("[paste_to_app] Error: {}", error);
        Ok(PasteResult {
            success: false,
            error: Some(error),
        })
    }
}
