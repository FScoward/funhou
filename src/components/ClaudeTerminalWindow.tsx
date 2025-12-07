import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { CanvasAddon } from '@xterm/addon-canvas'
import {
  listenFromMainWindow,
  sendToMainWindow,
  closeTerminalWindow,
  type SessionSyncPayload,
} from '../lib/windowBridge'

interface ClaudeTerminalWindowProps {
  sessionId: string
}

/**
 * 別ウィンドウで表示されるターミナルコンポーネント
 * PTYはメインウィンドウで管理され、イベント経由で入出力を同期する
 */
export function ClaudeTerminalWindow({ sessionId }: ClaudeTerminalWindowProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [isReady, setIsReady] = useState(false)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const outputBufferRef = useRef<string[]>([])

  // ターミナルの初期化
  const initTerminal = useCallback(() => {
    if (!terminalRef.current) return

    const terminalTheme = {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      cursorAccent: '#1e1e1e',
      selectionBackground: 'rgba(255, 255, 255, 0.3)',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff',
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: terminalTheme,
      allowProposedApi: true,
      scrollback: 10000,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    term.open(terminalRef.current)

    // GPU アクセラレーション（WebGL > Canvas > DOM）
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        webglAddon.dispose()
      })
      term.loadAddon(webglAddon)
    } catch {
      try {
        term.loadAddon(new CanvasAddon())
      } catch {
        // DOM fallback
      }
    }

    // フィット
    setTimeout(() => {
      fitAddon.fit()
      // リサイズをメインウィンドウに通知
      sendToMainWindow(sessionId, {
        type: 'resize',
        data: { cols: term.cols, rows: term.rows },
      })
    }, 100)

    // 入力をメインウィンドウに転送
    term.onData((data) => {
      sendToMainWindow(sessionId, { type: 'input', data })
    })

    setTerminal(term)
    setIsReady(true)

    return () => {
      term.dispose()
    }
  }, [sessionId])

  // ターミナル初期化
  useEffect(() => {
    const cleanup = initTerminal()
    return cleanup
  }, [initTerminal])

  // メインウィンドウからの出力を受信
  useEffect(() => {
    if (!terminal || !isReady) return

    let unlisten: (() => void) | null = null

    const setupListener = async () => {
      unlisten = await listenFromMainWindow(sessionId, (payload: SessionSyncPayload) => {
        if (payload.type === 'output') {
          const data = payload.data as string
          terminal.write(data)
          outputBufferRef.current.push(data)
        } else if (payload.type === 'status') {
          // ステータス変更の処理（必要に応じて）
        } else if (payload.type === 'terminate') {
          // セッション終了の通知
          terminal.write('\r\n\x1b[33m[Session terminated]\x1b[0m\r\n')
        }
      })
    }

    setupListener()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [terminal, isReady, sessionId])

  // リサイズ対応
  useEffect(() => {
    if (!fitAddonRef.current || !terminal) return

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
        sendToMainWindow(sessionId, {
          type: 'resize',
          data: { cols: terminal.cols, rows: terminal.rows },
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [terminal, sessionId])

  // ウィンドウクローズ時の処理（beforeunloadイベントを使用）
  useEffect(() => {
    const handleBeforeUnload = () => {
      // メインウィンドウにウィンドウが閉じられたことを通知
      sendToMainWindow(sessionId, { type: 'terminate', data: 'window_closed' })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [sessionId])

  // クリック時にフォーカス
  const handleContainerClick = () => {
    terminal?.focus()
  }

  // 手動でウィンドウを閉じる
  const handleClose = async () => {
    // 先にメインウィンドウに通知を送信（awaiting to ensure delivery）
    await sendToMainWindow(sessionId, { type: 'terminate', data: 'window_closed' })
    // 少し待ってからウィンドウを閉じる
    await new Promise(resolve => setTimeout(resolve, 100))
    await closeTerminalWindow(sessionId)
  }

  return (
    <div
      className="fixed inset-0 bg-[#1e1e1e] overflow-hidden"
      onClick={handleContainerClick}
      onFocus={() => terminal?.focus()}
    >
      {/* 閉じるボタン（タイトルバーがない場合の代替） */}
      <button
        onClick={handleClose}
        className="absolute top-2 right-2 z-50 p-1.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded transition-colors"
        title="Close window"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div ref={terminalRef} className="absolute inset-0" />
    </div>
  )
}
