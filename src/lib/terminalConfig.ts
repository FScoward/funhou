import type { ITerminalOptions, ITheme } from '@xterm/xterm'

/**
 * ターミナルのテーマ設定
 * 埋め込みターミナルと別ウィンドウターミナルで共通
 */
export const terminalTheme: ITheme = {
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

/**
 * ターミナルの基本オプション
 * 埋め込みターミナルと別ウィンドウターミナルで共通
 */
export const terminalOptions: ITerminalOptions = {
  cursorBlink: true,
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  theme: terminalTheme,
  allowProposedApi: true,
  scrollback: 1000,
  // convertEol: false（デフォルト）- PTYは既に適切な改行コードを送信するため変換不要
  // trueにするとClaude Codeのステータスライン（カーソル移動）が壊れる
}

/**
 * 別ウィンドウターミナル用の追加オプション
 */
export const windowTerminalOptions: ITerminalOptions = {
  ...terminalOptions,
  scrollback: 10000,
}
