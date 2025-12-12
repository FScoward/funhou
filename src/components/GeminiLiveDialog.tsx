/**
 * Gemini Live 対話ダイアログ
 * - 対話状態の表示
 * - メッセージ履歴の表示
 * - セッション制御
 */

import { useRef, useEffect } from 'react'
import { X, Mic, MicOff, Loader2, Volume2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GeminiLiveState, GeminiLiveDialogMessage } from '@/types/geminiLive'
import { cn } from '@/lib/utils'

interface GeminiLiveDialogProps {
  isOpen: boolean
  onClose: () => void
  state: GeminiLiveState
  error: string | null
  messages: GeminiLiveDialogMessage[]
  currentTranscript: string
  currentResponse: string
  onStart: () => void
  onStop: () => void
  isSpeechListening?: boolean
}

// 状態表示コンポーネント
function StateIndicator({ state }: { state: GeminiLiveState }) {
  const stateConfig: Record<
    GeminiLiveState,
    { icon: React.ReactNode; label: string; color: string }
  > = {
    idle: {
      icon: <MicOff size={16} />,
      label: '待機中',
      color: 'text-muted-foreground',
    },
    connecting: {
      icon: <Loader2 size={16} className="animate-spin" />,
      label: '接続中...',
      color: 'text-blue-500',
    },
    ready: {
      icon: <Mic size={16} />,
      label: '準備完了',
      color: 'text-green-500',
    },
    listening: {
      icon: <Mic size={16} className="animate-pulse" />,
      label: 'リスニング中',
      color: 'text-green-500',
    },
    processing: {
      icon: <Loader2 size={16} className="animate-spin" />,
      label: '処理中...',
      color: 'text-yellow-500',
    },
    speaking: {
      icon: <Volume2 size={16} className="animate-pulse" />,
      label: '応答中',
      color: 'text-purple-500',
    },
    error: {
      icon: <AlertCircle size={16} />,
      label: 'エラー',
      color: 'text-destructive',
    },
  }

  const config = stateConfig[state]

  return (
    <div className={cn('flex items-center gap-2', config.color)}>
      {config.icon}
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  )
}

// メッセージアイテムコンポーネント
function MessageItem({ message }: { message: GeminiLiveDialogMessage }) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex flex-col gap-1 p-3 rounded-lg max-w-[85%]',
        isUser
          ? 'bg-primary text-primary-foreground self-end'
          : 'bg-muted self-start'
      )}
    >
      <span className="text-xs opacity-70">
        {isUser ? 'あなた' : 'Gemini'}
      </span>
      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
    </div>
  )
}

export function GeminiLiveDialog({
  isOpen,
  onClose,
  state,
  error,
  messages,
  currentTranscript,
  currentResponse,
  onStart,
  onStop,
  isSpeechListening,
}: GeminiLiveDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isActive = state !== 'idle' && state !== 'error'

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, currentResponse])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md h-[500px] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Gemini Live</h2>
            <StateIndicator state={state} />
            {isSpeechListening && (
              <div className="flex items-center gap-1 text-xs text-green-500">
                <Mic size={12} className="animate-pulse" />
                <span>音声認識中</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X size={16} />
          </Button>
        </div>

        {/* メッセージエリア */}
        <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
          <div className="flex flex-col gap-3">
            {messages.length === 0 && !currentResponse && !currentTranscript && (
              <div className="text-center text-muted-foreground py-8">
                <Mic size={48} className="mx-auto mb-4 opacity-50" />
                <p>
                  {state === 'idle'
                    ? '「開始」ボタンを押して音声対話を始めましょう'
                    : state === 'connecting'
                    ? '接続中...'
                    : state === 'listening'
                    ? '話しかけてください'
                    : ''}
                </p>
              </div>
            )}

            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}

            {/* リアルタイム入力表示 */}
            {currentTranscript && (
              <div className="flex flex-col gap-1 p-3 rounded-lg max-w-[85%] bg-primary/50 text-primary-foreground self-end">
                <span className="text-xs opacity-70">あなた（認識中...）</span>
                <p className="text-sm whitespace-pre-wrap">{currentTranscript}</p>
              </div>
            )}

            {/* リアルタイム応答表示 */}
            {currentResponse && (
              <div className="flex flex-col gap-1 p-3 rounded-lg max-w-[85%] bg-muted self-start">
                <span className="text-xs opacity-70">Gemini（応答中...）</span>
                <p className="text-sm whitespace-pre-wrap">{currentResponse}</p>
              </div>
            )}
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm border-t">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* フッター */}
        <div className="p-4 border-t flex justify-center gap-4">
          {isActive ? (
            <Button
              variant="destructive"
              size="lg"
              onClick={onStop}
              className="px-8"
            >
              <MicOff size={20} className="mr-2" />
              終了
            </Button>
          ) : (
            <Button
              variant="default"
              size="lg"
              onClick={onStart}
              disabled={state === 'connecting' as GeminiLiveState}
              className="px-8"
            >
              {(state as GeminiLiveState) === 'connecting' ? (
                <Loader2 size={20} className="mr-2 animate-spin" />
              ) : (
                <Mic size={20} className="mr-2" />
              )}
              開始
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
