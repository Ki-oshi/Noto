import { Routes, Route } from "react-router-dom"
import { AppShell } from "./shell/AppShell"
import { Dashboard } from "./modules/Dashboard"
import { Notes } from "./modules/Notes"
import { Tasks } from "./modules/Tasks"
import { Calendar } from "./modules/Calendar"
import { Finances } from "./modules/Finances"
import { Settings } from "./modules/Settings"
import { Bookmarks } from "./modules/Bookmarks"
import { Passwords } from "./modules/Passwords"

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="notes" element={<Notes />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="finances" element={<Finances />} />
        <Route path="bookmarks" element={<Bookmarks />} />
        <Route path="passwords" element={<Passwords />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App