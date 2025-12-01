import { Sparkles, ExternalLink } from 'lucide-react'
import { TodoItem } from '@/types'

interface CurrentActivitySectionProps {
  isLoading?: boolean
  todoItems?: TodoItem[]
  onScrollToEntry?: (entryId: number) => void
  onStatusChange?: (todo: TodoItem, newStatus: 'x') => Promise<void>
}

export function CurrentActivitySection({
  isLoading = false,
  todoItems = [],
  onScrollToEntry,
  onStatusChange,
}: CurrentActivitySectionProps) {
  // DOINGのみフィルタリング
  const doingTodos = todoItems.filter(todo => todo.status === '/')

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
          <div className="current-activity-doing-list">
            {doingTodos.map((todo) => (
              <div
                key={`${todo.entryId}-${todo.lineIndex}`}
                className="doing-list-item"
              >
                {onStatusChange && (
                  <button
                    className="doing-list-item-checkbox"
                    onClick={() => onStatusChange(todo, 'x')}
                    title="完了にする"
                  />
                )}
                <span className="doing-list-item-text">{todo.text}</span>
                {onScrollToEntry && (
                  <button
                    className="doing-list-item-jump"
                    onClick={() => onScrollToEntry(todo.entryId)}
                    title="エントリーに移動"
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="current-activity-empty">
            なにもしていない
          </div>
        )}
      </div>
    </div>
  )
}
