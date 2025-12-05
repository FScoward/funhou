import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useClaudeTerminal } from '../hooks/useClaudeTerminal'
import '@xterm/xterm/css/xterm.css'

interface ClaudeTerminalProps {
  cwd: string
  sessionId?: string
  onError?: (error: string) => void
}

export interface ClaudeTerminalHandle {
  gracefulShutdown: () => Promise<void>
  isShuttingDown: boolean
}

export const ClaudeTerminal = forwardRef<ClaudeTerminalHandle, ClaudeTerminalProps>(
  function ClaudeTerminal({ cwd, sessionId, onError }, ref) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const { initTerminal, spawnClaude, resumeClaude, gracefulShutdown, isReady, isShuttingDown, error } =
      useClaudeTerminal()
    const hasSpawned = useRef(false)

    // 親コンポーネントに gracefulShutdown を公開
    useImperativeHandle(ref, () => ({
      gracefulShutdown,
      isShuttingDown,
    }), [gracefulShutdown, isShuttingDown])

    // ターミナルの初期化
    useEffect(() => {
      if (!terminalRef.current) return

      const cleanup = initTerminal(terminalRef.current)
      return cleanup
    }, [initTerminal])

    // Claude Codeの起動
    useEffect(() => {
      if (isReady && !hasSpawned.current) {
        hasSpawned.current = true

        if (sessionId) {
          resumeClaude(sessionId, cwd)
        } else {
          spawnClaude(cwd)
        }
      }
    }, [isReady, cwd, sessionId, spawnClaude, resumeClaude])

    // エラーハンドリング
    useEffect(() => {
      if (error && onError) {
        onError(error)
      }
    }, [error, onError])

    return (
      <div className="absolute inset-0 bg-[#1e1e1e] rounded overflow-hidden">
        <div ref={terminalRef} className="absolute inset-0" />
      </div>
    )
  }
)
