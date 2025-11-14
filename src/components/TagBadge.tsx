import * as React from 'react'
import { cn } from '@/lib/utils'
import { Tag as TagIcon } from 'lucide-react'

interface TagBadgeProps {
  tag: string
  onClick?: (tag: string) => void
  onRemove?: (tag: string) => void
  variant?: 'default' | 'selected'
}

export function TagBadge({ tag, onClick, onRemove, variant = 'default' }: TagBadgeProps) {
  const isClickable = onClick !== undefined
  const isRemovable = onRemove !== undefined

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
        variant === 'selected'
          ? 'bg-gray-100 text-gray-700 border border-gray-300'
          : 'bg-gray-50 text-gray-600 border border-gray-200',
        isClickable && 'cursor-pointer',
        isClickable && 'hover:bg-gray-200'
      )}
      onClick={
        isClickable && !isRemovable
          ? (e) => {
              e.stopPropagation()
              onClick(tag)
            }
          : undefined
      }
    >
      <span
        className={cn('flex items-center gap-1', isRemovable && isClickable && 'cursor-pointer')}
        onClick={
          isClickable && isRemovable
            ? (e) => {
                e.stopPropagation()
                onClick(tag)
              }
            : undefined
        }
      >
        <TagIcon className="size-3 text-yellow-500" />
        {tag}
      </span>
      {isRemovable && (
        <button
          type="button"
          className="ml-0.5 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(tag)
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </span>
  )
}
