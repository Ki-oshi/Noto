import { useTheme } from "../theme/ThemeProvider"
import { presetNames, type ThemePreset } from "../theme/themes"

export function Settings() {
  const {
    appearance,
    preset,
    customColor,
    setAppearance,
    setPreset,
    setCustomColor,
    resetTheme,
  } = useTheme()

  return (
    <section
      style={{
        maxWidth: 640,
        padding: 24,
        border: "1px solid var(--color-border)",
        borderRadius: 16,
        background: "var(--color-surface)",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Appearance</h2>

      <div style={{ display: "flex", gap: 8 }}>
        {(["light", "dark", "system"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setAppearance(mode)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--color-border)",
              background: appearance === mode ? "var(--color-primary)" : "var(--color-surface)",
              color:
                appearance === mode ? "var(--color-primary-foreground)" : "var(--color-text)",
              cursor: "pointer",
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      <h2 style={{ marginTop: 32 }}>Preset Themes</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        {(Object.keys(presetNames) as ThemePreset[]).map((themeName) => {
          const theme = presetNames[themeName]

          return (
            <button
              key={themeName}
              onClick={() => setPreset(themeName)}
              style={{
                padding: 16,
                borderRadius: 12,
                border:
                  preset === themeName
                    ? "2px solid var(--color-primary)"
                    : "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "var(--color-primary)",
                  marginRight: 8,
                }}
              />
              {theme}
            </button>
          )
        })}
      </div>

      <h2 style={{ marginTop: 32 }}>Custom Color</h2>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input
          type="color"
          value={customColor}
          onChange={(event) => setCustomColor(event.target.value)}
          style={{ width: 52, height: 40, border: 0, cursor: "pointer" }}
        />
        <code>{customColor}</code>
      </div>

      <button
        onClick={resetTheme}
        style={{
          marginTop: 24,
          padding: "10px 16px",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          background: "var(--color-surface)",
          color: "var(--color-text)",
          cursor: "pointer",
        }}
      >
        Reset to Noto Default
      </button>
    </section>
  )
}