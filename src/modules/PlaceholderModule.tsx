interface PlaceholderModuleProps {
  title: string
}

export function PlaceholderModule({ title }: PlaceholderModuleProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        padding: 24,
        border: "1px dashed var(--color-border)",
        borderRadius: 12,
        color: "var(--color-text-muted)",
      }}
    >
      <h2 style={{ margin: 0, color: "var(--color-text)" }}>{title}</h2>
      <p style={{ margin: 0 }}>This module hasn't been built yet.</p>
    </div>
  )
}