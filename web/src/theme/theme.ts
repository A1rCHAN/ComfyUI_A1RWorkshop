import { THEME_COLORS } from "./themeColor.js"
import { getThemeStyle, FRONTEND_TYPE, FrontendType } from "./themeType.js"

export function getTheme() {
  const themeName = detectCurrentTheme()
  const frontend = getEffectiveFrontendType()

  const colors = THEME_COLORS[themeName] ?? THEME_COLORS.dark
  const style = getThemeStyle(frontend)

  return {
    ...colors,
    ...style,
    _themeName: themeName,
    _frontendType: frontend
  }
}
