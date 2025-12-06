import { useState, useCallback } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { TaskClaudeSession, TaskIdentifier, getTaskIdentifierKey } from '@/types'
import {
  getTaskClaudeSessionsBatch,
  linkTaskClaudeSession,
  unlinkTaskClaudeSession,
} from '@/lib/taskClaudeSessions'

interface UseTaskClaudeSessionsProps {
  database: Database | null
}

export function useTaskClaudeSessions({ database }: UseTaskClaudeSessionsProps) {
  const [sessionsMap, setSessionsMap] = useState<Map<string, TaskClaudeSession[]>>(new Map())
  const [isLoading, setIsLoading] = useState(false)

  // タスク一覧のセッション情報を読み込み
  const loadSessionsForTasks = useCallback(async (tasks: TaskIdentifier[]) => {
    if (!database || tasks.length === 0) {
      setSessionsMap(new Map())
      return
    }

    setIsLoading(true)
    try {
      const result = await getTaskClaudeSessionsBatch(database, tasks)
      setSessionsMap(result)
    } catch (error) {
      console.error('タスクセッション情報の読み込みに失敗しました:', error)
    } finally {
      setIsLoading(false)
    }
  }, [database])

  // セッションを紐付け
  const linkSession = useCallback(async (
    task: TaskIdentifier,
    sessionId: string,
    cwd: string,
    projectPath: string
  ) => {
    if (!database) return

    try {
      await linkTaskClaudeSession(database, task, sessionId, cwd, projectPath)

      // ローカル状態を更新
      setSessionsMap(prev => {
        const newMap = new Map(prev)
        const key = getTaskIdentifierKey(task)
        const sessions = newMap.get(key) ?? []

        // 既に紐付けられていない場合のみ追加
        if (!sessions.some(s => s.sessionId === sessionId)) {
          newMap.set(key, [
            {
              id: 0, // DBから再取得時に正しいIDが設定される
              entryId: task.entryId,
              replyId: task.replyId,
              lineIndex: task.lineIndex,
              sessionId,
              cwd,
              projectPath,
              createdAt: new Date().toISOString(),
            },
            ...sessions,
          ])
        }

        return newMap
      })
    } catch (error) {
      console.error('セッションの紐付けに失敗しました:', error)
      throw error
    }
  }, [database])

  // セッション紐付け解除
  const unlinkSession = useCallback(async (
    task: TaskIdentifier,
    sessionId: string
  ) => {
    if (!database) return

    try {
      await unlinkTaskClaudeSession(database, task, sessionId)

      // ローカル状態を更新
      setSessionsMap(prev => {
        const newMap = new Map(prev)
        const key = getTaskIdentifierKey(task)
        const sessions = newMap.get(key) ?? []
        newMap.set(key, sessions.filter(s => s.sessionId !== sessionId))
        return newMap
      })
    } catch (error) {
      console.error('セッションの紐付け解除に失敗しました:', error)
      throw error
    }
  }, [database])

  // 特定タスクのセッション一覧を取得
  const getSessionsForTask = useCallback((task: TaskIdentifier): TaskClaudeSession[] => {
    return sessionsMap.get(getTaskIdentifierKey(task)) ?? []
  }, [sessionsMap])

  return {
    sessionsMap,
    isLoading,
    loadSessionsForTasks,
    linkSession,
    unlinkSession,
    getSessionsForTask,
  }
}
