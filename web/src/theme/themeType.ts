// TODO: comfyui nodes2.0 检测，识别前端类型，自动切换主题
export const FRONTEND_TYPE = {
  MODERN: "modern",
  CLASSIC: "classic",
  AUTO: "auto"
} as const

export type FrontendType = typeof FRONTEND_TYPE[keyof typeof FRONTEND_TYPE]

export interface ThemeStyle {
  borderRadius: string
  fontFamily: string
  isClassic: boolean
}

export function getThemeStyle(type: FrontendType): ThemeStyle {
  if (type === FRONTEND_TYPE.CLASSIC) {
    return {
      borderRadius: "0px",
      fontFamily: "Courier New, monospace",
      isClassic: true
    }
  }

  return {
    borderRadius: "6px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    isClassic: false
  }
}