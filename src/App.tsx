import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import './App.css'

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
          <div className="date-display">
            {formatDateWithWeekday(selectedDate)}
          </div>
          <button onClick={goToNextDay} className="nav-button">
            ▶
          </button>
          <button onClick={goToToday} className="today-button">
            今日
          </button>
        </div>

        <div className="input-section">
          <textarea
            value={currentEntry}
            onChange={(e) => setCurrentEntry(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="今やっていることを記録..."
            rows={3}
          />
          <button onClick={handleAddEntry}>記録</button>
        </div>

        <div className="timeline">
          <h2>{formatDateWithWeekday(selectedDate)}の分報</h2>
          {entries.length === 0 ? (
            <p className="empty">この日の記録がありません</p>
          ) : (
            <ul>
              {entries.map((entry) => (
                <li key={entry.id}>
                  [{formatTimestamp(entry.timestamp)}] {entry.content}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
