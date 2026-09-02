export type Appearance = "light" | "dark" | "system"

export type ThemePreset =
  | "sage"
  | "forest"
  | "ocean"
  | "midnight"
  | "lavender"
  | "rose"
  | "amber"
  | "cyan"
  | "mono"

export interface ThemeColors {
  primary: string
  primaryForeground: string
  background: string
  surface: string
  surfaceHover: string
  text: string
  textMuted: string
  border: string
  accent: string
}

export interface ThemePresetDefinition {
  name: string
  color: string
  light: ThemeColors
  dark: ThemeColors
}

const createTheme = (
  color: string,
  light: ThemeColors,
  dark: ThemeColors
): ThemePresetDefinition => ({
  name: "",
  color,
  light,
  dark,
})

export const themes: Record<ThemePreset, ThemePresetDefinition> = {
  sage: createTheme(
    "#A8C3A0",
    {
      primary: "#A8C3A0",
      primaryForeground: "#172016",
      background: "#F7F8F5",
      surface: "#FFFFFF",
      surfaceHover: "#EEF2EB",
      text: "#171A16",
      textMuted: "#697064",
      border: "#DCE2D8",
      accent: "#8EAC87",
    },
    {
      primary: "#A8C3A0",
      primaryForeground: "#172016",
      background: "#151914",
      surface: "#1D231C",
      surfaceHover: "#273026",
      text: "#F1F4EF",
      textMuted: "#A8B1A4",
      border: "#343D32",
      accent: "#A8C3A0",
    }
  ),

  forest: createTheme(
    "#6FA77A",
    {
      primary: "#6FA77A",
      primaryForeground: "#102015",
      background: "#F5F8F5",
      surface: "#FFFFFF",
      surfaceHover: "#EAF2EB",
      text: "#172019",
      textMuted: "#647066",
      border: "#D6E1D7",
      accent: "#4F8C5D",
    },
    {
      primary: "#6FA77A",
      primaryForeground: "#0F1811",
      background: "#111812",
      surface: "#1A231B",
      surfaceHover: "#253126",
      text: "#EFF5F0",
      textMuted: "#A4B2A6",
      border: "#334034",
      accent: "#7FBA89",
    }
  ),

  ocean: createTheme(
    "#67A7C9",
    {
      primary: "#67A7C9",
      primaryForeground: "#10202A",
      background: "#F4F8FA",
      surface: "#FFFFFF",
      surfaceHover: "#E8F1F5",
      text: "#172026",
      textMuted: "#66727A",
      border: "#D5E1E7",
      accent: "#4A91B7",
    },
    {
      primary: "#67A7C9",
      primaryForeground: "#10202A",
      background: "#11181C",
      surface: "#192329",
      surfaceHover: "#24323A",
      text: "#EFF5F8",
      textMuted: "#A5B4BC",
      border: "#33434C",
      accent: "#76B6D5",
    }
  ),

  midnight: createTheme(
    "#7C83F6",
    {
      primary: "#7C83F6",
      primaryForeground: "#11132A",
      background: "#F5F5FC",
      surface: "#FFFFFF",
      surfaceHover: "#ECECFA",
      text: "#181925",
      textMuted: "#696B7B",
      border: "#DCDCEA",
      accent: "#696FF0",
    },
    {
      primary: "#7C83F6",
      primaryForeground: "#11132A",
      background: "#11121D",
      surface: "#191A29",
      surfaceHover: "#25263A",
      text: "#F2F2FA",
      textMuted: "#A5A6B8",
      border: "#34354A",
      accent: "#8E94FF",
    }
  ),

  lavender: createTheme(
    "#9D7CF3",
    {
      primary: "#9D7CF3",
      primaryForeground: "#1B1229",
      background: "#F8F6FC",
      surface: "#FFFFFF",
      surfaceHover: "#F0EBFA",
      text: "#1D1924",
      textMuted: "#706A78",
      border: "#E0D9EB",
      accent: "#8965E5",
    },
    {
      primary: "#9D7CF3",
      primaryForeground: "#171021",
      background: "#17131D",
      surface: "#211B29",
      surfaceHover: "#30283A",
      text: "#F5F1FA",
      textMuted: "#AEA5B7",
      border: "#403649",
      accent: "#AA8CF7",
    }
  ),

  rose: createTheme(
    "#E797A8",
    {
      primary: "#E797A8",
      primaryForeground: "#2B141A",
      background: "#FCF7F8",
      surface: "#FFFFFF",
      surfaceHover: "#F9ECEF",
      text: "#24181B",
      textMuted: "#76676B",
      border: "#EAD9DD",
      accent: "#D97D91",
    },
    {
      primary: "#E797A8",
      primaryForeground: "#281217",
      background: "#1C1416",
      surface: "#271B1F",
      surfaceHover: "#38262B",
      text: "#FAF1F3",
      textMuted: "#B8A5AA",
      border: "#49343A",
      accent: "#F0A5B4",
    }
  ),

  amber: createTheme(
    "#DDA33B",
    {
      primary: "#DDA33B",
      primaryForeground: "#261B08",
      background: "#FCF9F2",
      surface: "#FFFFFF",
      surfaceHover: "#F8F0DE",
      text: "#211C14",
      textMuted: "#746C5D",
      border: "#E8DDC8",
      accent: "#C68E26",
    },
    {
      primary: "#DDA33B",
      primaryForeground: "#241A08",
      background: "#1B1811",
      surface: "#262117",
      surfaceHover: "#362E1F",
      text: "#FAF5E9",
      textMuted: "#B8AD96",
      border: "#473D2B",
      accent: "#E6AF4C",
    }
  ),

  cyan: createTheme(
    "#60C0C5",
    {
      primary: "#60C0C5",
      primaryForeground: "#102426",
      background: "#F3FAFA",
      surface: "#FFFFFF",
      surfaceHover: "#E5F4F4",
      text: "#162122",
      textMuted: "#647273",
      border: "#D4E5E5",
      accent: "#43A9AF",
    },
    {
      primary: "#60C0C5",
      primaryForeground: "#102426",
      background: "#111A1B",
      surface: "#192526",
      surfaceHover: "#253436",
      text: "#EFF8F8",
      textMuted: "#A5B6B7",
      border: "#34484A",
      accent: "#73D0D5",
    }
  ),

  mono: createTheme(
    "#A5A5A5",
    {
      primary: "#A5A5A5",
      primaryForeground: "#171717",
      background: "#F7F7F7",
      surface: "#FFFFFF",
      surfaceHover: "#EEEEEE",
      text: "#171717",
      textMuted: "#686868",
      border: "#DCDCDC",
      accent: "#777777",
    },
    {
      primary: "#A5A5A5",
      primaryForeground: "#111111",
      background: "#151515",
      surface: "#1E1E1E",
      surfaceHover: "#292929",
      text: "#F2F2F2",
      textMuted: "#A5A5A5",
      border: "#363636",
      accent: "#BBBBBB",
    }
  ),
}

export const presetNames: Record<ThemePreset, string> = {
  sage: "Sage",
  forest: "Forest",
  ocean: "Ocean",
  midnight: "Midnight",
  lavender: "Lavender",
  rose: "Rose",
  amber: "Amber",
  cyan: "Cyan",
  mono: "Mono",
}