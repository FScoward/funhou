export type ThemeVariant = 'default' | 'rose-pine' | 'rose-pine-moon' | 'rose-pine-dawn'

interface ThemeColors {
  base: string
  surface: string
  overlay: string
  muted: string
  subtle: string
  text: string
  love: string
  gold: string
  rose: string
  pine: string
  foam: string
  iris: string
}

interface Theme {
  name: string
  isDark: boolean
  colors: ThemeColors
}

export const themes: Record<Exclude<ThemeVariant, 'default'>, Theme> = {
  'rose-pine': {
    name: 'Rose Pine',
    isDark: true,
    colors: {
      base: '#191724',
      surface: '#1f1d2e',
      overlay: '#26233a',
      muted: '#6e6a86',
      subtle: '#908caa',
      text: '#e0def4',
      love: '#eb6f92',
      gold: '#f6c177',
      rose: '#ebbcba',
      pine: '#31748f',
      foam: '#9ccfd8',
      iris: '#c4a7e7',
    },
  },
  'rose-pine-moon': {
    name: 'Rose Pine Moon',
    isDark: true,
    colors: {
      base: '#232136',
      surface: '#2a273f',
      overlay: '#393552',
      muted: '#6e6a86',
      subtle: '#908caa',
      text: '#e0def4',
      love: '#eb6f92',
      gold: '#f6c177',
      rose: '#ea9a97',
      pine: '#3e8fb0',
      foam: '#9ccfd8',
      iris: '#c4a7e7',
    },
  },
  'rose-pine-dawn': {
    name: 'Rose Pine Dawn',
    isDark: false,
    colors: {
      base: '#faf4ed',
      surface: '#fffaf3',
      overlay: '#f2e9e1',
      muted: '#9893a5',
      subtle: '#797593',
      text: '#575279',
      love: '#b4637a',
      gold: '#ea9d34',
      rose: '#d7827e',
      pine: '#286983',
      foam: '#56949f',
      iris: '#907aa9',
    },
  },
}

// Apply theme class to document
export function applyTheme(theme: ThemeVariant): void {
  const root = document.documentElement

  // Remove existing theme classes
  root.classList.remove('theme-rose-pine', 'theme-rose-pine-moon', 'theme-rose-pine-dawn', 'dark')

  if (theme === 'default') {
    // Default theme: follow system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark')
    }
    return
  }

  const themeData = themes[theme]
  if (!themeData) return

  // Add theme class
  root.classList.add(`theme-${theme}`)

  // Add dark class for dark themes (for Tailwind compatibility)
  if (themeData.isDark) {
    root.classList.add('dark')
  }
}
