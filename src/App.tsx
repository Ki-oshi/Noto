import { Routes, Route } from "react-router-dom"
import { AppShell } from "./shell/AppShell"
import { Dashboard } from "./modules/Dashboard"
import { Notes } from "./modules/Notes"
import { Settings } from "./modules/Settings"
import { PlaceholderModule } from "./modules/PlaceholderModule"

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="notes" element={<Notes />} />
        <Route path="tasks" element={<PlaceholderModule title="Tasks" />} />
        <Route path="calendar" element={<PlaceholderModule title="Calendar" />} />
        <Route path="finances" element={<PlaceholderModule title="Finances" />} />
        <Route path="projects" element={<PlaceholderModule title="Projects" />} />
        <Route path="bookmarks" element={<PlaceholderModule title="Bookmarks" />} />
        <Route path="passwords" element={<PlaceholderModule title="Passwords" />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App