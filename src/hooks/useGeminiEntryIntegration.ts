/**
 * Gemini Live とエントリーの統合フック
 * - エントリーコンテキストの構築
 * - 動的システムプロンプト生成
 * - 対話結果の保存処理
 */

import { useState, useMemo, useCallback } from 'react'
import type { TimelineItem } from '@/types'
import {
  selectEntriesForContext,
  buildSystemPromptWithEntries,
  type EntryContext,
} from '@/lib/geminiEntryContext'

interface UseGeminiEntryIntegrationOptions {
  /** タイムラインアイテム */
  timelineItems: TimelineItem[]
  /** ベースのシステムプロンプト（設定から） */
  baseSystemPrompt?: string
  /** エントリー追加関数 */
  addEntryWithContent: (content: string, tags: string[]) => Promise<void>
}

interface UseGeminiEntryIntegrationReturn {
  /** コンテキストに含まれるエントリー一覧 */
  entryContext: EntryContext[]
  /** エントリー参照付きシステムプロンプト */
  systemPromptWithContext: string
  /** 保存ダイアログを開く */
  openSaveDialog: (proposedContent: string) => void
  /** 保存ダイアログを閉じる */
  closeSaveDialog: () => void
  /** 保存処理を実行 */
  saveEntry: (content: string, tags: string[]) => Promise<void>
  /** 保存ダイアログの状態 */
  isSaveDialogOpen: boolean
  /** 保存予定のコンテンツ */
  pendingSaveContent: string
  /** 保存予定のタグ（初期値） */
  pendingTags: string[]
}

export function useGeminiEntryIntegration({
  timelineItems,
  baseSystemPrompt,
  addEntryWithContent,
}: UseGeminiEntryIntegrationOptions): UseGeminiEntryIntegrationReturn {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [pendingSaveContent, setPendingSaveContent] = useState('')
  const [pendingTags, setPendingTags] = useState<string[]>([])

  // エントリーコンテキストを構築（直近24時間以内、最大10件）
  const entryContext = useMemo(() => {
    return selectEntriesForContext(timelineItems, {
      maxCount: 10,
      hoursBack: 24,
    })
  }, [timelineItems])

  // エントリー参照付きシステムプロンプトを生成
  const systemPromptWithContext = useMemo(() => {
    return buildSystemPromptWithEntries(baseSystemPrompt, entryContext)
  }, [baseSystemPrompt, entryContext])

  // 保存ダイアログを開く
  const openSaveDialog = useCallback(
    (proposedContent: string) => {
      setPendingSaveContent(proposedContent)
      // デフォルトで「Gemini」タグを追加
      const defaultTags = ['Gemini']
      setPendingTags(defaultTags)
      setIsSaveDialogOpen(true)
    },
    []
  )

  // 保存ダイアログを閉じる
  const closeSaveDialog = useCallback(() => {
    setIsSaveDialogOpen(false)
    setPendingSaveContent('')
    setPendingTags([])
  }, [])

  // エントリーを保存
  const saveEntry = useCallback(
    async (content: string, tags: string[]) => {
      await addEntryWithContent(content, tags)
      closeSaveDialog()
    },
    [addEntryWithContent, closeSaveDialog]
  )

  return {
    entryContext,
    systemPromptWithContext,
    openSaveDialog,
    closeSaveDialog,
    saveEntry,
    isSaveDialogOpen,
    pendingSaveContent,
    pendingTags,
  }
}
