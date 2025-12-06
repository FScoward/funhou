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
 * Claude Codeをセッション選択画面で再開する
 * 注意: アプリが生成するセッションIDはClaude Codeの実際のセッションIDとは異なるため、
 * セッション選択画面を表示してユーザーに選択させる
 */
export async function resumeClaudeTerminal(
  _sessionId: string,
  options: TerminalOptions
): Promise<ClaudeTerminalSession> {
  const cols = options.cols ?? 80
  const rows = options.rows ?? 24

  const pty = spawn('/bin/zsh', ['-l'], {
    cols,
    rows,
    cwd: options.cwd,
  })

  const escapedCwd = options.cwd.replace(/'/g, "'\\''")

  // セッション選択画面を表示（ユーザーが選択）
  console.log('[claudeTerminal] Opening session picker for resume')
  pty.write(`cd '${escapedCwd}' && claude --resume\n`)

  return {
    pty,
    write: (data: string) => pty.write(data),
    resize: (cols: number, rows: number) => pty.resize(cols, rows),
    kill: () => pty.kill(),
    onData: (callback: (data: string) => void) => pty.onData(callback),
  }
}
