import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import './App.css'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Trash2, Settings } from 'lucide-react'
import { ja } from 'date-fns/locale'
import { SettingsDialog } from '@/components/SettingsDialog'
import { getSettings } from '@/lib/settings'
import { getCurrentWindow } from '@tauri-apps/api/window'

interface Entry {
  id: number
  content: string
  timestamp: string
}

interface Reply {
  id: number
  entry_id: number
  content: string
  timestamp: string
}

interface TimelineItem {
  type: 'entry' | 'reply'
  id: number
  content: string
  timestamp: string
  // entry specific fields
  replies?: Reply[]
  replyCount?: number
  // reply specific fields
  replyId?: number
  entryId?: number
  parentEntry?: {
    id: number
    content: string
  }
}

let db: Database | null = null

async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:funhou.db')

    // テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        timestamp DATETIME NOT NULL
      )
    `)

    // 設定テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // デフォルト設定を挿入（既に存在しない場合のみ）
    await db.execute(`
      INSERT OR IGNORE INTO settings (key, value) VALUES ('always_on_top', 'false')
    `)

    // 返信テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
      )
    `)

    // インデックス作成
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_replies_entry_id ON replies(entry_id)
    `)
  }
  return db
}

// ローカルタイムゾーンを考慮した日付文字列を生成（YYYY-MM-DD形式）
function formatDateToLocalYYYYMMDD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function App() {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [currentEntry, setCurrentEntry] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [deleteReplyDialogOpen, setDeleteReplyDialogOpen] = useState(false)
  const [deleteReplyTarget, setDeleteReplyTarget] = useState<{ replyId: number; entryId: number } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [database, setDatabase] = useState<Database | null>(null)
  const [replyingToId, setReplyingToId] = useState<number | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [expandedEntryReplies, setExpandedEntryReplies] = useState<Set<number>>(new Set())

  useEffect(() => {
    initializeDb()
  }, [])

  useEffect(() => {
    if (database) {
      loadEntries()
    }
  }, [selectedDate, database])

  const initializeDb = async () => {
    const db = await getDb()
    setDatabase(db)

    // 設定を読み込んでウィンドウに適用
    try {
      const settings = await getSettings(db)
      const window = getCurrentWindow()
      await window.setAlwaysOnTop(settings.alwaysOnTop)
    } catch (error) {
      console.error('設定の適用に失敗しました:', error)
    }
  }

  const loadEntries = async () => {
    if (!database) return

    try {
      // 選択された日付のエントリーのみを取得（ローカルタイムゾーンを考慮）
      const dateStr = formatDateToLocalYYYYMMDD(selectedDate)
      const loadedEntries = await database.select<Entry[]>(
        'SELECT id, content, timestamp FROM entries WHERE DATE(timestamp, \'localtime\') = DATE(?) ORDER BY timestamp DESC',
        [dateStr]
      )

      // 返信を取得（親エントリーの情報も含める）
      const entryIds = loadedEntries.map(e => e.id)
      if (entryIds.length === 0) {
        setTimelineItems([])
        return
      }

      const replies = await database.select<Reply[]>(
        `SELECT id, entry_id, content, timestamp FROM replies WHERE entry_id IN (${entryIds.join(',')})`,
        []
      )

      // エントリーをTimelineItemに変換（返信リストも含める）
      const entryItems: TimelineItem[] = loadedEntries.map(entry => {
        const entryReplies = replies.filter(r => r.entry_id === entry.id)
        return {
          type: 'entry' as const,
          id: entry.id,
          content: entry.content,
          timestamp: entry.timestamp,
          replies: entryReplies,
          replyCount: entryReplies.length
        }
      })

      // 返信をTimelineItemに変換（親エントリー情報も含める）
      const replyItems: TimelineItem[] = replies.map(reply => {
        const parentEntry = loadedEntries.find(e => e.id === reply.entry_id)
        return {
          type: 'reply' as const,
          id: reply.id,
          replyId: reply.id,
          entryId: reply.entry_id,
          content: reply.content,
          timestamp: reply.timestamp,
          parentEntry: parentEntry ? {
            id: parentEntry.id,
            content: parentEntry.content
          } : undefined
        }
      })

      // 統合して時系列順（降順）にソート
      const allItems = [...entryItems, ...replyItems].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      setTimelineItems(allItems)
    } catch (error) {
      console.error('エントリーの読み込みに失敗しました:', error)
    }
  }

  const handleAddEntry = async () => {
    if (currentEntry.trim() && database) {
      try {
        const timestamp = new Date().toISOString()

        const result = await database.execute(
          'INSERT INTO entries (content, timestamp) VALUES (?, ?)',
          [currentEntry, timestamp]
        )

        const newItem: TimelineItem = {
          type: 'entry',
          id: Number(result.lastInsertId),
          content: currentEntry,
          timestamp: timestamp,
          replies: [],
          replyCount: 0
        }

        setTimelineItems([newItem, ...timelineItems])
        setCurrentEntry('')

        // textareaの高さをリセット
        const textarea = document.querySelector('textarea')
        if (textarea) {
          textarea.style.height = 'auto'
        }
      } catch (error) {
        console.error('エントリーの追加に失敗しました:', error)
      }
    }
  }

  const openDeleteDialog = (id: number) => {
    setDeleteTargetId(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteEntry = async () => {
    if (deleteTargetId === null || !database) return

    try {
      await database.execute('DELETE FROM entries WHERE id = ?', [deleteTargetId])

      // stateからエントリーと関連する返信を削除
      setTimelineItems(timelineItems.filter((item) =>
        !(item.type === 'entry' && item.id === deleteTargetId) &&
        !(item.type === 'reply' && item.entryId === deleteTargetId)
      ))

      // ダイアログを閉じる
      setDeleteDialogOpen(false)
      setDeleteTargetId(null)
    } catch (error) {
      console.error('エントリーの削除に失敗しました:', error)
    }
  }

  const handleAddReply = async (entryId: number) => {
    if (replyContent.trim() && database) {
      try {
        const timestamp = new Date().toISOString()

        const result = await database.execute(
          'INSERT INTO replies (entry_id, content, timestamp) VALUES (?, ?, ?)',
          [entryId, replyContent, timestamp]
        )

        // 親エントリーを探す
        const parentEntry = timelineItems.find(item => item.type === 'entry' && item.id === entryId)

        const newReply: Reply = {
          id: Number(result.lastInsertId),
          entry_id: entryId,
          content: replyContent,
          timestamp: timestamp,
        }

        const newReplyItem: TimelineItem = {
          type: 'reply',
          id: Number(result.lastInsertId),
          replyId: Number(result.lastInsertId),
          entryId: entryId,
          content: replyContent,
          timestamp: timestamp,
          parentEntry: parentEntry ? {
            id: parentEntry.id,
            content: parentEntry.content
          } : undefined
        }

        // 親エントリーのrepliesリストも更新
        const updatedItems = timelineItems.map(item => {
          if (item.type === 'entry' && item.id === entryId) {
            return {
              ...item,
              replies: [...(item.replies || []), newReply],
              replyCount: (item.replyCount || 0) + 1
            }
          }
          return item
        })

        // 新しい返信をタイムラインに追加して時系列順に再ソート
        const allItems = [...updatedItems, newReplyItem].sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        setTimelineItems(allItems)

        setReplyContent('')
        setReplyingToId(null)

        // textareaの高さをリセット
        const textarea = document.querySelector(`textarea[data-reply-to="${entryId}"]`)
        if (textarea instanceof HTMLTextAreaElement) {
          textarea.style.height = 'auto'
        }
      } catch (error) {
        console.error('返信の追加に失敗しました:', error)
      }
    }
  }

  const openDeleteReplyDialog = (replyId: number, entryId: number) => {
    setDeleteReplyTarget({ replyId, entryId })
    setDeleteReplyDialogOpen(true)
  }

  const handleDeleteReply = async () => {
    if (deleteReplyTarget === null || !database) return

    try {
      await database.execute('DELETE FROM replies WHERE id = ?', [deleteReplyTarget.replyId])

      // タイムラインから返信を削除し、親エントリーの返信リストも更新
      const updatedItems = timelineItems
        .filter(item => !(item.type === 'reply' && item.replyId === deleteReplyTarget.replyId))
        .map(item => {
          if (item.type === 'entry' && item.id === deleteReplyTarget.entryId) {
            const updatedReplies = (item.replies || []).filter(r => r.id !== deleteReplyTarget.replyId)
            return {
              ...item,
              replies: updatedReplies,
              replyCount: updatedReplies.length
            }
          }
          return item
        })

      setTimelineItems(updatedItems)

      // ダイアログを閉じる
      setDeleteReplyDialogOpen(false)
      setDeleteReplyTarget(null)
    } catch (error) {
      console.error('返信の削除に失敗しました:', error)
    }
  }

  const toggleReplyForm = (entryId: number) => {
    if (replyingToId === entryId) {
      setReplyingToId(null)
      setReplyContent('')
    } else {
      setReplyingToId(entryId)
      setReplyContent('')
    }
  }

  const toggleEntryReplies = (entryId: number) => {
    setExpandedEntryReplies(prev => {
      const newSet = new Set(prev)
      if (newSet.has(entryId)) {
        newSet.delete(entryId)
      } else {
        newSet.add(entryId)
      }
      return newSet
    })
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ja-JP')
  }

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const handleScrollToEntry = (entryId: number) => {
    const element = document.getElementById(`item-entry-${entryId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // ハイライト表示
      element.classList.add('highlight-flash')
      setTimeout(() => {
        element.classList.remove('highlight-flash')
      }, 2000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleAddEntry()
    }
  }

  // テキストエリアの自動リサイズ
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentEntry(e.target.value)
    // 高さをリセットしてから再計算
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  // 日付移動関数
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  const goToNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  // 日本語の日付フォーマット（曜日付き）
  const formatDateWithWeekday = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const weekday = weekdays[date.getDay()]
    return `${year}年${month}月${day}日（${weekday}）`
  }

  // キーボードショートカット（矢印キーとTキー）
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // textareaにフォーカスがある場合はスキップ
      if (document.activeElement?.tagName === 'TEXTAREA') {
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPreviousDay()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNextDay()
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        goToToday()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [selectedDate])

  return (
    <div className="app">
      <main>
        <div className="date-navigation">
          <div className="settings-spacer"></div>
          <div className="date-navigation-center">
            <button onClick={goToPreviousDay} className="nav-button">
              ◀
            </button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="date-display" style={{ cursor: 'pointer', background: 'none', border: 'none' }}>
                  {formatDateWithWeekday(selectedDate)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date)
                      setCalendarOpen(false)
                    }
                  }}
                  locale={ja}
                  captionLayout="dropdown"
                  fromYear={2000}
                  toYear={2050}
                  initialFocus
                />
                <div className="p-3 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedDate(new Date())
                      setCalendarOpen(false)
                    }}
                  >
                    今日
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <button onClick={goToNextDay} className="nav-button">
              ▶
            </button>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="nav-button settings-button"
            aria-label="設定"
          >
            <Settings size={20} />
          </button>
        </div>

        <div className="input-section">
          <textarea
            value={currentEntry}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="今やっていることを記録してください..."
            rows={1}
          />
          <button onClick={handleAddEntry} className="submit-button">送信</button>
        </div>

        <div className="timeline">
          {timelineItems.length === 0 ? (
            <p className="empty">この日の記録がありません</p>
          ) : (
            <div className="timeline-container">
              {timelineItems.map((item, index) => {
                const itemDate = new Date(item.timestamp)
                const day = itemDate.getDate()
                const month = itemDate.toLocaleDateString('ja-JP', { month: 'short' })

                // 前のアイテムと日付を比較
                const prevItem = index > 0 ? timelineItems[index - 1] : null
                const prevDate = prevItem ? new Date(prevItem.timestamp).getDate() : null
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
                        <div className="entry-card">
                          <button
                            className="delete-button"
                            onClick={() => openDeleteDialog(item.id)}
                            aria-label="削除"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div className="entry-text">{item.content}</div>

                          {/* 返信ボタン */}
                          <div className="entry-actions">
                            <button
                              className="reply-button"
                              onClick={() => toggleReplyForm(item.id)}
                            >
                              💬 返信する{(item.replyCount ?? 0) > 0 && <span className="reply-count"> ({item.replyCount})</span>}
                            </button>
                            {(item.replyCount ?? 0) > 0 && (
                              <button
                                className="show-replies-button"
                                onClick={() => toggleEntryReplies(item.id)}
                              >
                                {expandedEntryReplies.has(item.id) ? '▼' : '▶'} 返信を表示
                              </button>
                            )}
                          </div>

                          {/* 返信入力フォーム */}
                          {replyingToId === item.id && (
                            <div className="reply-input-section">
                              <textarea
                                data-reply-to={item.id}
                                value={replyContent}
                                onChange={(e) => {
                                  setReplyContent(e.target.value)
                                  e.target.style.height = 'auto'
                                  e.target.style.height = `${e.target.scrollHeight}px`
                                }}
                                onKeyDown={(e) => {
                                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddReply(item.id)
                                  }
                                }}
                                placeholder="返信を入力..."
                                rows={1}
                                className="reply-textarea"
                              />
                              <div className="reply-buttons">
                                <button
                                  onClick={() => handleAddReply(item.id)}
                                  className="submit-reply-button"
                                >
                                  送信
                                </button>
                                <button
                                  onClick={() => {
                                    setReplyingToId(null)
                                    setReplyContent('')
                                  }}
                                  className="cancel-reply-button"
                                >
                                  キャンセル
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 返信一覧 */}
                          {expandedEntryReplies.has(item.id) && item.replies && item.replies.length > 0 && (
                            <div className="entry-replies-list">
                              {item.replies
                                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                                .map((reply) => (
                                  <div key={reply.id} className="entry-reply-item">
                                    <div className="entry-reply-time">{formatTimestamp(reply.timestamp)}</div>
                                    <div className="entry-reply-text">{reply.content}</div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="reply-card">
                          <button
                            className="delete-button"
                            onClick={() => openDeleteReplyDialog(item.replyId!, item.entryId!)}
                            aria-label="削除"
                          >
                            <Trash2 size={16} />
                          </button>
                          {item.parentEntry && (
                            <button
                              className="reply-reference"
                              onClick={() => handleScrollToEntry(item.parentEntry!.id)}
                            >
                              → 「{truncateText(item.parentEntry.content)}」への返信
                            </button>
                          )}
                          <div className="reply-text">{item.content}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>エントリーを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。本当に削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteReplyDialogOpen} onOpenChange={setDeleteReplyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>返信を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。本当に削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReply}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {database && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          db={database}
        />
      )}
    </div>
  )
}

export default App
