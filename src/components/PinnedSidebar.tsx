import { Pin, ChevronRight } from 'lucide-react'
import { TimelineItem } from '@/types'
import { formatTimestamp } from '@/utils/dateUtils'

interface PinnedSidebarProps {
  pinnedItems: TimelineItem[]
  onItemClick: (entryId: number) => void
  isOpen: boolean
  onToggle: () => void
}

export function PinnedSidebar({ pinnedItems, onItemClick, isOpen, onToggle }: PinnedSidebarProps) {
  return (
    <>
      {/* トグルボタン（常に表示） */}
      {!isOpen && (
        <button
          className="sidebar-toggle-fab"
          onClick={onToggle}
          aria-label="サイドバーを開く"
        >
          <Pin size={14} />
          {pinnedItems.length > 0 && (
            <span className="sidebar-toggle-count">{pinnedItems.length}</span>
          )}
        </button>
      )}

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        />
      )}

      {/* Drawerサイドバー */}
      <aside className={`pinned-sidebar-drawer ${isOpen ? 'open' : 'closed'}`}>
        <button
          className="sidebar-close"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        >
          <ChevronRight size={16} />
        </button>

        {pinnedItems.length === 0 ? (
          <>
            <div className="pinned-sidebar-header">
              <Pin size={18} />
              <h2>ピン留め</h2>
            </div>
            <div className="pinned-sidebar-empty">
              ピン留めされたエントリーはありません
            </div>
          </>
        ) : (
          <>
            <div className="pinned-sidebar-header">
              <Pin size={18} />
              <h2>ピン留め</h2>
              <span className="pinned-count">{pinnedItems.length}</span>
            </div>
            <div className="pinned-sidebar-list">
              {pinnedItems.map((item) => (
                <div
                  key={item.id}
                  className="pinned-sidebar-item"
                  onClick={() => {
                    onItemClick(item.id)
                    onToggle() // クリック後に自動で閉じる
                  }}
                >
                  <div className="pinned-item-timestamp">
                    {formatTimestamp(item.timestamp)}
                  </div>
                  <div className="pinned-item-content">
                    {item.content.length > 60
                      ? `${item.content.substring(0, 60)}...`
                      : item.content}
                  </div>
                  {item.tags && item.tags.length > 0 && (
                    <div className="pinned-item-tags">
                      {item.tags.map((tag) => (
                        <span key={tag.id} className="pinned-item-tag">
                          #{tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </>
  )
}
