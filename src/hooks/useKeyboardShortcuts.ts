import { useEffect } from 'react'

interface UseKeyboardShortcutsProps {
  selectedDate: Date
  goToPreviousDay: () => void
  goToNextDay: () => void
  goToToday: () => void
  onToggleMic?: () => void
}

export function useKeyboardShortcuts({
  selectedDate,
  goToPreviousDay,
  goToNextDay,
  goToToday,
  onToggleMic,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // textareaまたはinputにフォーカスがある場合はスキップ（各入力要素で処理する）
      if (document.activeElement?.tagName === 'TEXTAREA' ||
          document.activeElement?.tagName === 'INPUT') {
        return
      }

      // Cmd+D (Mac) または Ctrl+D (Windows/Linux) でマイクトグル（フォーカスがない時のみ）
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        onToggleMic?.()
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
  }, [selectedDate, goToPreviousDay, goToNextDay, goToToday, onToggleMic])
}
