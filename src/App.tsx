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

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    try {
      const database = await getDb()
      const loadedEntries = await database.select<Entry[]>(
        'SELECT id, content, timestamp FROM entries ORDER BY timestamp DESC'
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

  return (
    <div className="app">

      <main>
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
          <h2>今日の分報</h2>
          {entries.length === 0 ? (
            <p className="empty">まだ記録がありません</p>
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
