export function hexToRGBA(hex: string, alpha: number = 1): string {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`

  hex = hex.replace(/^#/, '')

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('')
  }

  const R = parseInt(hex.substring(0, 2), 16)
  const G = parseInt(hex.substring(2, 4), 16)
  const B = parseInt(hex.substring(4, 6), 16)

  if (isNaN(R) || isNaN(G) || isNaN(B)) {
    return `rgba(0, 0, 0, ${alpha})`
  }

  return `rgba(${R}, ${G}, ${B}, ${alpha})`
}