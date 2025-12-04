import { useEffect, useState, useMemo } from 'react'
import { useClaudeLogs } from '../hooks/useClaudeLogs'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import { ProjectInfo, SessionSummary } from '../lib/claudeLogs'

interface ClaudeLogImporterProps {
  onImport: (content: string) => void
  trigger?: React.ReactNode
  linkedSessionId?: string | null
  linkedProjectPath?: string | null
}

export function ClaudeLogImporter({ onImport, trigger, linkedSessionId, linkedProjectPath }: ClaudeLogImporterProps) {
  const {
    projects,
    sessions,
    messages,
    loading,
    error,
    fetchProjects,
    fetchSessions,
    fetchMessages,
  } = useClaudeLogs()

  const [open, setOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null)
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null)
  const [view, setView] = useState<'projects' | 'sessions' | 'messages'>('projects')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMessageIndices, setSelectedMessageIndices] = useState<Set<number>>(new Set())

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects
    const query = searchQuery.toLowerCase()
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query)
    )
  }, [projects, searchQuery])

  // 紐付け済みセッションかどうか
  const hasLinkedSession = linkedSessionId && linkedProjectPath

  useEffect(() => {
    if (open) {
      setSelectedMessageIndices(new Set())
      if (hasLinkedSession) {
        // 紐付け済みの場合は直接メッセージを取得
        fetchMessages(linkedProjectPath, linkedSessionId)
        setView('messages')
        setSelectedProject(null)
        setSelectedSession(null)
      } else {
        // 通常フロー
        fetchProjects()
        setView('projects')
        setSelectedProject(null)
        setSelectedSession(null)
        setSearchQuery('')
      }
    }
  }, [open, fetchProjects, fetchMessages, hasLinkedSession, linkedProjectPath, linkedSessionId])

  // メッセージビューでポーリング
  useEffect(() => {
    if (!open || view !== 'messages') return

    const projectPath = hasLinkedSession ? linkedProjectPath : selectedSession?.project_path
    const sessionId = hasLinkedSession ? linkedSessionId : selectedSession?.session_id

    if (!projectPath || !sessionId) return

    const intervalId = setInterval(() => {
      fetchMessages(projectPath, sessionId)
    }, 3000) // 3秒間隔

    return () => clearInterval(intervalId)
  }, [open, view, hasLinkedSession, linkedProjectPath, linkedSessionId, selectedSession, fetchMessages])

  const handleProjectSelect = (project: ProjectInfo) => {
    setSelectedProject(project)
    fetchSessions(project.path)
    setView('sessions')
  }

  const handleSessionSelect = (session: SessionSummary) => {
    setSelectedSession(session)
    fetchMessages(session.project_path, session.session_id)
    setSelectedMessageIndices(new Set())
    setView('messages')
  }

  const handleBack = () => {
    if (view === 'messages') {
      if (hasLinkedSession) {
        // 紐付け済みの場合はダイアログを閉じる
        setOpen(false)
      } else {
        setView('sessions')
        setSelectedSession(null)
      }
    } else if (view === 'sessions') {
      setView('projects')
      setSelectedProject(null)
    }
  }

  const handleImport = () => {
    if (selectedMessageIndices.size === 0) return

    const selectedMessages = messages.filter((_, index) => selectedMessageIndices.has(index))
    const content = selectedMessages
      .map((msg) => `**${msg.role}**: ${msg.content}`)
      .join('\n\n---\n\n')

    onImport(content)
    setOpen(false)
  }

  const toggleMessageSelection = (index: number) => {
    setSelectedMessageIndices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const selectAllMessages = () => {
    setSelectedMessageIndices(new Set(messages.map((_, index) => index)))
  }

  const deselectAllMessages = () => {
    setSelectedMessageIndices(new Set())
  }

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleString('ja-JP')
  }

  const truncateText = (text: string | null, maxLength: number) => {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Claude Codeログ取込
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(view !== 'projects' || hasLinkedSession) && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                ←
              </Button>
            )}
            {view === 'projects' && 'プロジェクト選択'}
            {view === 'sessions' && selectedProject?.name}
            {view === 'messages' && (hasLinkedSession
              ? `紐付けセッション: ${linkedSessionId}`
              : `セッション: ${selectedSession?.session_id}`)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-4 text-center text-gray-500">読み込み中...</div>}
          {error && <div className="p-4 text-center text-red-500">{error}</div>}

          {!loading && !error && view === 'projects' && (
            <div className="space-y-2">
              <Input
                placeholder="プロジェクトを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-2"
              />
              {filteredProjects.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {projects.length === 0
                    ? 'プロジェクトが見つかりません'
                    : '検索結果がありません'}
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <div
                    key={project.path}
                    className="p-3 border rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleProjectSelect(project)}
                  >
                    <div className="font-medium">{project.name}</div>
                    <div className="text-sm text-gray-500">
                      {project.session_count} セッション
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!loading && !error && view === 'sessions' && (
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  セッションが見つかりません
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.session_id}
                    className="p-3 border rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSessionSelect(session)}
                  >
                    <div className="font-medium">
                      {truncateText(session.first_message, 50) || 'No message'}
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-1">
                      {session.session_id}
                    </div>
                    <div className="text-sm text-gray-500 flex gap-4 mt-1">
                      <span>{formatTimestamp(session.timestamp)}</span>
                      {session.git_branch && <span>Branch: {session.git_branch}</span>}
                      <span>{session.message_count} メッセージ</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!loading && !error && view === 'messages' && (
            <div className="space-y-3">
              <div className="flex gap-2 mb-2">
                <Button variant="outline" size="sm" onClick={selectAllMessages}>
                  全て選択
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllMessages}>
                  全て解除
                </Button>
                <span className="text-sm text-gray-500 ml-auto">
                  {selectedMessageIndices.size} / {messages.length} 選択中
                </span>
              </div>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`p-3 rounded cursor-pointer border-2 transition-colors ${
                    selectedMessageIndices.has(index)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : msg.role === 'user'
                        ? 'border-transparent bg-blue-50/50 dark:bg-blue-900/10'
                        : 'border-transparent bg-gray-50 dark:bg-gray-800'
                  }`}
                  onClick={() => toggleMessageSelection(index)}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedMessageIndices.has(index)}
                      onChange={() => toggleMessageSelection(index)}
                      className="mt-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">
                        {msg.role === 'user' ? 'User' : 'Assistant'} -{' '}
                        {formatTimestamp(msg.timestamp)}
                      </div>
                      <div className="whitespace-pre-wrap text-sm">
                        {truncateText(msg.content, 500)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {view === 'messages' && messages.length > 0 && (
          <div className="pt-4 border-t">
            <Button
              onClick={handleImport}
              className="w-full"
              disabled={selectedMessageIndices.size === 0}
            >
              {selectedMessageIndices.size > 0
                ? `選択した${selectedMessageIndices.size}件を取り込む`
                : 'メッセージを選択してください'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
