import { Sparkles } from 'lucide-react'
import { TodoItem, getTodoUniqueId } from '@/types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableDoingItem } from './SortableDoingItem'

interface CurrentActivitySectionProps {
  isLoading?: boolean
  todoItems?: TodoItem[]
  onScrollToEntry?: (entryId: number) => void
  onScrollToReply?: (replyId: number) => void
  onStatusChange?: (todo: TodoItem, newStatus: 'x') => Promise<void>
  onReorder?: (activeId: string, overId: string) => Promise<void>
}

export function CurrentActivitySection({
  isLoading = false,
  todoItems = [],
  onScrollToEntry,
  onScrollToReply,
  onStatusChange,
  onReorder,
}: CurrentActivitySectionProps) {
  // DOINGのみフィルタリング
  const doingTodos = todoItems.filter(todo => todo.status === '/')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px移動後にドラッグ開始
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id && onReorder) {
      await onReorder(active.id as string, over.id as string)
    }
  }

  if (isLoading) {
    return (
      <div className="current-activity-section">
        <div className="current-activity-card">
          <div className="current-activity-header">
            <Sparkles size={18} className="current-activity-icon" />
            <span className="current-activity-label">今何してる？</span>
          </div>
          <div className="current-activity-empty">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="current-activity-section">
      <div className="current-activity-card">
        <div className="current-activity-header">
          <Sparkles size={18} className="current-activity-icon" />
          <span className="current-activity-label">今何してる？</span>
        </div>

        {doingTodos.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={doingTodos.map(getTodoUniqueId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="current-activity-doing-list">
                {doingTodos.map((todo) => (
                  <SortableDoingItem
                    key={getTodoUniqueId(todo)}
                    todo={todo}
                    onStatusChange={onStatusChange}
                    onScrollToEntry={onScrollToEntry}
                    onScrollToReply={onScrollToReply}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="current-activity-empty">
            なにもしていない
          </div>
        )}
      </div>
    </div>
  )
}
