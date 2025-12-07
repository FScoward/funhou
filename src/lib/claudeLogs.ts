import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'

export interface ProjectInfo {
  name: string
  path: string
  session_count: number
  last_updated: string | null
}

export interface SessionSummary {
  session_id: string
  project_path: string
  cwd: string | null
  git_branch: string | null
  first_message: string | null
  timestamp: string | null
  message_count: number
}

export interface ConversationMessage {
  role: string
  content: string
  timestamp: string
}

export async function listClaudeProjects(): Promise<ProjectInfo[]> {
  return invoke<ProjectInfo[]>('list_claude_projects')
}

export async function listClaudeSessions(projectPath: string): Promise<SessionSummary[]> {
  return invoke<SessionSummary[]>('list_claude_sessions', { projectPath })
}

export async function readClaudeSession(
  projectPath: string,
  sessionId: string
): Promise<ConversationMessage[]> {
  return invoke<ConversationMessage[]>('read_claude_session', { projectPath, sessionId })
}

export async function launchClaudeCode(cwd: string, prompt?: string): Promise<string> {
  return invoke<string>('launch_claude_code', { cwd, prompt })
}

export async function resumeClaudeCode(
  sessionId: string,
  cwd: string,
  prompt?: string
): Promise<void> {
  return invoke<void>('resume_claude_code', { sessionId, cwd, prompt })
}

// Event types
export interface ClaudeSessionFinishedPayload {
  session_id: string
  success: boolean
  exit_code: number | null
}

// Listen for Claude session finished events
export function onClaudeSessionFinished(
  callback: (payload: ClaudeSessionFinishedPayload) => void
): Promise<UnlistenFn> {
  return listen<ClaudeSessionFinishedPayload>('claude-session-finished', (event) => {
    callback(event.payload)
  })
}

// セッションログを文字列として取得
export async function getClaudeSessionLog(
  sessionId: string,
  projectPath: string
): Promise<string> {
  const messages = await readClaudeSession(projectPath, sessionId)

  if (messages.length === 0) {
    return ''
  }

  return messages
    .map((msg) => {
      const timestamp = new Date(msg.timestamp).toLocaleString('ja-JP')
      const roleLabel = msg.role === 'user' ? '👤 User' : '🤖 Claude'
      return `[${timestamp}] ${roleLabel}\n${msg.content}`
    })
    .join('\n\n---\n\n')
}

// プロジェクト内のClaude Codeセッション一覧を取得（ログ紐付け用）
export async function getClaudeSessionsForProject(
  projectPath: string
): Promise<SessionSummary[]> {
  return listClaudeSessions(projectPath)
}

// 現在の作業ディレクトリを取得
export async function getCurrentWorkingDirectory(): Promise<string> {
  return invoke<string>('get_current_working_directory')
}

// 作業ディレクトリからClaude Codeプロジェクトパスを取得
export async function getProjectPathForCwd(cwd: string): Promise<string | null> {
  return invoke<string | null>('get_project_path_for_cwd', { cwd })
}

// 作業ディレクトリに対応するClaude Codeセッション一覧を取得
export async function listSessionsForCwd(cwd: string): Promise<SessionSummary[]> {
  return invoke<SessionSummary[]>('list_sessions_for_cwd', { cwd })
}

// 作業ディレクトリの最新セッションを取得
export async function getLatestSessionForCwd(cwd: string): Promise<SessionSummary | null> {
  return invoke<SessionSummary | null>('get_latest_session_for_cwd', { cwd })
}
