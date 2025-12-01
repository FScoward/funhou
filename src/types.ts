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
}

export interface Reply {
  id: number
  entry_id: number
  content: string
  timestamp: string
  tags?: Tag[]
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
  // reply specific fields
  replyId?: number
  entryId?: number
  parentEntry?: {
    id: number
    content: string
  }
}
