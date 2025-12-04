import { useState } from 'react'
import { useClaudeLogs } from '../hooks/useClaudeLogs'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface ClaudeLaunchDialogProps {
  initialPrompt?: string
  trigger?: React.ReactNode
}

export function ClaudeLaunchDialog({ initialPrompt, trigger }: ClaudeLaunchDialogProps) {
  const { launch, loading, error } = useClaudeLogs()
  const [open, setOpen] = useState(false)
  const [cwd, setCwd] = useState('')
  const [prompt, setPrompt] = useState(initialPrompt || '')
  const [launched, setLaunched] = useState(false)

  const handleLaunch = async () => {
    if (!cwd.trim()) return

    await launch(cwd.trim(), prompt.trim() || undefined)
    setLaunched(true)
    setTimeout(() => {
      setOpen(false)
      setLaunched(false)
      setCwd('')
      setPrompt(initialPrompt || '')
    }, 1500)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen) {
      setPrompt(initialPrompt || '')
      setLaunched(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Claude Codeで実行
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Claude Codeを起動</DialogTitle>
        </DialogHeader>

        {launched ? (
          <div className="py-8 text-center text-green-600">
            Claude Codeを起動しました
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cwd">作業ディレクトリ</Label>
              <Input
                id="cwd"
                placeholder="/path/to/project"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">プロンプト（任意）</Label>
              <Input
                id="prompt"
                placeholder="タスクの指示を入力..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}
          </div>
        )}

        {!launched && (
          <DialogFooter>
            <Button
              onClick={handleLaunch}
              disabled={loading || !cwd.trim()}
            >
              {loading ? '起動中...' : '実行'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
