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
}

export interface Reply {
  id: number
  entry_id: number
  content: string
  timestamp: string
  tags?: Tag[]
}

export interface TodoItem {
  entryId: number      // 元のエントリーID
  lineIndex: number    // エントリー内の行番号（1始まり）
  text: string         // タスクのテキスト部分
  status: ' ' | '/'    // 未完了 or Doing
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
  // reply specific fields
  replyId?: number
  entryId?: number
  parentEntry?: {
    id: number
    content: string
  }
}
