import { spawn, type IPty, type IDisposable } from 'tauri-pty'

export interface TerminalOptions {
  cwd: string
  cols?: number
  rows?: number
}

// PTY用の環境変数を設定（Finderからダブルクリックで起動した場合でも色が出るようにする）
// 注意: ブラウザ環境なのでprocess.envは使用できない。最低限必要な環境変数のみ設定。
const PTY_ENV: Record<string, string> = {
  TERM: 'xterm-256color',
  COLORTERM: 'truecolor',
  LANG: 'ja_JP.UTF-8',
  SHELL: '/bin/zsh',
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

  // ログインシェル経由でclaudeを起動（PATHを継承するため）
  const pty = spawn('/bin/zsh', ['-l'], {
    cols,
    rows,
    cwd: options.cwd,
    env: PTY_ENV,
  })

  // cdで指定ディレクトリに移動してからclaudeコマンドを送信
  // ログインシェルはcwdオプションを無視することがあるため
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
 * Claude Codeを指定されたセッションIDで再開する
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
    env: PTY_ENV,
  })

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
