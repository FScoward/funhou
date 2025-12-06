import { useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react'
import { useClaudeTerminal } from '../hooks/useClaudeTerminal'
import { useClaudeTerminalSession } from '../contexts/ClaudeTerminalSessionContext'
// xterm.css は main.tsx でインポート済み

interface ClaudeTerminalProps {
  cwd: string
  sessionId?: string
  onError?: (error: string) => void
  /** Context モードで使用する場合 true */
  useContext?: boolean
  /** Context モードで使用する内部セッションID */
  contextSessionId?: string
}

export interface ClaudeTerminalHandle {
  gracefulShutdown: () => Promise<void>
  isShuttingDown: boolean
}

export const ClaudeTerminal = forwardRef<ClaudeTerminalHandle, ClaudeTerminalProps>(
  function ClaudeTerminal({ cwd, sessionId, onError, useContext = false, contextSessionId }, ref) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const hasSpawned = useRef(false)

    // Context を使用する場合
    const contextValue = useClaudeTerminalSession()
    const { subscribeToOutput, writeToSession, resizeSession, terminateSession, getSessionOutput } = contextValue

    // Context モードのオプションを構築（メモ化）
    const contextOptions = useMemo(() => {
      if (!useContext || !contextSessionId) return undefined
      return {
        sessionId: contextSessionId,
        subscribeToOutput,
        writeToSession,
        resizeSession,
        getSessionOutput,
      }
    }, [useContext, contextSessionId, subscribeToOutput, writeToSession, resizeSession, getSessionOutput])

    const { initTerminal, spawnClaude, resumeClaude, gracefulShutdown, isReady, isShuttingDown, error, terminal } =
      useClaudeTerminal(contextOptions)

    // 親コンポーネントに gracefulShutdown を公開
    useImperativeHandle(ref, () => ({
      gracefulShutdown: useContext && contextSessionId
        ? () => terminateSession(contextSessionId, true)
        : gracefulShutdown,
      isShuttingDown,
    }), [useContext, contextSessionId, gracefulShutdown, isShuttingDown, terminateSession])

    // ターミナルの初期化
    useEffect(() => {
      if (!terminalRef.current) return

      const cleanup = initTerminal(terminalRef.current)
      return cleanup
    }, [initTerminal])

    // Claude Codeの起動（非Context モードのみ）
    useEffect(() => {
      if (!useContext && isReady && !hasSpawned.current) {
        hasSpawned.current = true

        if (sessionId) {
          resumeClaude(sessionId, cwd)
        } else {
          spawnClaude(cwd)
        }
      }
    }, [useContext, isReady, cwd, sessionId, spawnClaude, resumeClaude])

    // エラーハンドリング
    useEffect(() => {
      if (error && onError) {
        onError(error)
      }
    }, [error, onError])

    // ターミナルにフォーカスを当てる
    useEffect(() => {
      if (terminal && isReady) {
        // 少し遅延させてからフォーカス（DOMの準備完了を待つ）
        const timer = setTimeout(() => {
          terminal.focus()
        }, 100)
        return () => clearTimeout(timer)
      }
    }, [terminal, isReady])

    // クリック時にターミナルにフォーカス
    const handleContainerClick = () => {
      terminal?.focus()
    }

    return (
      <div
        className="absolute inset-0 bg-[#1e1e1e] rounded overflow-hidden"
        onClick={handleContainerClick}
        onFocus={() => terminal?.focus()}
      >
        <div ref={terminalRef} className="absolute inset-0" />
      </div>
    )
  }
)
