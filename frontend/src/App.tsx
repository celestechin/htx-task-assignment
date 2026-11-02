import { NavLink, Route, Routes } from 'react-router-dom'
import CreateTaskPage from './pages/CreateTaskPage'
import TaskListPage from './pages/TaskListPage'

// highlight the nav link for the page we're on
function navLinkClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
  }`
}

// the frame around every page: header + whichever page matches the url
export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <span className="mr-auto font-semibold">Task Assignment</span>
          <NavLink to="/" end className={navLinkClass}>
            Tasks
          </NavLink>
          <NavLink to="/tasks/new" className={navLinkClass}>
            Create Task
          </NavLink>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* swaps pages without reloading, it's a single page app */}
        <Routes>
          <Route path="/" element={<TaskListPage />} />
          <Route path="/tasks/new" element={<CreateTaskPage />} />
        </Routes>
      </main>
    </div>
  )
}
