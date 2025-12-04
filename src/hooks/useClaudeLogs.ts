import { useState, useCallback } from 'react'
import {
  listClaudeProjects,
  listClaudeSessions,
  readClaudeSession,
  launchClaudeCode,
  ProjectInfo,
  SessionSummary,
  ConversationMessage,
} from '../lib/claudeLogs'

export function useClaudeLogs() {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    try {
      await launchClaudeCode(cwd, prompt)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    projects,
    sessions,
    messages,
    loading,
    error,
    fetchProjects,
    fetchSessions,
    fetchMessages,
    launch,
  }
}
