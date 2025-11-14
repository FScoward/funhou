import { useEffect } from 'react'

interface UseKeyboardShortcutsProps {
  selectedDate: Date
  goToPreviousDay: () => void
  goToNextDay: () => void
  goToToday: () => void
}

export function useKeyboardShortcuts({
  selectedDate,
  goToPreviousDay,
  goToNextDay,
  goToToday,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // textareaにフォーカスがある場合はスキップ
      if (document.activeElement?.tagName === 'TEXTAREA') {
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPreviousDay()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNextDay()
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        goToToday()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [selectedDate, goToPreviousDay, goToNextDay, goToToday])
}
