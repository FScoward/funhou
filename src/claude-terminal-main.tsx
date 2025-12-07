import React from 'react'
import ReactDOM from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import { ClaudeTerminalWindow } from './components/ClaudeTerminalWindow'
import './index.css'

// URLパラメータからセッションIDを取得
const params = new URLSearchParams(window.location.search)
const sessionId = params.get('sessionId')

if (sessionId) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ClaudeTerminalWindow sessionId={sessionId} />
    </React.StrictMode>
  )
} else {
  // セッションIDがない場合はエラー表示
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <div style={{ color: '#ff6b6b', padding: '20px', fontFamily: 'monospace' }}>
        Error: No sessionId provided in URL parameters
      </div>
    </React.StrictMode>
  )
}
