import { useState, useEffect, useCallback } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderOpen, Clock, Star, ChevronDown } from 'lucide-react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { getCwdHistory, type CwdHistoryItem } from '../lib/cwdHistory'
import Database from '@tauri-apps/plugin-sql'

interface CwdSelectorProps {
  value: string
  onChange: (value: string) => void
  defaultCwd?: string
  disabled?: boolean
  placeholder?: string
}

export function CwdSelector({
  value,
  onChange,
  defaultCwd,
  disabled = false,
  placeholder = '/path/to/project',
}: CwdSelectorProps) {
  const [history, setHistory] = useState<CwdHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 履歴とデフォルト設定を読み込み
  useEffect(() => {
    async function loadHistory() {
      try {
        const db = await Database.load('sqlite:funhou.db')
        const historyItems = await getCwdHistory(db)
        setHistory(historyItems)

        // 値が空でデフォルト設定があれば自動適用
        if (!value && defaultCwd) {
          onChange(defaultCwd)
        }
      } catch (error) {
        console.error('cwd履歴の読み込みに失敗しました:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadHistory()
  }, []) // 初回マウント時のみ

  // フォルダ選択ダイアログを開く
  const handleOpenFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '作業ディレクトリを選択',
      })

      if (selected && typeof selected === 'string') {
        onChange(selected)
      }
    } catch (error) {
      console.error('フォルダ選択に失敗しました:', error)
    }
  }, [onChange])

  // 履歴アイテムの表示名を短縮
  const shortenPath = (path: string): string => {
    const parts = path.split('/')
    if (parts.length > 3) {
      return '~/' + parts.slice(-2).join('/')
    }
    return path
  }

  return (
    <div className="cwd-selector">
      <div className="cwd-selector-input-row">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleOpenFolder}
          disabled={disabled}
          title="フォルダを参照"
        >
          <FolderOpen size={16} />
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isLoading}
            className="cwd-selector-dropdown-trigger"
          >
            <Clock size={14} className="mr-1" />
            履歴から選択
            <ChevronDown size={14} className="ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="cwd-selector-dropdown">
          {defaultCwd && (
            <>
              <DropdownMenuItem onClick={() => onChange(defaultCwd)}>
                <Star size={14} className="mr-2 text-yellow-500" />
                <span className="font-medium">デフォルト:</span>
                <span className="ml-1 text-muted-foreground truncate">
                  {shortenPath(defaultCwd)}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {history.length > 0 ? (
            history.map((item) => (
              <DropdownMenuItem
                key={item.cwd}
                onClick={() => onChange(item.cwd)}
              >
                <span className="text-xs text-muted-foreground mr-2">
                  ({item.usageCount}回)
                </span>
                <span className="truncate">{shortenPath(item.cwd)}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              履歴がありません
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleOpenFolder}>
            <FolderOpen size={14} className="mr-2" />
            フォルダを参照...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
