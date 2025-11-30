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

// クリックでメインウィンドウをトグル
document.body.addEventListener('click', async () => {
  try {
    await invoke('toggle_main_window')
  } catch (e) {
    console.error('Failed to toggle main window:', e)
  }
})
