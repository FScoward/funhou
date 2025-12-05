import { useState, useCallback, useEffect } from 'react'
import {
  listClaudeProjects,
  listClaudeSessions,
  readClaudeSession,
  launchClaudeCode,
  onClaudeSessionFinished,
  ProjectInfo,
  SessionSummary,
  ConversationMessage,
  ClaudeSessionFinishedPayload,
} from '../lib/claudeLogs'

export function useClaudeLogs() {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runningSessionId, setRunningSessionId] = useState<string | null>(null)
  const [lastFinished, setLastFinished] = useState<ClaudeSessionFinishedPayload | null>(null)

  // Listen for session finished events
  useEffect(() => {
    const unlisten = onClaudeSessionFinished((payload) => {
      if (payload.session_id === runningSessionId) {
        setRunningSessionId(null)
        setLastFinished(payload)
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [runningSessionId])

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listClaudeProjects()
      setProjects(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSessions = useCallback(async (projectPath: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await listClaudeSessions(projectPath)
      setSessions(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async (projectPath: string, sessionId: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await readClaudeSession(projectPath, sessionId)
      setMessages(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const launch = useCallback(async (cwd: string, prompt?: string) => {
    setLoading(true)
    setError(null)
    setLastFinished(null)
    try {
      const sessionId = await launchClaudeCode(cwd, prompt)
      setRunningSessionId(sessionId)
      return sessionId
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const clearLastFinished = useCallback(() => {
    setLastFinished(null)
  }, [])

  return {
    projects,
    sessions,
    messages,
    loading,
    error,
    runningSessionId,
    lastFinished,
    fetchProjects,
    fetchSessions,
    fetchMessages,
    launch,
    clearLastFinished,
  }
}
