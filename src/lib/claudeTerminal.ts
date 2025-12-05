import { spawn, type IPty, type IDisposable } from 'tauri-pty'

export interface TerminalOptions {
  cwd: string
  cols?: number
  rows?: number
}

export interface ClaudeTerminalSession {
  pty: IPty
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => void
  onData: (callback: (data: string) => void) => IDisposable
}

/**
 * Claude Codeをインタラクティブモードで起動する
 */
export async function spawnClaudeTerminal(
  options: TerminalOptions
): Promise<ClaudeTerminalSession> {
  const cols = options.cols ?? 80
  const rows = options.rows ?? 24

  console.log('[claudeTerminal] spawning PTY with options:', { cols, rows, cwd: options.cwd })

  // ログインシェル経由でclaudeを起動（PATHを継承するため）
  const pty = spawn('/bin/zsh', ['-l'], {
    cols,
    rows,
    cwd: options.cwd,
  })

  console.log('[claudeTerminal] PTY spawned, pid:', pty.pid)

  // cdで指定ディレクトリに移動してからclaudeコマンドを送信
  // ログインシェルはcwdオプションを無視することがあるため
  console.log('[claudeTerminal] changing directory and starting claude...')
  const escapedCwd = options.cwd.replace(/'/g, "'\\''")
  pty.write(`cd '${escapedCwd}' && claude\n`)

  return {
    pty,
    write: (data: string) => pty.write(data),
    resize: (cols: number, rows: number) => pty.resize(cols, rows),
    kill: () => pty.kill(),
    onData: (callback: (data: string) => void) => pty.onData(callback),
  }
}

/**
 * Claude Codeを既存のセッションで再開する
 */
export async function resumeClaudeTerminal(
  sessionId: string,
  options: TerminalOptions
): Promise<ClaudeTerminalSession> {
  const cols = options.cols ?? 80
  const rows = options.rows ?? 24

  const pty = spawn('/bin/zsh', ['-l'], {
    cols,
    rows,
    cwd: options.cwd,
  })

  // cdで指定ディレクトリに移動してから--resumeオプション付きでclaudeを起動
  const escapedCwd = options.cwd.replace(/'/g, "'\\''")
  const escapedSessionId = sessionId.replace(/'/g, "'\\''")
  pty.write(`cd '${escapedCwd}' && claude --resume '${escapedSessionId}'\n`)

  return {
    pty,
    write: (data: string) => pty.write(data),
    resize: (cols: number, rows: number) => pty.resize(cols, rows),
    kill: () => pty.kill(),
    onData: (callback: (data: string) => void) => pty.onData(callback),
  }
}
