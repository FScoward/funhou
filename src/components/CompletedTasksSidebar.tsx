import { CheckCircle, ChevronRight, ExternalLink } from 'lucide-react'
import { CompletedTodoItem } from '@/types'
import { formatTimestamp } from '@/utils/dateUtils'

interface CompletedTasksSidebarProps {
  completedItems: CompletedTodoItem[]
  isLoading?: boolean
  onItemClick: (entryId: number) => void
  isOpen: boolean
  onToggle: () => void
}

export function CompletedTasksSidebar({
  completedItems,
  isLoading = false,
  onItemClick,
  isOpen,
  onToggle
}: CompletedTasksSidebarProps) {
  return (
    <>
      {/* トグルボタン（常に表示） */}
      {!isOpen && (
        <button
          className="done-sidebar-toggle-fab"
          onClick={onToggle}
          aria-label="完了タスクを開く"
        >
          <CheckCircle size={14} />
          {completedItems.length > 0 && (
            <span className="done-sidebar-toggle-count">{completedItems.length}</span>
          )}
        </button>
      )}

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="sidebar-overlay done-overlay"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        />
      )}

      {/* Drawerサイドバー */}
      <aside className={`done-sidebar-drawer ${isOpen ? 'open' : 'closed'}`}>
        <button
          className="sidebar-close"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        >
          <ChevronRight size={16} />
        </button>

        <div className="done-sidebar-header">
          <CheckCircle size={18} />
          <h2>今日やったこと</h2>
          {completedItems.length > 0 && (
            <span className="done-count">{completedItems.length}</span>
          )}
        </div>

        {isLoading ? (
          <div className="done-sidebar-empty">読み込み中...</div>
        ) : completedItems.length === 0 ? (
          <div className="done-sidebar-empty">
            完了したタスクはありません
          </div>
        ) : (
          <div className="done-sidebar-list">
            {completedItems.map((item) => (
              <div
                key={`${item.entryId}-${item.lineIndex}`}
                className="done-sidebar-item"
                onClick={() => {
                  onItemClick(item.entryId)
                  onToggle()
                }}
              >
                <div className="done-item-timestamp">
                  {formatTimestamp(item.entryTimestamp)}
                </div>
                <div className="done-item-content">
                  <CheckCircle size={14} className="done-item-check" />
                  <span className="done-item-text">{item.text}</span>
                </div>
                <button
                  className="done-item-jump"
                  onClick={(e) => {
                    e.stopPropagation()
                    onItemClick(item.entryId)
                    onToggle()
                  }}
                  title="エントリーに移動"
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  )
}
