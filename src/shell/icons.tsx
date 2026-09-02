// Minimal inline icon set — no external dependency.
// All icons are 20x20, stroke-based, and inherit color via currentColor
// so they automatically follow the active theme.

import type { SVGProps } from "react"

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  )
}

export function DashboardIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  )
}

export function NotesIcon() {
  return (
    <Icon>
      <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </Icon>
  )
}

export function TasksIcon() {
  return (
    <Icon>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="m8 12 2.5 2.5L16 9" />
    </Icon>
  )
}

export function CalendarIcon() {
  return (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </Icon>
  )
}

export function FinancesIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M15 9.5c0-1.4-1.34-2.5-3-2.5s-3 1-3 2.25S10.5 11.5 12 12s3 .8 3 2.25S13.66 16.5 12 16.5s-3-1.1-3-2.5" />
    </Icon>
  )
}

export function ProjectsIcon() {
  return (
    <Icon>
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" />
    </Icon>
  )
}

export function BookmarksIcon() {
  return (
    <Icon>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </Icon>
  )
}

export function PasswordsIcon() {
  return (
    <Icon>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15" r="1.5" />
    </Icon>
  )
}

export function SettingsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 13a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 6.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 2.6a1.7 1.7 0 0 0 1.04-1.56V1a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 2.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 6.9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04Z" />
    </Icon>
  )
}

export function ChevronLeftIcon() {
  return (
    <Icon width="16" height="16">
      <path d="m14 5-7 7 7 7" />
    </Icon>
  )
}