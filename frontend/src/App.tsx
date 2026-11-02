import { ListTodo } from 'lucide-react'
import { NavLink, Route, Routes } from 'react-router-dom'
import CreateTaskPage from './pages/CreateTaskPage'
import TaskListPage from './pages/TaskListPage'

// highlight the nav link for the page we're on
function navLinkClass({ isActive }: { isActive: boolean }) {
  return `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-violet-200 text-violet-900' : 'text-slate-600 hover:bg-violet-100'
  }`
}

// the frame around every page: header + whichever page matches the url
export default function App() {
  return (
    <div className="min-h-screen bg-linear-to-br from-violet-100 via-pink-50 to-sky-100 text-slate-800">
      <header className="sticky top-0 z-10 border-b border-white/60 bg-white/60 backdrop-blur-md">
        <nav className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
          <span className="mr-auto flex items-center gap-2 font-bold text-violet-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-200">
              <ListTodo size={18} aria-hidden="true" />
            </span>
            {/* name hidden on small phones so the header stays on one line */}
            <span className="sr-only sm:not-sr-only">Task Assignment</span>
          </span>
          <NavLink to="/" end className={navLinkClass}>
            Tasks
          </NavLink>
          <NavLink to="/tasks/new" className={navLinkClass}>
            Create Task
          </NavLink>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* swaps pages without reloading, it's a single page app */}
        <Routes>
          <Route path="/" element={<TaskListPage />} />
          <Route path="/tasks/new" element={<CreateTaskPage />} />
        </Routes>
      </main>
    </div>
  )
}
