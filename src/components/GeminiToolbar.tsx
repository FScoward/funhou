/**
 * Gemini Live 専用ツールバー
 * - 対話開始/停止ボタン
 * - 状態インジケーター
 * - Web Audio APIでマイク入力を直接送信
 */

import { useState, useMemo } from 'react'
import { Mic, Loader2, Volume2, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGeminiLive } from '@/hooks/useGeminiLive'
import { GeminiLiveDialog } from '@/components/GeminiLiveDialog'
import type { GeminiLiveConfig, GeminiLiveState } from '@/types/geminiLive'
import { cn } from '@/lib/utils'

interface GeminiToolbarProps {
  apiKey?: string
  model?: string
  voice?: string
  systemPrompt?: string
}

// 状態に応じたアイコンを取得
function getStateIcon(state: GeminiLiveState) {
  switch (state) {
    case 'connecting':
      return <Loader2 size={18} className="animate-spin" />
    case 'listening':
      return <Mic size={18} className="animate-pulse" />
    case 'speaking':
      return <Volume2 size={18} className="animate-pulse" />
    case 'processing':
      return <Loader2 size={18} className="animate-spin" />
    case 'error':
      return <AlertCircle size={18} />
    case 'ready':
      return <Mic size={18} />
    default:
      return <Sparkles size={18} />
  }
}

// 状態に応じた色を取得
function getStateColor(state: GeminiLiveState): string {
  switch (state) {
    case 'connecting':
      return 'text-blue-500'
    case 'listening':
    case 'ready':
      return 'text-green-500'
    case 'speaking':
      return 'text-purple-500'
    case 'processing':
      return 'text-yellow-500'
    case 'error':
      return 'text-destructive'
    default:
      return ''
  }
}

// 状態の説明を取得
function getStateDescription(state: GeminiLiveState): string {
  switch (state) {
    case 'idle':
      return 'Gemini Live（クリックで開始）'
    case 'connecting':
      return '接続中...'
    case 'ready':
      return '準備完了'
    case 'listening':
      return 'リスニング中'
    case 'speaking':
      return 'Geminiが応答中'
    case 'processing':
      return '処理中...'
    case 'error':
      return 'エラーが発生しました'
    default:
      return 'Gemini Live'
  }
}

export function GeminiToolbar({
  apiKey,
  model,
  voice,
  systemPrompt,
}: GeminiToolbarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Gemini Live 設定
  const config: GeminiLiveConfig = useMemo(
    () => ({
      apiKey: apiKey || '',
      model: model || 'models/gemini-2.5-flash-native-audio-preview-09-2025',
      voiceConfig: voice ? { voiceName: voice } : undefined,
      systemInstruction: systemPrompt,
    }),
    [apiKey, model, voice, systemPrompt]
  )

  // Gemini Live フック
  const {
    state,
    error,
    messages,
    currentTranscript,
    currentResponse,
    startSession,
    endSession,
    isConnected,
    isListening,
  } = useGeminiLive({
    config,
    onError: (err) => {
      console.error('Gemini Live error:', err)
    },
  })

  // ダイアログを開く
  const handleOpenDialog = () => {
    setIsDialogOpen(true)
  }

  // ダイアログを閉じる
  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    // 接続中なら終了
    if (isConnected) {
      endSession()
    }
  }

  // 開始
  const handleStart = async () => {
    await startSession()
  }

  // 停止
  const handleStop = () => {
    endSession()
  }

  // APIキーが設定されていない場合
  const isDisabled = !apiKey

  return (
    <>
      <Button
        variant={isConnected ? 'default' : 'outline'}
        size="sm"
        onClick={isConnected ? handleStop : handleOpenDialog}
        disabled={isDisabled}
        title={
          isDisabled
            ? '設定画面でGemini APIキーを入力してください'
            : getStateDescription(state)
        }
        className={cn(
          'gap-2 transition-all',
          isConnected && 'bg-green-600 hover:bg-green-700',
          getStateColor(state)
        )}
      >
        {getStateIcon(state)}
        <span className="hidden sm:inline">
          {isConnected ? '対話中' : 'Gemini'}
        </span>
      </Button>

      {/* 対話ダイアログ */}
      <GeminiLiveDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        state={state}
        error={error}
        messages={messages}
        currentTranscript={currentTranscript}
        currentResponse={currentResponse}
        onStart={handleStart}
        onStop={handleStop}
        isSpeechListening={isListening}
      />
    </>
  )
}
