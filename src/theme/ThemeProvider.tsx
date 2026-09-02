import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  themes,
  type Appearance,
  type ThemePreset,
} from "./themes"

interface ThemeState {
  appearance: Appearance
  preset: ThemePreset
  customColor: string
}

interface ThemeContextValue {
  appearance: Appearance
  preset: ThemePreset
  customColor: string

  setAppearance: (appearance: Appearance) => void
  setPreset: (preset: ThemePreset) => void
  setCustomColor: (color: string) => void

  resetTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = "noto-theme"

const DEFAULT_THEME: ThemeState = {
  appearance: "system",
  preset: "sage",
  customColor: "#A8C3A0",
}

function getStoredTheme(): ThemeState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      return DEFAULT_THEME
    }

    const parsed = JSON.parse(stored) as Partial<ThemeState>

    return {
      appearance:
        parsed.appearance === "light" ||
        parsed.appearance === "dark" ||
        parsed.appearance === "system"
          ? parsed.appearance
          : DEFAULT_THEME.appearance,

      preset:
        parsed.preset &&
        Object.prototype.hasOwnProperty.call(themes, parsed.preset)
          ? parsed.preset
          : DEFAULT_THEME.preset,

      customColor:
        typeof parsed.customColor === "string"
          ? parsed.customColor
          : DEFAULT_THEME.customColor,
    }
  } catch {
    return DEFAULT_THEME
  }
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "")

  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) {
    return null
  }

  const value = Number.parseInt(clean, 16)

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function createCustomTheme(color: string) {
  const rgb = hexToRgb(color)

  if (!rgb) {
    return themes.sage
  }

  const { r, g, b } = rgb

  return {
    light: {
      primary: color,
      primaryForeground: "#FFFFFF",
      background: "#F8F8F8",
      surface: "#FFFFFF",
      surfaceHover: `rgba(${r}, ${g}, ${b}, 0.08)`,
      text: "#171717",
      textMuted: "#6B6B6B",
      border: "#DDDDDD",
      accent: color,
    },

    dark: {
      primary: color,
      primaryForeground: "#FFFFFF",
      background: "#151515",
      surface: "#1E1E1E",
      surfaceHover: `rgba(${r}, ${g}, ${b}, 0.14)`,
      text: "#F3F3F3",
      textMuted: "#AAAAAA",
      border: "#353535",
      accent: color,
    },
  }
}

export function ThemeProvider({
  children,
}: {
  children: ReactNode
}) {
  const [theme, setTheme] = useState<ThemeState>(getStoredTheme)

  const {
    appearance,
    preset,
    customColor,
  } = theme

  const [systemDark, setSystemDark] = useState<boolean>(
    () =>
      window.matchMedia?.(
        "(prefers-color-scheme: dark)"
      ).matches ?? false
  )

  useEffect(() => {
    const media = window.matchMedia(
      "(prefers-color-scheme: dark)"
    )

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches)
    }

    media.addEventListener("change", handleChange)

    return () => {
      media.removeEventListener("change", handleChange)
    }
  }, [])

  const isDark =
    appearance === "dark" ||
    (appearance === "system" && systemDark)

  const isCustomColor =
    customColor !== themes[preset].color

  const colors = useMemo(() => {
    const source = isCustomColor
      ? createCustomTheme(customColor)
      : themes[preset]

    return isDark ? source.dark : source.light
  }, [
    customColor,
    preset,
    isDark,
    isCustomColor,
  ])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(theme)
    )
  }, [theme])

  useEffect(() => {
    const root = document.documentElement

    root.dataset.theme = isDark ? "dark" : "light"

    Object.entries(colors).forEach(
      ([key, value]: [string, string]) => {
        const cssVariable = key.replace(
          /[A-Z]/g,
          (match) => `-${match.toLowerCase()}`
        )

        root.style.setProperty(
          `--color-${cssVariable}`,
          value
        )
      }
    )
  }, [colors, isDark])

  const value = useMemo<ThemeContextValue>(
    () => ({
      appearance,
      preset,
      customColor,

      setAppearance: (
        value: Appearance
      ) => {
        setTheme((current: ThemeState) => ({
          ...current,
          appearance: value,
        }))
      },

      setPreset: (
        value: ThemePreset
      ) => {
        setTheme((current: ThemeState) => ({
          ...current,
          preset: value,
          customColor: themes[value].color,
        }))
      },

      setCustomColor: (
        value: string
      ) => {
        setTheme((current: ThemeState) => ({
          ...current,
          customColor: value,
        }))
      },

      resetTheme: () => {
        setTheme(DEFAULT_THEME)
      },
    }),
    [
      appearance,
      preset,
      customColor,
    ]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    )
  }

  return context
}