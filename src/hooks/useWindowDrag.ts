import { useEffect, useRef, useCallback } from 'react'
import { getCurrentWindow, PhysicalPosition } from '@tauri-apps/api/window'

// ドラッグ状態をモジュールレベルで管理
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let windowStartX = 0
let windowStartY = 0

export function useWindowDrag() {
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

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
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
  }, [])

  return { dragRegionRef, handleMouseDown }
}
