export interface Tag {
  id: number
  name: string
}

export interface Entry {
  id: number
  content: string
  timestamp: string
  tags?: Tag[]
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
  // reply specific fields
  replyId?: number
  entryId?: number
  parentEntry?: {
    id: number
    content: string
  }
}
