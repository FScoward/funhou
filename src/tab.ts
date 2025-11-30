import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

// シマー設定を適用
function applyShimmerSetting() {
  const shimmerEnabled = localStorage.getItem('tab_shimmer_enabled') !== 'false'
  const tabHandle = document.querySelector('.tab-handle')
  if (tabHandle) {
    if (shimmerEnabled) {
      tabHandle.classList.remove('no-shimmer')
    } else {
      tabHandle.classList.add('no-shimmer')
    }
  }
}

// 初期化時に設定を適用
applyShimmerSetting()

// localStorageの変更を監視
window.addEventListener('storage', (e) => {
  if (e.key === 'tab_shimmer_enabled') {
    applyShimmerSetting()
  }
})

// ドラッグ機能
let isDragging = false
let dragStartY = 0
let windowStartY = 0

const tabHandle = document.querySelector('.tab-handle') as HTMLElement

if (tabHandle) {
  tabHandle.addEventListener('mousedown', async (e) => {
    isDragging = true
    dragStartY = e.screenY
    const currentWindow = getCurrentWindow()
    const position = await currentWindow.outerPosition()
    windowStartY = position.y
    e.preventDefault()
  })
}

document.addEventListener('mousemove', async (e) => {
  if (!isDragging) return

  const deltaY = e.screenY - dragStartY
  const newY = windowStartY + deltaY

  const currentWindow = getCurrentWindow()

  // X位置は固定（0）、Y位置のみ変更
  await currentWindow.setPosition({ type: 'Physical', x: 0, y: newY })
})

document.addEventListener('mouseup', async () => {
  if (isDragging) {
    isDragging = false
    // 位置を保存
    const currentWindow = getCurrentWindow()
    const position = await currentWindow.outerPosition()
    localStorage.setItem('tab_position_y', String(position.y))
  }
})

// 保存された位置を復元
async function restoreTabPosition() {
  const savedY = localStorage.getItem('tab_position_y')
  if (savedY) {
    const y = parseInt(savedY, 10)
    const currentWindow = getCurrentWindow()
    await currentWindow.setPosition({ type: 'Physical', x: 0, y })
  }
}

restoreTabPosition()

// クリックでメインウィンドウをトグル（ドラッグ中はトグルしない）
document.body.addEventListener('click', async (e) => {
  // ドラッグ終了直後はクリックとして扱わない
  if (isDragging) return

  try {
    await invoke('toggle_main_window')
    // クリック後にタブを元のサイズに戻す
    if (tabHandle) {
      tabHandle.classList.add('clicked')
    }
  } catch (e) {
    console.error('Failed to toggle main window:', e)
  }
})

// マウスがタブから離れたらclickedクラスを削除
document.body.addEventListener('mouseleave', () => {
  if (tabHandle) {
    tabHandle.classList.remove('clicked')
  }
})
