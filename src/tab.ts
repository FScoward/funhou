import { invoke } from '@tauri-apps/api/core'

document.body.addEventListener('click', async () => {
  try {
    await invoke('toggle_main_window')
  } catch (e) {
    console.error('Failed to toggle main window:', e)
  }
})
