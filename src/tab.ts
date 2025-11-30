import { invoke } from '@tauri-apps/api/core'

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

// ホバーで自動オープン用のタイマー
let hoverTimer: number | null = null
const HOVER_DELAY = 500 // ミリ秒

document.body.addEventListener('mouseenter', () => {
  hoverTimer = window.setTimeout(async () => {
    try {
      await invoke('toggle_main_window')
    } catch (e) {
      console.error('Failed to toggle main window:', e)
    }
  }, HOVER_DELAY)
})

document.body.addEventListener('mouseleave', () => {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
})

document.body.addEventListener('click', async () => {
  // クリック時はタイマーをキャンセルして即座に開く
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  try {
    await invoke('toggle_main_window')
  } catch (e) {
    console.error('Failed to toggle main window:', e)
  }
})
