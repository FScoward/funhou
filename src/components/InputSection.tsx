import { forwardRef, useState } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import CustomInput, { CustomInputRef } from '@/components/CustomInput'
import { ClaudeLogImporter } from '@/components/ClaudeLogImporter'
import { usePasteToApp } from '@/hooks/usePasteToApp'
import { Tag } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface InputSectionProps {
  currentEntry: string
  onEntryChange: (value: string) => void
  onSubmit: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  availableTags: Tag[]
  selectedTags: string[]
  onTagAdd: (tag: string) => void
  onTagRemove: (tag: string) => void
  frequentTags?: Tag[]
  recentTags?: Tag[]
  ollamaEnabled?: boolean
  ollamaModel?: string
  onImportLog?: (content: string) => void
  /** 外部アプリへの送信成功時のコールバック（送信先アプリ名、送信テキスト） */
  onPasteToAppSuccess?: (targetApp: string, text: string) => void
}

export const InputSection = forwardRef<CustomInputRef, InputSectionProps>(function InputSection({
  currentEntry,
  onEntryChange,
  onSubmit,
  onKeyDown,
  availableTags,
  selectedTags,
  onTagAdd,
  onTagRemove,
  frequentTags,
  recentTags,
  ollamaEnabled,
  ollamaModel,
  onImportLog,
  onPasteToAppSuccess,
}, ref) {
  const {
    paste,
    isPasting,
    targetApp,
    selectTargetApp,
    runningApps,
    refreshApps,
    isLoadingApps,
  } = usePasteToApp()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handlePasteToApp = async (text: string) => {
    const success = await paste(text)
    if (success && targetApp && onPasteToAppSuccess) {
      onPasteToAppSuccess(targetApp, text)
    }
  }

  const handleDropdownOpen = async (open: boolean) => {
    setDropdownOpen(open)
    if (open) {
      await refreshApps()
    }
  }

  return (
    <div className="input-section">
      <div className="input-section-header flex items-center gap-2">
        {onImportLog && <ClaudeLogImporter onImport={onImportLog} />}

        {/* 送信先アプリ選択 */}
        <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <span className="truncate max-w-[120px]">
                {targetApp || '送信先を選択'}
              </span>
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {isLoadingApps ? (
              <div className="flex items-center justify-center py-2">
                <RefreshCw className="size-4 animate-spin" />
              </div>
            ) : runningApps.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 px-2">
                アプリが見つかりません
              </div>
            ) : (
              runningApps.map((app) => (
                <DropdownMenuItem
                  key={app.name}
                  onClick={() => selectTargetApp(app)}
                  className={targetApp === app.name ? 'bg-accent' : ''}
                >
                  {app.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CustomInput
        ref={ref}
        value={currentEntry}
        onChange={onEntryChange}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        availableTags={availableTags}
        selectedTags={selectedTags}
        onTagAdd={onTagAdd}
        onTagRemove={onTagRemove}
        frequentTags={frequentTags}
        recentTags={recentTags}
        ollamaEnabled={ollamaEnabled}
        ollamaModel={ollamaModel}
        enablePasteToApp={true}
        onPasteToApp={handlePasteToApp}
        isPastingToApp={isPasting}
      />
    </div>
  )
})
