import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ExternalLink, Circle } from 'lucide-react'
import { IncompleteTodoItem, getIncompleteTodoUniqueId } from '@/types'
import { formatDateToLocalYYYYMMDD } from '@/utils/dateUtils'

// 親エントリIDから色相を生成（0-360）
function getHueFromEntryId(entryId: number): number {
  return (entryId * 137.5) % 360
}

// 日付を短いラベルでフォーマット
function formatShortDateLabel(timestamp: string): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const dateStr = formatDateToLocalYYYYMMDD(date)
  const todayStr = formatDateToLocalYYYYMMDD(today)
  const yesterdayStr = formatDateToLocalYYYYMMDD(yesterday)

  if (dateStr === todayStr) {
    return '今日'
  } else if (dateStr === yesterdayStr) {
    return '昨日'
  } else {
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}/${day}`
  }
}

interface SortableIncompleteItemProps {
  todo: IncompleteTodoItem
  onStatusChange: (todo: IncompleteTodoItem) => Promise<void>
  onScrollToEntry: (entryId: number) => void
}

export function SortableIncompleteItem({
  todo,
  onStatusChange,
  onScrollToEntry,
}: SortableIncompleteItemProps) {
  const uniqueId = getIncompleteTodoUniqueId(todo)
  const isReplyTask = !!todo.replyId
  const hasChildren = (todo.childCount ?? 0) > 0

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: uniqueId })

  // 親エントリIDから色を生成
  const hue = getHueFromEntryId(todo.entryId)
  const parentColor = `hsl(${hue}, 75%, 40%)`
  const parentColorLight = `hsla(${hue}, 75%, 40%, 0.2)`

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    '--parent-color': parentColor,
    '--parent-color-light': parentColorLight,
  } as React.CSSProperties

  const itemClasses = [
    'task-item',
    'incomplete-item',
    'sortable-incomplete-item',
    isDragging && 'is-dragging',
    isReplyTask && 'is-child',
    hasChildren && 'has-children',
  ].filter(Boolean).join(' ')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={itemClasses}
      data-entry-id={todo.entryId}
      data-is-child={isReplyTask}
      onClick={() => onScrollToEntry(todo.entryId)}
    >
      <button
        className="incomplete-item-drag-handle"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

      <button
        className="task-item-checkbox"
        onClick={async (e) => {
          e.stopPropagation()
          await onStatusChange(todo)
        }}
        title="DOINGに変更"
      >
        <Circle size={14} />
      </button>

      <span className="task-item-text">{todo.text}</span>

      {/* 日付ラベル */}
      <span className="incomplete-item-date">{formatShortDateLabel(todo.timestamp)}</span>

      {/* 子タスクバッジ（親の場合） */}
      {hasChildren && (
        <span className="incomplete-item-badge">+{todo.childCount}</span>
      )}

      <button
        className="task-item-jump"
        onClick={(e) => {
          e.stopPropagation()
          onScrollToEntry(todo.entryId)
        }}
        title="エントリーに移動"
      >
        <ExternalLink size={14} />
      </button>
    </div>
  )
}
