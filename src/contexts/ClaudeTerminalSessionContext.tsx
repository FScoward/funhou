import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import {
  spawnClaudeTerminal,
  resumeClaudeTerminal,
  type ClaudeTerminalSession,
} from '../lib/claudeTerminal'
import type { IDisposable } from 'tauri-pty'

// DA応答パターン（PTY出力からフィルタリング）
// Primary DA response: ESC[?Ps;Ps;...c (例: ESC[?1;2c)
// 分割されて届く場合もあるので、?で始まるパターンも追加
const DA_RESPONSE_PATTERNS = [
  /\x1b\[\?[\d;]*c/g,     // 完全なDA応答 (ESC[?1;2c)
  /\?\d+(?:;\d+)*c/g,     // ESC[が欠けた場合 (?1;2c)
]

function filterDAResponses(data: string): string {
  let filtered = data
  for (const pattern of DA_RESPONSE_PATTERNS) {
    filtered = filtered.replace(pattern, '')
  }
  return filtered
}

// セッション状態の型定義
export type SessionStatus = 'initializing' | 'running' | 'waiting_input' | 'stopped' | 'error'

export interface TerminalSession {
  id: string
  pty: ClaudeTerminalSession
  outputBuffer: string[]
  status: SessionStatus
  cwd: string
  claudeSessionId?: string
  createdAt: Date
  lastActivityAt: Date
  error?: string
}

// Context の値の型定義
interface ClaudeTerminalSessionContextValue {
  // 状態
  sessions: Map<string, TerminalSession>
  activeSessionId: string | null

  // セッション操作
  createSession: (cwd: string, claudeSessionId?: string) => Promise<string>
  getSession: (sessionId: string) => TerminalSession | undefined
  getActiveSessions: () => TerminalSession[]
  terminateSession: (sessionId: string, graceful?: boolean) => Promise<void>
  resizeSession: (sessionId: string, cols: number, rows: number) => void

  // 入出力
  writeToSession: (sessionId: string, data: string) => void
  getSessionOutput: (sessionId: string) => string[]
  subscribeToOutput: (sessionId: string, callback: (data: string) => void) => () => void

  // UI状態
  setActiveSession: (sessionId: string | null) => void
  isDialogOpen: boolean
  setDialogOpen: (open: boolean) => void
  widgetExpanded: boolean
  setWidgetExpanded: (expanded: boolean) => void
}

const ClaudeTerminalSessionContext = createContext<ClaudeTerminalSessionContextValue | null>(null)

const MAX_BUFFER_SIZE = 10000

export function ClaudeTerminalSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Map<string, TerminalSession>>(new Map())
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [widgetExpanded, setWidgetExpanded] = useState(false)

  // sessionsの最新値を参照するためのref（useCallbackのクロージャ問題を回避）
  const sessionsRef = useRef<Map<string, TerminalSession>>(sessions)
  sessionsRef.current = sessions

  // 出力購読者を管理
  const outputSubscribersRef = useRef<Map<string, Set<(data: string) => void>>>(new Map())
  // PTYのonDataのdisposerを管理
  const ptyDisposersRef = useRef<Map<string, IDisposable>>(new Map())

  // セッションIDの生成
  const generateSessionId = useCallback(() => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // 入力待ち検知用のタイマー管理
  const idleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const IDLE_TIMEOUT_MS = 2000 // 2秒間出力がなければ「完了」

  // 出力データの処理
  const handlePtyData = useCallback((sessionId: string, data: string) => {
    // DA応答をフィルタリング
    const filteredData = filterDAResponses(data)

    // 既存のタイマーをクリア
    const existingTimer = idleTimersRef.current.get(sessionId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // セッションを「実行中」に更新
    setSessions((prev) => {
      const session = prev.get(sessionId)
      if (!session) return prev

      const newBuffer = [...session.outputBuffer, filteredData]
      // バッファサイズ制限
      const trimmedBuffer = newBuffer.length > MAX_BUFFER_SIZE
        ? newBuffer.slice(-MAX_BUFFER_SIZE / 2)
        : newBuffer

      const newSession: TerminalSession = {
        ...session,
        outputBuffer: trimmedBuffer,
        lastActivityAt: new Date(),
        status: 'running',
      }

      const newMap = new Map(prev)
      newMap.set(sessionId, newSession)
      return newMap
    })

    // 新しいタイマーを設定（一定時間後に「完了」に変更）
    const timer = setTimeout(() => {
      setSessions((prev) => {
        const session = prev.get(sessionId)
        if (!session || session.status !== 'running') return prev

        const newSession: TerminalSession = {
          ...session,
          status: 'waiting_input',
        }

        const newMap = new Map(prev)
        newMap.set(sessionId, newSession)
        return newMap
      })
      idleTimersRef.current.delete(sessionId)
    }, IDLE_TIMEOUT_MS)

    idleTimersRef.current.set(sessionId, timer)

    // 購読者に通知（フィルタリング済みデータ）
    const subscribers = outputSubscribersRef.current.get(sessionId)
    if (subscribers) {
      subscribers.forEach((callback) => callback(filteredData))
    }
  }, [])

  // セッションの作成
  const createSession = useCallback(async (cwd: string, claudeSessionId?: string): Promise<string> => {
    const sessionId = generateSessionId()

    const newSession: TerminalSession = {
      id: sessionId,
      pty: null as unknown as ClaudeTerminalSession, // 後で設定
      outputBuffer: [],
      status: 'initializing',
      cwd,
      claudeSessionId,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    }

    // まずセッションを追加（initializingステータス）
    setSessions((prev) => {
      const newMap = new Map(prev)
      newMap.set(sessionId, newSession)
      return newMap
    })

    try {
      // PTYを起動
      const ptySession = claudeSessionId
        ? await resumeClaudeTerminal(claudeSessionId, { cwd, cols: 80, rows: 24 })
        : await spawnClaudeTerminal({ cwd, cols: 80, rows: 24 })

      // onDataリスナーを設定
      const disposer = ptySession.onData((data) => {
        handlePtyData(sessionId, data)
      })
      ptyDisposersRef.current.set(sessionId, disposer)

      // セッションを更新
      setSessions((prev) => {
        const session = prev.get(sessionId)
        if (!session) return prev

        const updatedSession: TerminalSession = {
          ...session,
          pty: ptySession,
          status: 'running',
        }

        const newMap = new Map(prev)
        newMap.set(sessionId, updatedSession)
        return newMap
      })

      setActiveSessionId(sessionId)
      return sessionId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setSessions((prev) => {
        const session = prev.get(sessionId)
        if (!session) return prev

        const updatedSession: TerminalSession = {
          ...session,
          status: 'error',
          error: errorMessage,
        }

        const newMap = new Map(prev)
        newMap.set(sessionId, updatedSession)
        return newMap
      })
      throw err
    }
  }, [generateSessionId, handlePtyData])

  // セッションの取得（refを使って安定した関数参照を維持）
  const getSession = useCallback((sessionId: string): TerminalSession | undefined => {
    return sessionsRef.current.get(sessionId)
  }, [])

  // アクティブセッション（stopped以外）を取得（refを使って安定した関数参照を維持）
  const getActiveSessions = useCallback((): TerminalSession[] => {
    return Array.from(sessionsRef.current.values()).filter(
      (session) => session.status !== 'stopped'
    )
  }, [])

  // セッションの終了（refを使って安定した関数参照を維持）
  const terminateSession = useCallback(async (sessionId: string, graceful = true): Promise<void> => {
    const session = sessionsRef.current.get(sessionId)
    if (!session || !session.pty) return

    if (graceful) {
      try {
        // Escape キーを送信してモードをリセット
        session.pty.write('\x1b')
        await new Promise(resolve => setTimeout(resolve, 100))

        // Ctrl+C を複数回送信
        session.pty.write('\x03')
        await new Promise(resolve => setTimeout(resolve, 200))
        session.pty.write('\x03')
        await new Promise(resolve => setTimeout(resolve, 200))

        // /exit コマンドを送信
        session.pty.write('/exit\n')
        await new Promise(resolve => setTimeout(resolve, 3000))

        // シェルを終了
        session.pty.write('exit\n')
        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (err) {
        console.error('[ClaudeTerminalSessionContext] Error during graceful shutdown:', err)
      }
    }

    try {
      session.pty.kill()
    } catch (e) {
      if (!String(e).includes('No such process')) {
        console.error('[ClaudeTerminalSessionContext] Error killing PTY:', e)
      }
    }

    // onDataのdisposerをクリーンアップ
    const disposer = ptyDisposersRef.current.get(sessionId)
    if (disposer) {
      disposer.dispose()
      ptyDisposersRef.current.delete(sessionId)
    }

    // 購読者をクリア
    outputSubscribersRef.current.delete(sessionId)

    // セッションを更新
    setSessions((prev) => {
      const session = prev.get(sessionId)
      if (!session) return prev

      const updatedSession: TerminalSession = {
        ...session,
        status: 'stopped',
      }

      const newMap = new Map(prev)
      newMap.set(sessionId, updatedSession)
      return newMap
    })

    // アクティブセッションをクリア
    if (activeSessionId === sessionId) {
      setActiveSessionId(null)
    }
  }, [activeSessionId])

  // セッションへの書き込み（refを使って常に最新のsessionsを参照）
  const writeToSession = useCallback((sessionId: string, data: string) => {
    const session = sessionsRef.current.get(sessionId)
    if (session?.pty) {
      session.pty.write(data)
    }
  }, [])

  // セッションのリサイズ（refを使って常に最新のsessionsを参照）
  const resizeSession = useCallback((sessionId: string, cols: number, rows: number) => {
    const session = sessionsRef.current.get(sessionId)
    if (session?.pty) {
      console.log('[ClaudeTerminalSessionContext] Resizing session:', sessionId, cols, rows)
      session.pty.resize(cols, rows)
    }
  }, [])

  // セッション出力の取得（refを使って安定した関数参照を維持）
  const getSessionOutput = useCallback((sessionId: string): string[] => {
    const session = sessionsRef.current.get(sessionId)
    return session?.outputBuffer ?? []
  }, [])

  // 出力の購読
  const subscribeToOutput = useCallback((sessionId: string, callback: (data: string) => void): () => void => {
    if (!outputSubscribersRef.current.has(sessionId)) {
      outputSubscribersRef.current.set(sessionId, new Set())
    }
    outputSubscribersRef.current.get(sessionId)!.add(callback)

    return () => {
      const subscribers = outputSubscribersRef.current.get(sessionId)
      if (subscribers) {
        subscribers.delete(callback)
      }
    }
  }, [])

  const setDialogOpen = useCallback((open: boolean) => {
    setIsDialogOpen(open)
  }, [])

  const value: ClaudeTerminalSessionContextValue = {
    sessions,
    activeSessionId,
    createSession,
    getSession,
    getActiveSessions,
    terminateSession,
    resizeSession,
    writeToSession,
    getSessionOutput,
    subscribeToOutput,
    setActiveSession: setActiveSessionId,
    isDialogOpen,
    setDialogOpen,
    widgetExpanded,
    setWidgetExpanded,
  }

  return (
    <ClaudeTerminalSessionContext.Provider value={value}>
      {children}
    </ClaudeTerminalSessionContext.Provider>
  )
}

export function useClaudeTerminalSession(): ClaudeTerminalSessionContextValue {
  const context = useContext(ClaudeTerminalSessionContext)
  if (!context) {
    throw new Error('useClaudeTerminalSession must be used within a ClaudeTerminalSessionProvider')
  }
  return context
}
