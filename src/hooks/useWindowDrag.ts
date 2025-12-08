import { useCallback } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function useWindowDrag() {
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    // 左クリックのみ処理
    if (e.button !== 0) return

    e.preventDefault()

    try {
      // Tauriネイティブのドラッグ開始
      await getCurrentWindow().startDragging()
    } catch (err) {
      console.error('Failed to start window dragging:', err)
    }
  }, [])

  return { handleMouseDown }
}
