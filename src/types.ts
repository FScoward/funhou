export interface Tag {
  id: number
  name: string
  usageCount?: number
  lastUsedAt?: string | null
}

export interface CategorizedTags {
  frequent: Tag[]
  recent: Tag[]
  others: Tag[]
}

export interface Entry {
  id: number
  content: string
  timestamp: string
  tags?: Tag[]
  pinned?: number
  archived?: number
  is_current?: number
  claude_session_id?: string | null
  claude_cwd?: string | null
  claude_project_path?: string | null
}

export interface Reply {
  id: number
  entry_id: number
  content: string
  timestamp: string
  tags?: Tag[]
  archived?: number
}

export interface TodoItem {
  entryId: number           // 元のエントリーID（返信の場合は親エントリーID）
  replyId?: number          // 返信のID（返信の場合のみ）
  lineIndex: number         // エントリー/返信内の行番号（1始まり）
  text: string              // タスクのテキスト部分
  status: ' ' | '/'         // 未完了 or Doing
  timestamp: string         // タスクが作成された日時
  parentEntryText?: string  // 親エントリーのテキスト（返信タスクの場合のみ）
  parentEntryTags?: Tag[]   // 親エントリーのタグ（返信タスクの場合のみ）
  childCount?: number       // 子タスクの数（親タスクの場合のみ）
  isLastChild?: boolean     // 最後の子タスクかどうか
}

// TodoItemのユニークIDを生成（ドラッグ&ドロップ用）
export function getTodoUniqueId(todo: TodoItem): string {
  return `${todo.replyId ?? todo.entryId}-${todo.lineIndex}`
}

export interface CompletedTodoItem {
  entryId: number         // 元のエントリーID
  replyId?: number        // 返信のID（返信の場合のみ）
  lineIndex: number       // エントリー/返信内の行番号（1始まり）
  text: string            // タスクのテキスト部分
  status: 'x' | 'X'       // 完了状態
  entryTimestamp: string  // エントリーのタイムスタンプ（フォールバック用）
  completedAt?: string    // タスク完了時刻（存在する場合）
}

export interface IncompleteTodoItem {
  entryId: number        // 元のエントリーID（返信の場合は親エントリーID）
  replyId?: number       // 返信のID（返信の場合のみ）
  lineIndex: number      // エントリー/返信内の行番号（1始まり）
  text: string           // タスクのテキスト部分
  timestamp: string      // エントリー/返信のタイムスタンプ（日付別グルーピング用）
}

export interface TimelineItem {
  type: 'entry' | 'reply'
  id: number
  content: string
  timestamp: string
  // entry specific fields
  replies?: Reply[]
  replyCount?: number
  tags?: Tag[]
  pinned?: boolean
  archived?: boolean
  isCurrent?: boolean
  claudeSessionId?: string | null
  claudeCwd?: string | null
  claudeProjectPath?: string | null
  // reply specific fields
  replyId?: number
  entryId?: number
  parentEntry?: {
    id: number
    content: string
    archived?: boolean
    claudeSessionId?: string | null
    claudeCwd?: string | null
    claudeProjectPath?: string | null
  }
  replyArchived?: boolean
}
