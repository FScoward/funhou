import { forwardRef } from 'react'
import CustomInput, { CustomInputRef } from '@/components/CustomInput'
import { ClaudeLogImporter } from '@/components/ClaudeLogImporter'
import { Tag } from '@/types'

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
}, ref) {
  return (
    <div className="input-section">
      <div className="input-section-header">
        {onImportLog && <ClaudeLogImporter onImport={onImportLog} />}
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
      />
    </div>
  )
})
