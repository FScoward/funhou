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

export async function launchClaudeCode(cwd: string, prompt?: string): Promise<void> {
  return invoke<void>('launch_claude_code', { cwd, prompt })
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
