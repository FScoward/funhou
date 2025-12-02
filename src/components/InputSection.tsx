import CustomInput from '@/components/CustomInput'
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
}

export function InputSection({
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
}: InputSectionProps) {
  return (
    <div className="input-section">
      <CustomInput
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
}
