import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { ja } from 'date-fns/locale'
import { formatDateWithWeekday } from '@/utils/dateUtils'

interface DateNavigationProps {
  selectedDate: Date
  calendarOpen: boolean
  onCalendarOpenChange: (open: boolean) => void
  onDateSelect: (date: Date) => void
  onPreviousDay: () => void
  onNextDay: () => void
  onToday: () => void
}

export function DateNavigation({
  selectedDate,
  calendarOpen,
  onCalendarOpenChange,
  onDateSelect,
  onPreviousDay,
  onNextDay,
  onToday,
}: DateNavigationProps) {
  return (
    <div className="date-navigation">
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
