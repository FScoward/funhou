import { useState } from 'react'
import { Tag as TagIcon, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import * as Collapsible from '@radix-ui/react-collapsible'
import { TagFilter } from './TagFilter'
import { SearchInput } from './SearchInput'
import { Tag } from '@/types'

interface FilterBarProps {
  // タグフィルタ関連
  availableTags: Tag[]
  selectedTags: string[]
  filterMode: 'AND' | 'OR'
  onTagSelect: (tag: string) => void
  onTagRemove: (tag: string) => void
  onFilterModeChange: (mode: 'AND' | 'OR') => void
  onTagsClearAll: () => void
  onTagDelete: (tag: string) => void
  // 検索関連
  onSearch: (searchText: string) => void
  searchText: string
}

type FilterType = 'tag' | 'search' | null

export function FilterBar({
  availableTags,
  selectedTags,
  filterMode,
  onTagSelect,
  onTagRemove,
  onFilterModeChange,
  onTagsClearAll,
  onTagDelete,
  onSearch,
  searchText,
}: FilterBarProps) {
  const [expandedFilter, setExpandedFilter] = useState<FilterType>(null)

  const toggleFilter = (filterType: FilterType) => {
    setExpandedFilter(expandedFilter === filterType ? null : filterType)
  }

  const hasActiveSearch = searchText.trim().length > 0

  return (
    <div className="border-b pb-3 mb-4">
      {/* フィルタアイコンバー */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">フィルタ:</span>

        {/* タグフィルタアイコン */}
        <Button
          variant={expandedFilter === 'tag' ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleFilter('tag')}
          className="relative"
        >
          <TagIcon className="h-4 w-4 mr-1" />
          タグ
          {selectedTags.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">
              {selectedTags.length}
            </Badge>
          )}
        </Button>

        {/* 検索フィルタアイコン */}
        <Button
          variant={expandedFilter === 'search' ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleFilter('search')}
          className="relative"
        >
          <Search className="h-4 w-4 mr-1" />
          検索
          {hasActiveSearch && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">
              ●
            </Badge>
          )}
        </Button>

        {/* アクティブフィルタの概要表示 */}
        {(selectedTags.length > 0 || hasActiveSearch) && (
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>フィルタリング中</span>
          </div>
        )}
      </div>

      {/* タグフィルタ展開エリア */}
      <Collapsible.Root open={expandedFilter === 'tag'}>
        <Collapsible.Content className="mt-3">
          <div className="p-4 border rounded-lg bg-muted/30">
            <TagFilter
              availableTags={availableTags}
              selectedTags={selectedTags}
              filterMode={filterMode}
              onTagSelect={onTagSelect}
              onTagRemove={onTagRemove}
              onFilterModeChange={onFilterModeChange}
              onClearAll={onTagsClearAll}
              onTagDelete={onTagDelete}
            />
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {/* 検索フィルタ展開エリア */}
      <Collapsible.Root open={expandedFilter === 'search'}>
        <Collapsible.Content className="mt-3">
          <div className="p-4 border rounded-lg bg-muted/30">
            <SearchInput onSearch={onSearch} value={searchText} />
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  )
}
