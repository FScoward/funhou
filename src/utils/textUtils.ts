export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function getFirstLine(text: string, maxLength: number = 50): string {
  const firstLine = text.split('\n')[0]
  return truncateText(firstLine, maxLength)
}
