import { useState, useCallback } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { TaskClaudeSession, TaskIdentifier, getTaskIdentifierKey } from '@/types'
import {
  getTaskClaudeSessionsBatch,
  linkTaskClaudeSession,
  unlinkTaskClaudeSession,
  updateTaskClaudeSessionName,
  updateTaskClaudeSessionId,
  updateTaskClaudePtySessionId,
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

  // セッションを紐付け（作成したセッションを返す）
  const linkSession = useCallback(async (
    task: TaskIdentifier,
    sessionId: string,
    cwd: string,
    projectPath: string
  ): Promise<TaskClaudeSession | null> => {
    if (!database) return null

    try {
      await linkTaskClaudeSession(database, task, sessionId, cwd, projectPath)

      // 新しいセッションオブジェクトを作成
      const newSession: TaskClaudeSession = {
        id: 0, // DBから再取得時に正しいIDが設定される
        entryId: task.entryId,
        replyId: task.replyId,
        lineIndex: task.lineIndex,
        sessionId,
        cwd,
        projectPath,
        createdAt: new Date().toISOString(),
      }

      // ローカル状態を更新
      setSessionsMap(prev => {
        const newMap = new Map(prev)
        const key = getTaskIdentifierKey(task)
        const sessions = newMap.get(key) ?? []

        // 既に紐付けられていない場合のみ追加
        if (!sessions.some(s => s.sessionId === sessionId)) {
          newMap.set(key, [newSession, ...sessions])
        }

        return newMap
      })

      return newSession
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

  // セッション名を更新
  const updateSessionName = useCallback(async (
    task: TaskIdentifier,
    sessionId: string,
    name: string | null
  ) => {
    if (!database) return

    try {
      await updateTaskClaudeSessionName(database, task, sessionId, name)

      // ローカル状態を更新
      setSessionsMap(prev => {
        const newMap = new Map(prev)
        const key = getTaskIdentifierKey(task)
        const sessions = newMap.get(key) ?? []
        newMap.set(key, sessions.map(s =>
          s.sessionId === sessionId ? { ...s, name: name ?? undefined } : s
        ))
        return newMap
      })
    } catch (error) {
      console.error('セッション名の更新に失敗しました:', error)
      throw error
    }
  }, [database])

  // セッションIDを更新（Claude Codeログとの紐付け用）
  const updateSessionId = useCallback(async (
    task: TaskIdentifier,
    oldSessionId: string,
    newSessionId: string
  ) => {
    if (!database) return

    try {
      await updateTaskClaudeSessionId(database, task, oldSessionId, newSessionId)

      // ローカル状態を更新
      setSessionsMap(prev => {
        const newMap = new Map(prev)
        const key = getTaskIdentifierKey(task)
        const sessions = newMap.get(key) ?? []
        newMap.set(key, sessions.map(s =>
          s.sessionId === oldSessionId ? { ...s, sessionId: newSessionId } : s
        ))
        return newMap
      })
    } catch (error) {
      console.error('セッションIDの更新に失敗しました:', error)
      throw error
    }
  }, [database])

  // PTYセッションIDを更新（アプリ内ターミナルとの紐付け用）
  const updatePtySessionId = useCallback(async (
    task: TaskIdentifier,
    claudeSessionId: string,
    ptySessionId: string | null
  ) => {
    if (!database) return

    try {
      await updateTaskClaudePtySessionId(database, task, claudeSessionId, ptySessionId)

      // ローカル状態を更新
      setSessionsMap(prev => {
        const newMap = new Map(prev)
        const key = getTaskIdentifierKey(task)
        const sessions = newMap.get(key) ?? []
        newMap.set(key, sessions.map(s =>
          s.sessionId === claudeSessionId ? { ...s, ptySessionId: ptySessionId ?? undefined } : s
        ))
        return newMap
      })
    } catch (error) {
      console.error('PTYセッションIDの更新に失敗しました:', error)
      throw error
    }
  }, [database])

  return {
    sessionsMap,
    isLoading,
    loadSessionsForTasks,
    linkSession,
    unlinkSession,
    getSessionsForTask,
    updateSessionName,
    updateSessionId,
    updatePtySessionId,
  }
}
