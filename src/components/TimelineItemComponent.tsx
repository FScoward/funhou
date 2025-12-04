import { formatTimestamp } from '@/utils/dateUtils'
import { TimelineItem, Tag } from '@/types'
import { EntryCard } from './EntryCard'
import { ReplyCard } from './ReplyCard'

interface TimelineItemComponentProps {
  item: TimelineItem
  previousItem: TimelineItem | null
  editingEntryId: number | null
  editContent: string
  editManualTags: string[]
  editingReplyId: number | null
  editReplyContent: string
  editReplyManualTags: string[]
  availableTags: Tag[]
  selectedTags: string[]
  replyingToId: number | null
  replyContent: string
  replyManualTags: string[]
  expandedEntryReplies: Set<number>
  frequentTags?: Tag[]
  recentTags?: Tag[]
  onEditEntry: (id: number, content: string) => void
  onCancelEditEntry: () => void
  onUpdateEntry: (id: number) => void
  onDeleteEntry: (id: number) => void
  onEditContentChange: (content: string) => void
  onEditTagAdd: (tag: string) => void
  onEditTagRemove: (tag: string) => void
  onEditReply: (replyId: number, content: string) => void
  onCancelEditReply: () => void
  onUpdateReply: (replyId: number, entryId: number) => void
  onDeleteReply: (replyId: number, entryId: number) => void
  onEditReplyContentChange: (content: string) => void
  onEditReplyTagAdd: (tag: string) => void
  onEditReplyTagRemove: (tag: string) => void
  onTagClick: (tag: string) => void
  onReplyToggle: (id: number) => void
  onReplyContentChange: (content: string) => void
  onReplyTagAdd: (tag: string) => void
  onReplyTagRemove: (tag: string) => void
  onAddReply: (id: number) => void
  onToggleReplies: (id: number) => void
  onScrollToEntry: (entryId: number) => void
  onTogglePin: (id: number) => void
  onToggleArchive: (id: number) => void
  onUpdateEntryDirectly: (entryId: number, newContent: string) => void
  onDirectTagAdd: (entryId: number, tag: string) => void
  onDirectTagRemove: (entryId: number, tag: string) => void
  onUpdateReplyDirectly: (replyId: number, newContent: string) => void
  onToggleReplyArchive: (replyId: number, entryId: number) => void
  onImportAsReply?: (entryId: number, content: string) => void
  onLinkClaudeSession?: (entryId: number, sessionId: string, cwd: string, projectPath: string) => void
  runningSessionIds?: Set<string>
  onSessionStart?: (sessionId: string) => void
  latestReplyIdByEntryId?: Map<number, number>
}

