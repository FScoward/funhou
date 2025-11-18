import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface SearchInputProps {
  onSearch: (searchText: string) => void
  value?: string
  className?: string
}

export function SearchInput({ onSearch, value = '', className = '' }: SearchInputProps) {
  const [searchText, setSearchText] = useState(value)

  // 親の値が変わったら同期
  useEffect(() => {
    setSearchText(value)
  }, [value])

  const handleSearch = () => {
    onSearch(searchText.trim())
  }

  const handleClear = () => {
    setSearchText('')
    onSearch('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="エントリーと返信を検索..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-20 h-11 text-base"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 w-7 p-0 hover:bg-muted"
              title="クリア"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            onClick={handleSearch}
            size="sm"
            className="h-8 px-3"
          >
            検索
          </Button>
        </div>
      </div>
    </div>
  )
}
