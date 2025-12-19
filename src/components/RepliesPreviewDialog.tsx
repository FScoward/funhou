import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TagBadge } from '@/components/TagBadge'
import { Reply } from '@/types'
import { formatTimestamp } from '@/utils/dateUtils'
import { getRepliesByEntryId } from '@/lib/replies'
import { ExternalLink } from 'lucide-react'
import Database from '@tauri-apps/plugin-sql'

interface RepliesPreviewDialogProps {
  isOpen: boolean
  onClose: () => void
  entryId: number | null
  taskText: string
  database: Database | null
  onScrollToReply?: (replyId: number) => void
}

export function RepliesPreviewDialog({
  isOpen,
  onClose,
  entryId,
  taskText,
  database,
  onScrollToReply,
}: RepliesPreviewDialogProps) {
  const [replies, setReplies] = useState<Reply[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && entryId && database) {
      setIsLoading(true)
      getRepliesByEntryId(database, entryId)
        .then(setReplies)
        .catch((error) => {
          console.error('返信の取得に失敗しました:', error)
          setReplies([])
        })
        .finally(() => setIsLoading(false))
    } else {
      setReplies([])
    }
  }, [isOpen, entryId, database])

  const handleScrollToReply = (replyId: number) => {
    onClose()
    onScrollToReply?.(replyId)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="replies-preview-dialog">
        <DialogHeader>
          <DialogTitle className="replies-preview-title">
            {taskText}
          </DialogTitle>
        </DialogHeader>

        <div className="replies-preview-content">
          {isLoading ? (
            <div className="replies-preview-loading">読み込み中...</div>
          ) : replies.length > 0 ? (
            <div className="replies-preview-list">
              {replies.map((reply) => (
                <div key={reply.id} className="replies-preview-item">
                  <div className="replies-preview-item-header">
                    <span className="replies-preview-timestamp">
                      {formatTimestamp(reply.timestamp)}
                    </span>
                    {reply.tags && reply.tags.length > 0 && (
                      <div className="replies-preview-tags">
                        {reply.tags.map((tag) => (
                          <TagBadge key={tag.id} tag={tag.name} />
                        ))}
                      </div>
                    )}
                    {onScrollToReply && (
                      <button
                        className="replies-preview-jump"
                        onClick={() => handleScrollToReply(reply.id)}
                        title="返信に移動"
                      >
                        <ExternalLink size={14} />
                      </button>
                    )}
                  </div>
                  <div className="replies-preview-item-body">
                    {reply.content}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="replies-preview-empty">返信がありません</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