export function TimelineItemComponent({
  item,
  previousItem,
  editingEntryId,
  editContent,
  editManualTags,
  editingReplyId,
  editReplyContent,
  editReplyManualTags,
  availableTags,
  selectedTags,
  replyingToId,
  replyContent,
  replyManualTags,
  expandedEntryReplies,
  frequentTags = [],
  recentTags = [],
  onEditEntry,
  onCancelEditEntry,
  onUpdateEntry,
  onDeleteEntry,
  onEditContentChange,
  onEditTagAdd,
  onEditTagRemove,
  onEditReply,
  onCancelEditReply,
  onUpdateReply,
  onDeleteReply,
  onEditReplyContentChange,
  onEditReplyTagAdd,
  onEditReplyTagRemove,
  onTagClick,
  onReplyToggle,
  onReplyContentChange,
  onReplyTagAdd,
  onReplyTagRemove,
  onAddReply,
  onToggleReplies,
  onScrollToEntry,
  onTogglePin,
  onToggleArchive,
  onUpdateEntryDirectly,
  onDirectTagAdd,
  onDirectTagRemove,
  onUpdateReplyDirectly,
  onToggleReplyArchive,
  onImportAsReply,
  onLinkClaudeSession,
  runningSessionIds = new Set(),
  onSessionStart,
  latestReplyIdByEntryId = new Map(),
}: TimelineItemComponentProps) {
  const itemDate = new Date(item.timestamp)
  const day = itemDate.getDate()
  const month = itemDate.toLocaleDateString('ja-JP', { month: 'short' })

  // 前のアイテムと日付を比較
  const prevDate = previousItem ? new Date(previousItem.timestamp).getDate() : null
  const showDate = prevDate !== day

  return (
    <div
      key={`${item.type}-${item.id}`}
      id={`item-${item.type}-${item.id}`}
      className={`timeline-item ${item.type === 'reply' ? 'is-reply' : ''}`}
    >
      <div className="timeline-date">
        {showDate ? (
          <>
            <div className="date-day">{day}</div>
            <div className="date-month">{month}</div>
          </>
        ) : null}
        <div className="entry-time">{formatTimestamp(item.timestamp)}</div>
      </div>
      <div className="timeline-line">
        <div className={`timeline-dot ${item.type === 'reply' ? 'is-reply' : ''}`}></div>
      </div>
      <div className="timeline-content">
        {item.type === 'entry' ? (
          <EntryCard
            id={item.id}
            content={item.content}
            tags={item.tags}
            replyCount={item.replyCount}
            replies={item.replies}
            pinned={item.pinned}
            archived={item.archived}
            claudeSessionId={item.claudeSessionId}
            claudeCwd={item.claudeCwd}
            claudeProjectPath={item.claudeProjectPath}
            isEditing={editingEntryId === item.id}
            editContent={editContent}
            editManualTags={editManualTags}
            availableTags={availableTags}
            selectedTags={selectedTags}
            replyingToId={replyingToId}
            replyContent={replyContent}
            replyManualTags={replyManualTags}
            expandedReplies={expandedEntryReplies.has(item.id)}
            frequentTags={frequentTags}
            recentTags={recentTags}
            onEdit={onEditEntry}
            onCancelEdit={onCancelEditEntry}
            onUpdateEntry={onUpdateEntry}
            onDelete={onDeleteEntry}
            onEditContentChange={onEditContentChange}
            onEditTagAdd={onEditTagAdd}
            onEditTagRemove={onEditTagRemove}
            onTagClick={onTagClick}
            onReplyToggle={onReplyToggle}
            onReplyContentChange={onReplyContentChange}
            onReplyTagAdd={onReplyTagAdd}
            onReplyTagRemove={onReplyTagRemove}
            onAddReply={onAddReply}
            onToggleReplies={onToggleReplies}
            onTogglePin={onTogglePin}
            onToggleArchive={onToggleArchive}
            onUpdateEntryDirectly={onUpdateEntryDirectly}
            onDirectTagAdd={(tag) => onDirectTagAdd(item.id, tag)}
            onDirectTagRemove={(tag) => onDirectTagRemove(item.id, tag)}
            onImportAsReply={onImportAsReply}
            onLinkClaudeSession={onLinkClaudeSession}
            runningSessionIds={runningSessionIds}
            onSessionStart={onSessionStart}
          />
        ) : (
          <ReplyCard
            replyId={item.replyId!}
            entryId={item.entryId!}
            content={item.content}
            tags={item.tags}
            parentEntry={item.parentEntry}
            archived={item.replyArchived}
            parentClaudeSessionId={item.parentEntry?.claudeSessionId}
            parentClaudeProjectPath={item.parentEntry?.claudeProjectPath}
            runningSessionIds={runningSessionIds}
            isLatestReply={latestReplyIdByEntryId.get(item.entryId!) === item.replyId}
            isEditing={editingReplyId === item.replyId}
            editContent={editReplyContent}
            editManualTags={editReplyManualTags}
            availableTags={availableTags}
            selectedTags={selectedTags}
            onEdit={onEditReply}
            onCancelEdit={onCancelEditReply}
            onUpdateReply={onUpdateReply}
            onDelete={onDeleteReply}
            onEditContentChange={onEditReplyContentChange}
            onEditTagAdd={onEditReplyTagAdd}
            onEditTagRemove={onEditReplyTagRemove}
            onTagClick={onTagClick}
            onScrollToEntry={onScrollToEntry}
            onUpdateReplyDirectly={onUpdateReplyDirectly}
            onToggleArchive={onToggleReplyArchive}
            onImportAsReply={onImportAsReply}
            onReplyToParent={onReplyToggle}
          />
        )}
      </div>
    </div>
  )
}
