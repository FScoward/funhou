import { useEffect, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { ja } from 'date-fns/locale'
import { formatDateWithWeekday } from '@/utils/dateUtils'
import { getCurrentWindow, PhysicalPosition } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'

interface DateNavigationProps {
  selectedDate: Date
  calendarOpen: boolean
  onCalendarOpenChange: (open: boolean) => void
  onDateSelect: (date: Date) => void
  onPreviousDay: () => void
  onNextDay: () => void
  onToday: () => void
}

// ドラッグ状態をモジュールレベルで管理
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let windowStartX = 0
let windowStartY = 0

export function DateNavigation({
  selectedDate,
  calendarOpen,
  onCalendarOpenChange,
  onDateSelect,
  onPreviousDay,
  onNextDay,
  onToday,
}: DateNavigationProps) {
  const dragRegionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = async (e: MouseEvent) => {
      if (!isDragging) return
      const deltaX = e.screenX - dragStartX
      const deltaY = e.screenY - dragStartY
      const newX = windowStartX + deltaX
      const newY = windowStartY + deltaY
      try {
        await getCurrentWindow().setPosition(new PhysicalPosition(newX, newY))
      } catch (err) {
        console.error('Failed to set window position:', err)
      }
    }

    const handleMouseUp = () => {
      isDragging = false
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleMouseDown = async (e: React.MouseEvent) => {
    // ボタンやインタラクティブ要素上ではドラッグしない
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    e.preventDefault()
    isDragging = true
    dragStartX = e.screenX
    dragStartY = e.screenY
    try {
      const position = await getCurrentWindow().outerPosition()
      windowStartX = position.x
      windowStartY = position.y
    } catch (err) {
      console.error('Failed to get window position:', err)
      isDragging = false
    }
  }

  return (
    <div
      className="date-navigation"
      ref={dragRegionRef}
      onMouseDown={handleMouseDown}
    >
      <div className="date-navigation-center">
        <button onClick={onPreviousDay} className="nav-button">
          ◀
        </button>
        <Popover open={calendarOpen} onOpenChange={onCalendarOpenChange}>
          <PopoverTrigger asChild>
            <button className="date-display" style={{ cursor: 'pointer', background: 'none', border: 'none' }}>
              {formatDateWithWeekday(selectedDate)}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  onDateSelect(date)
                  onCalendarOpenChange(false)
                }
              }}
              locale={ja}
              captionLayout="dropdown"
              fromYear={2000}
              toYear={2050}
              initialFocus
            />
            <div className="p-3 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onToday()
                  onCalendarOpenChange(false)
                }}
              >
                今日
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <button onClick={onNextDay} className="nav-button">
          ▶
        </button>
      </div>
    </div>
  )
}
