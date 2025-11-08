import { useState } from 'react'
import './App.css'

function App() {
  const [entries, setEntries] = useState<string[]>([])
  const [currentEntry, setCurrentEntry] = useState('')

  const handleAddEntry = () => {
    if (currentEntry.trim()) {
      const timestamp = new Date().toLocaleTimeString('ja-JP')
      setEntries([...entries, `[${timestamp}] ${currentEntry}`])
      setCurrentEntry('')
    }
  }

  return (
    <div className="app">
      <header>
        <h1>funhou - 分報ツール</h1>
      </header>

      <main>
        <div className="input-section">
          <textarea
            value={currentEntry}
            onChange={(e) => setCurrentEntry(e.target.value)}
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
              {entries.map((entry, index) => (
                <li key={index}>{entry}</li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
