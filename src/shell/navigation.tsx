import type { ReactNode } from "react"
import {
  DashboardIcon,
  NotesIcon,
  TasksIcon,
  CalendarIcon,
  FinancesIcon,
  ProjectsIcon,
  BookmarksIcon,
  PasswordsIcon,
  SettingsIcon,
} from "./icons"

export interface NavItem {
  id: string
  label: string
  path: string
  icon: ReactNode
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: <DashboardIcon /> },
  { id: "notes", label: "Notes", path: "/notes", icon: <NotesIcon /> },
  { id: "tasks", label: "Tasks", path: "/tasks", icon: <TasksIcon /> },
  { id: "calendar", label: "Calendar", path: "/calendar", icon: <CalendarIcon /> },
  { id: "finances", label: "Finances", path: "/finances", icon: <FinancesIcon /> },
  { id: "projects", label: "Projects", path: "/projects", icon: <ProjectsIcon /> },
  { id: "bookmarks", label: "Bookmarks", path: "/bookmarks", icon: <BookmarksIcon /> },
  { id: "passwords", label: "Passwords", path: "/passwords", icon: <PasswordsIcon /> },
  { id: "settings", label: "Settings", path: "/settings", icon: <SettingsIcon /> },
]