import { useEffect, useState, useMemo } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import { listClaudeProjects, listClaudeSessions, ProjectInfo, SessionSummary } from '../lib/claudeLogs'

interface ClaudeSessionLinkDialogProps {
  entryId: number
  onLink: (entryId: number, sessionId: string, cwd: string, projectPath: string) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ClaudeSessionLinkDialog({
  entryId,
  onLink,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ClaudeSessionLinkDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)

  // 制御モードかどうかを判定
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled
    ? (v: boolean) => controlledOnOpenChange?.(v)
    : setInternalOpen
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'projects' | 'sessions'>('projects')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects
    const query = searchQuery.toLowerCase()
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query)
    )
  }, [projects, searchQuery])

  useEffect(() => {
    if (open) {
      loadProjects()
      setView('projects')
      setSelectedProject(null)
      setSearchQuery('')
    }
  }, [open])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const result = await listClaudeProjects()
      setProjects(result)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProjectSelect = async (project: ProjectInfo) => {
    setSelectedProject(project)
    setLoading(true)
    try {
      const result = await listClaudeSessions(project.path)
      setSessions(result)
      setView('sessions')
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSessionSelect = (session: SessionSummary) => {
    if (session.cwd && selectedProject) {
      onLink(entryId, session.session_id, session.cwd, selectedProject.path)
      setOpen(false)
    }
  }

  const handleBack = () => {
    setView('projects')
    setSelectedProject(null)
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
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {view !== 'projects' && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                ←
              </Button>
            )}
            {view === 'projects' && 'プロジェクト選択'}
            {view === 'sessions' && selectedProject?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-4 text-center text-gray-500">読み込み中...</div>}

          {!loading && view === 'projects' && (
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

          {!loading && view === 'sessions' && (
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  セッションが見つかりません
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.session_id}
                    className={`p-3 border rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      !session.cwd ? 'opacity-50' : ''
                    }`}
                    onClick={() => session.cwd && handleSessionSelect(session)}
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
                    {!session.cwd && (
                      <div className="text-xs text-red-500 mt-1">
                        cwdが見つかりません
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
