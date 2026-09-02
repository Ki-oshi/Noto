import { useState } from "react"
import { NavLink } from "react-router-dom"
import { NAV_ITEMS } from "./navigation"
import { ChevronLeftIcon } from "./icons"

const STORAGE_KEY = "noto-sidebar-collapsed"

function getStoredCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(getStoredCollapsed)

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // ignore storage failures
      }
      return next
    })
  }

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">N</span>
        {!collapsed && <span className="sidebar-brand-name">Noto</span>}
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? "sidebar-nav-item--active" : ""}`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        className="sidebar-collapse-toggle"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <span
          className="sidebar-collapse-icon"
          style={{
            transform: collapsed ? "rotate(180deg)" : "none",
          }}
        >
          <ChevronLeftIcon />
        </span>
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  )
}