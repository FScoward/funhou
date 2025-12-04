import { useState, useCallback, useMemo } from 'react'
import { Sparkles, ChevronLeft, RefreshCw, Copy, Check, FileText } from 'lucide-react'
import MarkdownPreview from '@/components/MarkdownPreview'
import { TimelineItem } from '@/types'
import { tryGenerateDailySummary } from '@/lib/ollama'
import { formatDateWithWeekday } from '@/utils/dateUtils'

interface DailySummarySidebarProps {
  timelineItems: TimelineItem[]
  selectedDate: Date
  ollamaModel: string
  isOpen: boolean
  onToggle: () => void
}

export function DailySummarySidebar({
  timelineItems,
  selectedDate,
  ollamaModel,
  isOpen,
  onToggle
}: DailySummarySidebarProps) {
  const [summary, setSummary] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [copiedEntries, setCopiedEntries] = useState(false)

  // エントリー一覧テキストを生成
  const entriesText = useMemo(() => {
    const contents: string[] = []

    for (const item of timelineItems) {
      if (item.type === 'entry') {
        contents.push(item.content)
        if (item.replies) {
          for (const reply of item.replies) {
            contents.push(reply.content)
          }
        }
      }
    }

    return contents.join('\n---\n')
  }, [timelineItems])

  const generateSummary = useCallback(async () => {
    setIsGenerating(true)
    setSummary('')

    // エントリーとリプライのコンテンツを収集
    const contents: string[] = []

    for (const item of timelineItems) {
      if (item.type === 'entry') {
        contents.push(item.content)
        // リプライも収集
        if (item.replies) {
          for (const reply of item.replies) {
            contents.push(reply.content)
          }
        }
      }
    }

    if (contents.length === 0) {
      setSummary('まとめる内容がありません。今日の分報を追加してください。')
      setIsGenerating(false)
      return
    }

    const result = await tryGenerateDailySummary(contents, ollamaModel, (error) => {
      console.error('サマリー生成エラー:', error)
    })

    setSummary(result)
    setIsGenerating(false)
  }, [timelineItems, ollamaModel])

  const handleCopySummary = useCallback(async () => {
    if (!summary) return
    try {
      await navigator.clipboard.writeText(summary)
      setCopiedSummary(true)
      setTimeout(() => setCopiedSummary(false), 2000)
    } catch (error) {
      console.error('コピーに失敗しました:', error)
    }
  }, [summary])

  const handleCopyEntries = useCallback(async () => {
    if (!entriesText) return
    try {
      await navigator.clipboard.writeText(entriesText)
      setCopiedEntries(true)
      setTimeout(() => setCopiedEntries(false), 2000)
    } catch (error) {
      console.error('コピーに失敗しました:', error)
    }
  }, [entriesText])

  return (
    <>
      {/* トグルボタン（常に表示） */}
      {!isOpen && (
        <button
          className="summary-sidebar-toggle-fab"
          onClick={onToggle}
          aria-label="日次サマリーを開く"
        >
          <Sparkles size={14} />
        </button>
      )}

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="sidebar-overlay summary-overlay"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        />
      )}

      {/* Drawerサイドバー */}
      <aside className={`summary-sidebar-drawer ${isOpen ? 'open' : 'closed'}`}>
        <button
          className="sidebar-close"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="summary-sidebar-header">
          <Sparkles size={18} />
          <h2>日次サマリー</h2>
        </div>

        <div className="summary-sidebar-date">
          {formatDateWithWeekday(selectedDate)}
        </div>

        {/* エントリー一覧セクション */}
        <div className="summary-section">
          <div className="summary-section-header">
            <FileText size={16} />
            <span>エントリー一覧</span>
            {entriesText && (
              <button
                className="summary-copy-btn small"
                onClick={handleCopyEntries}
                title="エントリー一覧をコピー"
              >
                {copiedEntries ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
          </div>
          {entriesText ? (
            <div className="summary-entries-preview">
              <MarkdownPreview content={entriesText} />
            </div>
          ) : (
            <div className="summary-empty-small">
              <p>エントリーがありません</p>
            </div>
          )}
        </div>

        {/* サマリーセクション */}
        <div className="summary-section">
          <div className="summary-section-header">
            <Sparkles size={16} />
            <span>AIサマリー</span>
            <button
              className="summary-generate-btn"
              onClick={generateSummary}
              disabled={isGenerating}
            >
              <RefreshCw size={12} className={isGenerating ? 'spinning' : ''} />
              {isGenerating ? '生成中...' : '生成'}
            </button>
            {summary && !isGenerating && (
              <button
                className="summary-copy-btn small"
                onClick={handleCopySummary}
                title="サマリーをコピー"
              >
                {copiedSummary ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
          </div>

          <div className="summary-sidebar-content">
            {isGenerating ? (
              <div className="summary-loading">
                <div className="summary-loading-spinner" />
                <p>AIがまとめを生成しています...</p>
              </div>
            ) : summary ? (
              <div className="summary-result">
                <MarkdownPreview content={summary} />
              </div>
            ) : (
              <div className="summary-empty-small">
                <p>「生成」ボタンを押すとAIがまとめます</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
