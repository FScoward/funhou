import { useState, useCallback, useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import {
  spawnClaudeTerminal,
  resumeClaudeTerminal,
  type ClaudeTerminalSession,
} from '../lib/claudeTerminal'

export function useClaudeTerminal() {
  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [session, setSession] = useState<ClaudeTerminalSession | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isShuttingDown, setIsShuttingDown] = useState(false)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)

  // ターミナルの初期化
  const initTerminal = useCallback((element: HTMLElement) => {
    containerRef.current = element

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
      },
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    term.open(element)

    // 少し遅延を入れてからfitを呼ぶ（DOMの準備完了を待つ）
    requestAnimationFrame(() => {
      fitAddon.fit()
    })

    setTerminal(term)
    setIsReady(true)

    return () => {
      term.dispose()
      setTerminal(null)
      setIsReady(false)
    }
  }, [])

  // Claude Codeを起動
  const spawnClaude = useCallback(
    async (cwd: string) => {
      if (!terminal) {
        setError('ターミナルが初期化されていません')
        return
      }

      setError(null)
      console.log('[useClaudeTerminal] spawnClaude called with cwd:', cwd)
      console.log('[useClaudeTerminal] terminal cols:', terminal.cols, 'rows:', terminal.rows)

      try {
        const ptySession = await spawnClaudeTerminal({
          cwd,
          cols: terminal.cols,
          rows: terminal.rows,
        })
        console.log('[useClaudeTerminal] PTY session created:', ptySession)

        // PTY -> Terminal
        ptySession.onData((data) => {
          terminal.write(data)
        })

        // Terminal -> PTY
        terminal.onData((data) => {
          ptySession.write(data)
        })

        setSession(ptySession)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Claude Codeの起動に失敗しました: ${message}`)
      }
    },
    [terminal]
  )

  // セッションを再開
  const resumeClaude = useCallback(
    async (sessionId: string, cwd: string) => {
      if (!terminal) {
        setError('ターミナルが初期化されていません')
        return
      }

      setError(null)

      try {
        const ptySession = await resumeClaudeTerminal(sessionId, {
          cwd,
          cols: terminal.cols,
          rows: terminal.rows,
        })

        // PTY -> Terminal
        ptySession.onData((data) => {
          terminal.write(data)
        })

        // Terminal -> PTY
        terminal.onData((data) => {
          ptySession.write(data)
        })

        setSession(ptySession)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`セッションの再開に失敗しました: ${message}`)
      }
    },
    [terminal]
  )

  // リサイズ処理
  const resize = useCallback(() => {
    if (fitAddonRef.current && terminal && session) {
      fitAddonRef.current.fit()
      session.resize(terminal.cols, terminal.rows)
    }
  }, [terminal, session])

  // Claude を正常終了させる
  const gracefulShutdown = useCallback(async (): Promise<void> => {
    if (!session) {
      console.log('[useClaudeTerminal] No session to shutdown')
      return
    }

    if (isShuttingDown) {
      console.log('[useClaudeTerminal] Already shutting down')
      return
    }

    setIsShuttingDown(true)
    console.log('[useClaudeTerminal] Starting graceful shutdown...')

    try {
      // Escape キーを送信してモードをリセット
      session.write('\x1b')
      await new Promise(resolve => setTimeout(resolve, 100))

      // Ctrl+C を複数回送信して、実行中の処理があれば中断
      session.write('\x03')
      await new Promise(resolve => setTimeout(resolve, 200))
      session.write('\x03')
      await new Promise(resolve => setTimeout(resolve, 200))

      // /exit コマンドを送信
      console.log('[useClaudeTerminal] Sending /exit command...')
      session.write('/exit\n')

      // Claude がセッションを保存するのを待つ（十分な時間を確保）
      await new Promise(resolve => setTimeout(resolve, 3000))

      // シェルを終了
      console.log('[useClaudeTerminal] Sending exit command...')
      session.write('exit\n')

      // 少し待つ
      await new Promise(resolve => setTimeout(resolve, 300))

      console.log('[useClaudeTerminal] Graceful shutdown complete, killing PTY')
    } catch (err) {
      console.error('[useClaudeTerminal] Error during graceful shutdown:', err)
    } finally {
      // PTY を終了
      try {
        session.kill()
      } catch (e) {
        // "No such process" エラーは無視（既に終了している）
        if (!String(e).includes('No such process')) {
          console.error('[useClaudeTerminal] Error killing PTY:', e)
        }
      }
      setIsShuttingDown(false)
      setSession(null)
      console.log('[useClaudeTerminal] Shutdown complete')
    }
  }, [session, isShuttingDown])

  // ウィンドウリサイズ時にターミナルをリサイズ
  useEffect(() => {
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [resize])

  // クリーンアップ
  useEffect(() => {
    return () => {
      try {
        session?.kill()
      } catch (e) {
        // ignore
      }
    }
  }, [session])

  return {
    initTerminal,
    spawnClaude,
    resumeClaude,
    resize,
    gracefulShutdown,
    isReady,
    isShuttingDown,
    error,
    terminal,
    session,
  }
}
