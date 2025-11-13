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

interface EntryWithReplies extends Entry {
  replies: Reply[]
  replyCount?: number
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
  const [entries, setEntries] = useState<EntryWithReplies[]>([])
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
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set())

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

      // 各エントリーに対して返信を取得
      const entriesWithReplies: EntryWithReplies[] = await Promise.all(
        loadedEntries.map(async (entry) => {
          const replies = await database.select<Reply[]>(
            'SELECT id, entry_id, content, timestamp FROM replies WHERE entry_id = ? ORDER BY timestamp ASC',
            [entry.id]
          )
          return {
            ...entry,
            replies,
            replyCount: replies.length
          }
        })
      )

      setEntries(entriesWithReplies)
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

        const newEntry: EntryWithReplies = {
          id: Number(result.lastInsertId),
          content: currentEntry,
          timestamp: timestamp,
          replies: [],
          replyCount: 0
        }

        setEntries([newEntry, ...entries])
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

      // stateからエントリーを削除
      setEntries(entries.filter((entry) => entry.id !== deleteTargetId))

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

        const newReply: Reply = {
          id: Number(result.lastInsertId),
          entry_id: entryId,
          content: replyContent,
          timestamp: timestamp,
        }

        // 該当エントリーの返信リストを更新
        setEntries(entries.map(entry =>
          entry.id === entryId
            ? { ...entry, replies: [...entry.replies, newReply], replyCount: entry.replies.length + 1 }
            : entry
        ))

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

      // 該当エントリーの返信リストから削除
      setEntries(entries.map(entry =>
        entry.id === deleteReplyTarget.entryId
          ? {
              ...entry,
              replies: entry.replies.filter(r => r.id !== deleteReplyTarget.replyId),
              replyCount: entry.replies.length - 1
            }
          : entry
      ))

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

  const toggleExpandEntry = (entryId: number) => {
    setExpandedEntries(prev => {
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
          {entries.length === 0 ? (
            <p className="empty">この日の記録がありません</p>
          ) : (
            <div className="timeline-container">
              {entries.map((entry, index) => {
                const entryDate = new Date(entry.timestamp)
                const day = entryDate.getDate()
                const month = entryDate.toLocaleDateString('ja-JP', { month: 'short' })

                // 前のエントリーと日付を比較
                const prevEntry = index > 0 ? entries[index - 1] : null
                const prevDate = prevEntry ? new Date(prevEntry.timestamp).getDate() : null
                const showDate = prevDate !== day

                const isExpanded = expandedEntries.has(entry.id)
                const hasReplies = entry.replies.length > 0

                return (
                  <div key={entry.id} className="timeline-item">
                    <div className="timeline-date">
                      {showDate ? (
                        <>
                          <div className="date-day">{day}</div>
                          <div className="date-month">{month}</div>
                        </>
                      ) : null}
                      <div className="entry-time">{formatTimestamp(entry.timestamp)}</div>
                    </div>
                    <div className="timeline-line">
                      <div className="timeline-dot"></div>
                    </div>
                    <div className="timeline-content">
                      <div className="entry-card">
                        <button
                          className="delete-button"
                          onClick={() => openDeleteDialog(entry.id)}
                          aria-label="削除"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="entry-text">{entry.content}</div>

                        {/* 返信関連のボタン */}
                        <div className="entry-actions">
                          <button
                            className="reply-button"
                            onClick={() => toggleReplyForm(entry.id)}
                          >
                            💬 返信する
                          </button>

                          {hasReplies && (
                            <button
                              className="toggle-replies-button"
                              onClick={() => toggleExpandEntry(entry.id)}
                            >
                              {isExpanded ? '▼' : '▶'} 返信 ({entry.replyCount})
                            </button>
                          )}
                        </div>

                        {/* 返信入力フォーム */}
                        {replyingToId === entry.id && (
                          <div className="reply-input-section">
                            <textarea
                              data-reply-to={entry.id}
                              value={replyContent}
                              onChange={(e) => {
                                setReplyContent(e.target.value)
                                e.target.style.height = 'auto'
                                e.target.style.height = `${e.target.scrollHeight}px`
                              }}
                              onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                  e.preventDefault()
                                  handleAddReply(entry.id)
                                }
                              }}
                              placeholder="返信を入力..."
                              rows={1}
                              className="reply-textarea"
                            />
                            <div className="reply-buttons">
                              <button
                                onClick={() => handleAddReply(entry.id)}
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
                        {isExpanded && hasReplies && (
                          <div className="replies-container">
                            {entry.replies.map((reply) => (
                              <div key={reply.id} className="reply-item">
                                <div className="reply-header">
                                  <span className="reply-time">{formatTimestamp(reply.timestamp)}</span>
                                  <button
                                    className="delete-reply-button"
                                    onClick={() => openDeleteReplyDialog(reply.id, entry.id)}
                                    aria-label="削除"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                                <div className="reply-text">{reply.content}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
