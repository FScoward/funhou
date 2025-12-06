import Database from '@tauri-apps/plugin-sql'
import { TaskClaudeSession, TaskIdentifier, getTaskIdentifierKey } from '@/types'

interface DbTaskClaudeSession {
  id: number
  entry_id: number
  reply_id: number | null
  line_index: number
  session_id: string
  cwd: string
  project_path: string
  created_at: string
}

function mapDbToTaskClaudeSession(row: DbTaskClaudeSession): TaskClaudeSession {
  return {
    id: row.id,
    entryId: row.entry_id,
    replyId: row.reply_id ?? undefined,
    lineIndex: row.line_index,
    sessionId: row.session_id,
    cwd: row.cwd,
    projectPath: row.project_path,
    createdAt: row.created_at,
  }
}

// タスクに紐付けられたセッション一覧を取得
export async function getTaskClaudeSessions(
  db: Database,
  task: TaskIdentifier
): Promise<TaskClaudeSession[]> {
  const result = await db.select<DbTaskClaudeSession[]>(
    `SELECT * FROM task_claude_sessions
     WHERE entry_id = ? AND (reply_id = ? OR (reply_id IS NULL AND ? IS NULL)) AND line_index = ?
     ORDER BY created_at DESC`,
    [task.entryId, task.replyId ?? null, task.replyId ?? null, task.lineIndex]
  )
  return result.map(mapDbToTaskClaudeSession)
}

// タスクにセッションを紐付け
export async function linkTaskClaudeSession(
  db: Database,
  task: TaskIdentifier,
  sessionId: string,
  cwd: string,
  projectPath: string
): Promise<void> {
  await db.execute(
    `INSERT OR IGNORE INTO task_claude_sessions
       (entry_id, reply_id, line_index, session_id, cwd, project_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [task.entryId, task.replyId ?? null, task.lineIndex, sessionId, cwd, projectPath]
  )
}

// タスクからセッション紐付けを解除
export async function unlinkTaskClaudeSession(
  db: Database,
  task: TaskIdentifier,
  sessionId: string
): Promise<void> {
  await db.execute(
    `DELETE FROM task_claude_sessions
     WHERE entry_id = ? AND (reply_id = ? OR (reply_id IS NULL AND ? IS NULL)) AND line_index = ? AND session_id = ?`,
    [task.entryId, task.replyId ?? null, task.replyId ?? null, task.lineIndex, sessionId]
  )
}

// 複数タスクのセッション情報を一括取得（パフォーマンス最適化）
export async function getTaskClaudeSessionsBatch(
  db: Database,
  tasks: TaskIdentifier[]
): Promise<Map<string, TaskClaudeSession[]>> {
  if (tasks.length === 0) {
    return new Map()
  }

  // 全てのセッションを取得
  const result = await db.select<DbTaskClaudeSession[]>(
    `SELECT * FROM task_claude_sessions ORDER BY created_at DESC`
  )

  // タスクキーをセットに変換（高速ルックアップ用）
  const taskKeySet = new Set(tasks.map(getTaskIdentifierKey))

  // 結果をマップに整理
  const sessionMap = new Map<string, TaskClaudeSession[]>()

  for (const row of result) {
    const key = getTaskIdentifierKey({
      entryId: row.entry_id,
      replyId: row.reply_id ?? undefined,
      lineIndex: row.line_index,
    })

    if (taskKeySet.has(key)) {
      const sessions = sessionMap.get(key) ?? []
      sessions.push(mapDbToTaskClaudeSession(row))
      sessionMap.set(key, sessions)
    }
  }

  return sessionMap
}
