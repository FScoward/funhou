import React from 'react'
import ReactDOM from 'react-dom/client'
// xterm.css を最初にインポート（ビルド時のCSS順序問題対策）
import '@xterm/xterm/css/xterm.css'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
