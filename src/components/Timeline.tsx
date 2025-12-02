import { TimelineItem, Tag } from '@/types'
import { TimelineItemComponent } from './TimelineItemComponent'
import { groupTimelineItemsByDate } from '@/utils/timelineUtils'

interface TimelineProps {
  timelineItems: TimelineItem[]
  isTagFiltering: boolean
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
}

export function Timeline({
  timelineItems,
  isTagFiltering,
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
}: TimelineProps) {
  // タグフィルタリング時は日付別にグループ化
  const groupedItems = isTagFiltering ? groupTimelineItemsByDate(timelineItems) : null

  return (
    <div className="timeline">
      {timelineItems.length === 0 ? (
        <p className="empty">
          {isTagFiltering ? 'タグに一致する記録がありません' : 'この日の記録がありません'}
        </p>
      ) : isTagFiltering && groupedItems ? (
        // タグフィルタリング時: 日付別グループ化表示
        <div className="timeline-container">
          {groupedItems.map((group) => (
            <div key={group.date} className="timeline-date-group">
              <div className="timeline-date-header">
                {group.displayDate}
              </div>
              {group.items.map((item, index) => (
                <TimelineItemComponent
                  key={`${item.type}-${item.id}`}
                  item={item}
                  previousItem={index > 0 ? group.items[index - 1] : null}
                  editingEntryId={editingEntryId}
                  editContent={editContent}
                  editManualTags={editManualTags}
                  editingReplyId={editingReplyId}
                  editReplyContent={editReplyContent}
                  editReplyManualTags={editReplyManualTags}
                  availableTags={availableTags}
                  selectedTags={selectedTags}
                  replyingToId={replyingToId}
                  replyContent={replyContent}
                  replyManualTags={replyManualTags}
                  expandedEntryReplies={expandedEntryReplies}
                  frequentTags={frequentTags}
                  recentTags={recentTags}
                  onEditEntry={onEditEntry}
                  onCancelEditEntry={onCancelEditEntry}
                  onUpdateEntry={onUpdateEntry}
                  onDeleteEntry={onDeleteEntry}
                  onEditContentChange={onEditContentChange}
                  onEditTagAdd={onEditTagAdd}
                  onEditTagRemove={onEditTagRemove}
                  onEditReply={onEditReply}
                  onCancelEditReply={onCancelEditReply}
                  onUpdateReply={onUpdateReply}
                  onDeleteReply={onDeleteReply}
                  onEditReplyContentChange={onEditReplyContentChange}
                  onEditReplyTagAdd={onEditReplyTagAdd}
                  onEditReplyTagRemove={onEditReplyTagRemove}
                  onTagClick={onTagClick}
                  onReplyToggle={onReplyToggle}
                  onReplyContentChange={onReplyContentChange}
                  onReplyTagAdd={onReplyTagAdd}
                  onReplyTagRemove={onReplyTagRemove}
                  onAddReply={onAddReply}
                  onToggleReplies={onToggleReplies}
                  onScrollToEntry={onScrollToEntry}
                  onTogglePin={onTogglePin}
                  onToggleArchive={onToggleArchive}
                  onUpdateEntryDirectly={onUpdateEntryDirectly}
                  onDirectTagAdd={onDirectTagAdd}
                  onDirectTagRemove={onDirectTagRemove}
                  onUpdateReplyDirectly={onUpdateReplyDirectly}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        // 通常表示: 日付別グループ化なし
        <div className="timeline-container">
          {timelineItems.map((item, index) => (
            <TimelineItemComponent
              key={`${item.type}-${item.id}`}
              item={item}
              previousItem={index > 0 ? timelineItems[index - 1] : null}
              editingEntryId={editingEntryId}
              editContent={editContent}
              editManualTags={editManualTags}
              editingReplyId={editingReplyId}
              editReplyContent={editReplyContent}
              editReplyManualTags={editReplyManualTags}
              availableTags={availableTags}
              selectedTags={selectedTags}
              replyingToId={replyingToId}
              replyContent={replyContent}
              replyManualTags={replyManualTags}
              expandedEntryReplies={expandedEntryReplies}
              frequentTags={frequentTags}
              recentTags={recentTags}
              onEditEntry={onEditEntry}
              onCancelEditEntry={onCancelEditEntry}
              onUpdateEntry={onUpdateEntry}
              onDeleteEntry={onDeleteEntry}
              onEditContentChange={onEditContentChange}
              onEditTagAdd={onEditTagAdd}
              onEditTagRemove={onEditTagRemove}
              onEditReply={onEditReply}
              onCancelEditReply={onCancelEditReply}
              onUpdateReply={onUpdateReply}
              onDeleteReply={onDeleteReply}
              onEditReplyContentChange={onEditReplyContentChange}
              onEditReplyTagAdd={onEditReplyTagAdd}
              onEditReplyTagRemove={onEditReplyTagRemove}
              onTagClick={onTagClick}
              onReplyToggle={onReplyToggle}
              onReplyContentChange={onReplyContentChange}
              onReplyTagAdd={onReplyTagAdd}
              onReplyTagRemove={onReplyTagRemove}
              onAddReply={onAddReply}
              onToggleReplies={onToggleReplies}
              onScrollToEntry={onScrollToEntry}
              onTogglePin={onTogglePin}
              onToggleArchive={onToggleArchive}
              onUpdateEntryDirectly={onUpdateEntryDirectly}
              onDirectTagAdd={onDirectTagAdd}
              onDirectTagRemove={onDirectTagRemove}
              onUpdateReplyDirectly={onUpdateReplyDirectly}
            />
          ))}
        </div>
      )}
    </div>
  )
}
