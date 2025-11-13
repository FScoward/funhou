import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import './App.css'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ja } from 'date-fns/locale'

interface Entry {
  id: number
  content: string
  timestamp: string
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
  }
  return db
}

function App() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [currentEntry, setCurrentEntry] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)

  useEffect(() => {
    loadEntries()
  }, [selectedDate])

  const loadEntries = async () => {
    try {
      const database = await getDb()
      // 選択された日付のエントリーのみを取得（JSTタイムゾーンを考慮）
      const dateStr = selectedDate.toISOString().split('T')[0]
      const loadedEntries = await database.select<Entry[]>(
        'SELECT id, content, timestamp FROM entries WHERE DATE(timestamp) = DATE(?) ORDER BY timestamp DESC',
        [dateStr]
      )
      setEntries(loadedEntries)
    } catch (error) {
      console.error('エントリーの読み込みに失敗しました:', error)
    }
  }

  const handleAddEntry = async () => {
    if (currentEntry.trim()) {
      try {
        const database = await getDb()
        const timestamp = new Date().toISOString()

        const result = await database.execute(
          'INSERT INTO entries (content, timestamp) VALUES (?, ?)',
          [currentEntry, timestamp]
        )

        const newEntry: Entry = {
          id: Number(result.lastInsertId),
          content: currentEntry,
          timestamp: timestamp,
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
                        <div className="entry-text">{entry.content}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
