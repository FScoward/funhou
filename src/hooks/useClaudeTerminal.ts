import { useState, useCallback, useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { CanvasAddon } from '@xterm/addon-canvas'
import type { IDisposable } from '@xterm/xterm'
import {
  spawnClaudeTerminal,
  resumeClaudeTerminal,
  type ClaudeTerminalSession,
} from '../lib/claudeTerminal'

// xterm.jsが送信するDevice Attributes (DA)クエリをフィルタリング
// これらはClaude Codeで処理されずエコーバックされてしまう
// 注意: ESCシーケンスは \x1b で始まる。通常のアルファベットにはマッチしない
function filterDAQueries(data: string): string {
  // ESCで始まらない通常の入力はそのまま返す（高速パス）
  if (!data.includes('\x1b')) {
    return data
  }
  return data
    .replace(/\x1b\[c/g, '')        // Primary DA query
    .replace(/\x1b\[0c/g, '')       // Primary DA query (explicit)
    .replace(/\x1b\[>c/g, '')       // Secondary DA query
    .replace(/\x1b\[>0c/g, '')      // Secondary DA query (explicit)
    .replace(/\x1b\[=c/g, '')       // Tertiary DA query
    .replace(/\x1b\[=0c/g, '')      // Tertiary DA query (explicit)
}

// DA応答パターン（PTY出力からフィルタリング）
// Primary DA response: ESC[?Ps;Ps;...c (例: ESC[?1;2c)
function filterDAResponses(data: string): string {
  // ESCで始まらない通常の出力はそのまま返す（高速パス）
  if (!data.includes('\x1b') && !data.includes('?')) {
    return data
  }
  return data
    .replace(/\x1b\[\?[\d;]*c/g, '')     // 完全なDA応答 (ESC[?1;2c)
    .replace(/\?\d+(?:;\d+)*c/g, '')     // ESC[が欠けた場合 (?1;2c)
}

interface UseClaudeTerminalOptions {
  /** Context モードで使用する場合、セッションID を指定 */
  sessionId?: string
  /** Context モードで使用する場合、出力購読関数を指定 */
  subscribeToOutput?: (sessionId: string, callback: (data: string) => void) => () => void
  /** Context モードで使用する場合、入力送信関数を指定 */
  writeToSession?: (sessionId: string, data: string) => void
  /** Context モードで使用する場合、リサイズ関数を指定 */
  resizeSession?: (sessionId: string, cols: number, rows: number) => void
  /** Context モードで使用する場合、出力バッファ取得関数を指定 */
  getSessionOutput?: (sessionId: string) => string[]
}

export function useClaudeTerminal(options?: UseClaudeTerminalOptions) {
  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [session, setSession] = useState<ClaudeTerminalSession | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isShuttingDown, setIsShuttingDown] = useState(false)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const terminalDataDisposerRef = useRef<IDisposable | null>(null)

  // Context モードかどうか
  const isContextMode = options?.sessionId && options?.subscribeToOutput && options?.writeToSession

  // ターミナルの初期化
  const initTerminal = useCallback((element: HTMLElement) => {
    containerRef.current = element

    const terminalTheme = {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      cursorAccent: '#1e1e1e',
      selectionBackground: 'rgba(255, 255, 255, 0.3)',
      // ANSIカラーを明示的に設定
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

    console.log('[useClaudeTerminal] Creating terminal with theme:', terminalTheme)

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      allowProposedApi: true,
      // ロガーを追加してxterm.jsのデバッグ情報を出力
      logger: {
        trace: (message: string, ...args: unknown[]) => console.log('[xterm:trace]', message, ...args),
        debug: (message: string, ...args: unknown[]) => console.log('[xterm:debug]', message, ...args),
        info: (message: string, ...args: unknown[]) => console.log('[xterm:info]', message, ...args),
        warn: (message: string, ...args: unknown[]) => console.warn('[xterm:warn]', message, ...args),
        error: (message: string, ...args: unknown[]) => console.error('[xterm:error]', message, ...args),
      },
    })

    // テーマを明示的に設定（コンストラクタで設定すると一部環境で無視される問題の対策）
    term.options.theme = terminalTheme
    console.log('[useClaudeTerminal] Theme set after constructor')

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    term.open(element)

    // open後にテーマを再設定（DOMに接続された後に設定する必要がある場合がある）
    term.options.theme = terminalTheme
    console.log('[useClaudeTerminal] Theme set after open')

    // レンダラーを試行: WebGL -> Canvas -> デフォルト
    let rendererLoaded = false

    // 1. WebGL レンダラーを試行
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        console.warn('[useClaudeTerminal] WebGL context lost, disposing addon')
        webglAddon.dispose()
      })
      term.loadAddon(webglAddon)
      console.log('[useClaudeTerminal] WebGL renderer loaded successfully')
      // WebGLロード後にテーマを再適用（ビルド版での色問題対策）
      term.options.theme = terminalTheme
      rendererLoaded = true
    } catch (e) {
      console.warn('[useClaudeTerminal] WebGL not supported:', e)
    }

    // 2. WebGL が失敗した場合、Canvas レンダラーを試行
    if (!rendererLoaded) {
      try {
        const canvasAddon = new CanvasAddon()
        term.loadAddon(canvasAddon)
        console.log('[useClaudeTerminal] Canvas renderer loaded successfully')
        // Canvasロード後にテーマを再適用
        term.options.theme = terminalTheme
        rendererLoaded = true
      } catch (e) {
        console.warn('[useClaudeTerminal] Canvas renderer not supported:', e)
      }
    }

    if (!rendererLoaded) {
      console.log('[useClaudeTerminal] Using default DOM renderer')
    }

    // 最終的にテーマが適用されていることを確認
    console.log('[useClaudeTerminal] Final theme applied:', term.options.theme)

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

  // アタッチ済みのセッションIDを保持（同じセッションに対する重複アタッチを防止）
  const attachedSessionIdRef = useRef<string | null>(null)

  // optionsをrefに保持（useCallback内で最新の値を参照するため）
  const optionsRef = useRef(options)
  optionsRef.current = options

  // terminalをrefに保持
  const terminalRef = useRef(terminal)
  terminalRef.current = terminal

  // Context モード: セッションにアタッチ（依存配列を空にして安定した参照を維持）
  const attachToSession = useCallback(() => {
    const currentTerminal = terminalRef.current
    const currentOptions = optionsRef.current
    const currentIsContextMode = currentOptions?.sessionId && currentOptions?.subscribeToOutput && currentOptions?.writeToSession

    if (!currentTerminal || !currentIsContextMode || !currentOptions?.sessionId) return

    // 同じセッションに既にアタッチ済みの場合はスキップ
    if (attachedSessionIdRef.current === currentOptions.sessionId) {
      return
    }

    console.log('[useClaudeTerminal] Attaching to session:', currentOptions.sessionId)
    attachedSessionIdRef.current = currentOptions.sessionId

    // ターミナルをクリアしてからバッファを復元（再アタッチ時の重複防止）
    currentTerminal.clear()

    // バッファから過去の出力を復元
    if (currentOptions.getSessionOutput) {
      const buffer = currentOptions.getSessionOutput(currentOptions.sessionId)
      if (buffer.length > 0) {
        console.log('[useClaudeTerminal] Restoring buffer:', buffer.length, 'chunks')
        // DA応答をフィルタリングして復元
        buffer.forEach((chunk) => currentTerminal.write(filterDAResponses(chunk)))
      }
    }

    // 新しい出力を購読（既存のがあればクリア）
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
    }
    const unsubscribe = currentOptions.subscribeToOutput!(currentOptions.sessionId, (data) => {
      // デバッグ: ANSIエスケープコードが含まれているか確認
      if (data.includes('\x1b[')) {
        console.log('[useClaudeTerminal] Data contains ANSI codes, sample:', JSON.stringify(data.substring(0, 100)))
      }
      // DA応答をフィルタリング
      terminalRef.current?.write(filterDAResponses(data))
    })
    unsubscribeRef.current = unsubscribe

    // 入力をセッションに転送（既存のリスナーをクリア）
    if (terminalDataDisposerRef.current) {
      terminalDataDisposerRef.current.dispose()
    }
    const sessionId = currentOptions.sessionId
    const writeToSession = currentOptions.writeToSession!

    // xterm.jsの内部textareaを取得してkeydownイベントを直接監視
    // xterm.jsのonDataはTauriのWebViewで取りこぼしが発生するため
    const xtermTextarea = currentTerminal.element?.querySelector('textarea.xterm-helper-textarea') as HTMLTextAreaElement | null

    if (xtermTextarea) {
      // 既存のリスナーをクリア
      if (terminalDataDisposerRef.current) {
        terminalDataDisposerRef.current.dispose()
      }

      // IME入力中フラグ
      let isComposing = false

      // compositionイベントでIME入力状態を追跡
      const handleCompositionStart = () => {
        isComposing = true
      }

      const handleCompositionEnd = (e: CompositionEvent) => {
        isComposing = false
        // compositionend時に確定したテキストを送信
        if (e.data) {
          writeToSession(sessionId, e.data)
        }
      }

      // inputイベントを使用（IME入力中は無視）
      const handleInput = (e: Event) => {
        // IME入力中はcompositionendで処理するのでスキップ
        if (isComposing) return

        const inputEvent = e as InputEvent
        if (inputEvent.data) {
          writeToSession(sessionId, inputEvent.data)
        }
      }

      // keydownイベントも監視（特殊キー用）
      const handleKeyDown = (e: KeyboardEvent) => {
        // IME入力中はEscape以外を無視（Enter含む）
        // e.isComposingも併用（ブラウザのネイティブプロパティ）
        if (isComposing || e.isComposing) {
          if (e.key === 'Escape') {
            // Escapeのみ処理（IMEキャンセル用）
            writeToSession(sessionId, '\x1b')
            e.preventDefault()
          }
          return
        }

        // keyCode 229はIME処理中を示す
        if (e.keyCode === 229) {
          return
        }

        let data = ''
        let preventDefault = false

        if (e.key === 'Enter') {
          data = '\r'
          preventDefault = true
        } else if (e.key === 'Backspace') {
          data = '\x7f'
          preventDefault = true
        } else if (e.key === 'Delete') {
          data = '\x1b[3~'
          preventDefault = true
        } else if (e.key === 'Tab') {
          data = '\t'
          preventDefault = true
        } else if (e.key === 'Escape') {
          data = '\x1b'
          preventDefault = true
        } else if (e.key === 'ArrowUp') {
          data = '\x1b[A'
          preventDefault = true
        } else if (e.key === 'ArrowDown') {
          data = '\x1b[B'
          preventDefault = true
        } else if (e.key === 'ArrowRight') {
          data = '\x1b[C'
          preventDefault = true
        } else if (e.key === 'ArrowLeft') {
          data = '\x1b[D'
          preventDefault = true
        } else if (e.key === 'Home') {
          data = '\x1b[H'
          preventDefault = true
        } else if (e.key === 'End') {
          data = '\x1b[F'
          preventDefault = true
        } else if (e.ctrlKey && e.key.length === 1) {
          // Ctrl+文字
          const code = e.key.toLowerCase().charCodeAt(0) - 96
          if (code > 0 && code < 27) {
            data = String.fromCharCode(code)
            preventDefault = true
          }
        }

        if (data) {
          writeToSession(sessionId, data)
        }
        if (preventDefault) {
          e.preventDefault()
        }
      }

      xtermTextarea.addEventListener('compositionstart', handleCompositionStart)
      xtermTextarea.addEventListener('compositionend', handleCompositionEnd)
      xtermTextarea.addEventListener('input', handleInput)
      // keydownはキャプチャフェーズで捕捉（他のハンドラより先に処理）
      xtermTextarea.addEventListener('keydown', handleKeyDown, true)

      terminalDataDisposerRef.current = {
        dispose: () => {
          xtermTextarea.removeEventListener('compositionstart', handleCompositionStart)
          xtermTextarea.removeEventListener('compositionend', handleCompositionEnd)
          xtermTextarea.removeEventListener('input', handleInput)
          xtermTextarea.removeEventListener('keydown', handleKeyDown, true)
        }
      }
    } else {
      // フォールバック: xterm.jsのonDataを使用
      terminalDataDisposerRef.current = currentTerminal.onData((data) => {
        writeToSession(sessionId, data)
      })
    }

    // PTY のサイズをターミナルに同期
    if (currentOptions.resizeSession) {
      console.log('[useClaudeTerminal] Resizing PTY to match terminal:', currentTerminal.cols, currentTerminal.rows)
      currentOptions.resizeSession(sessionId, currentTerminal.cols, currentTerminal.rows)
    }

    console.log('[useClaudeTerminal] Attached to session')
  }, []) // 依存配列を空にして安定した参照を維持

  // Context モード: セッションからデタッチ（コンポーネントアンマウント時のみ呼ばれる）
  const detachFromSession = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    if (terminalDataDisposerRef.current) {
      terminalDataDisposerRef.current.dispose()
      terminalDataDisposerRef.current = null
    }
    attachedSessionIdRef.current = null
    console.log('[useClaudeTerminal] Detached from session')
  }, [])

  // detachFromSessionをrefに保持（cleanup用）
  const detachFromSessionRef = useRef(detachFromSession)
  detachFromSessionRef.current = detachFromSession

  // isReady になったら自動的にアタッチ（Context モードの場合）
  // 依存配列を最小限にしてcleanupの誤発火を防ぐ
  const sessionIdRef = useRef(options?.sessionId)
  sessionIdRef.current = options?.sessionId

  useEffect(() => {
    if (isReady && isContextMode) {
      // セッションIDが変わった場合は一度デタッチしてから再アタッチ
      if (attachedSessionIdRef.current && attachedSessionIdRef.current !== options?.sessionId) {
        detachFromSessionRef.current()
      }
      attachToSession()
    }
    // cleanup は コンポーネントがアンマウントされる時のみ呼ばれる
    return () => {
      detachFromSessionRef.current()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, options?.sessionId]) // sessionIdの変化時にも再アタッチ

  // Claude Codeを起動（非Context モード用）
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
          // DA応答をフィルタリング
          terminal.write(filterDAResponses(data))
        })

        // Terminal -> PTY
        terminal.onData((data) => {
          // DAクエリをフィルタリング（Claude Codeで処理されないため）
          const filtered = filterDAQueries(data)
          if (filtered) {
            ptySession.write(filtered)
          }
        })

        setSession(ptySession)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Claude Codeの起動に失敗しました: ${message}`)
      }
    },
    [terminal]
  )

  // セッションを再開（非Context モード用）
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
          // DA応答をフィルタリング
          terminal.write(filterDAResponses(data))
        })

        // Terminal -> PTY
        terminal.onData((data) => {
          // DAクエリをフィルタリング（Claude Codeで処理されないため）
          const filtered = filterDAQueries(data)
          if (filtered) {
            ptySession.write(filtered)
          }
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

  // Claude を正常終了させる（非Context モード用）
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

  // クリーンアップ（非Context モードの場合のみ）
  useEffect(() => {
    return () => {
      if (!isContextMode) {
        try {
          session?.kill()
        } catch (e) {
          // ignore
        }
      }
    }
  }, [session, isContextMode])

  return {
    initTerminal,
    spawnClaude,
    resumeClaude,
    resize,
    gracefulShutdown,
    attachToSession,
    detachFromSession,
    isReady,
    isShuttingDown,
    error,
    terminal,
    session,
  }
}
