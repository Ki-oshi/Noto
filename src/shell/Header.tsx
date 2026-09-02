import { useLocation } from "react-router-dom"
import { NAV_ITEMS } from "./navigation"

export function Header() {
  const location = useLocation()

  const activeItem =
    NAV_ITEMS.find((item) =>
      item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
    ) ?? NAV_ITEMS[0]

  return (
    <header className="shell-header">
      <h1 className="shell-header-title">{activeItem.label}</h1>

      {/* Reserved for global actions: search, notifications, quick-add, etc. */}
      <div className="shell-header-actions" />
    </header>
  )
}