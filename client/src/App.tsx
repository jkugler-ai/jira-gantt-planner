import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { FilterProvider } from './context/FilterContext'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import StoriesPage from './pages/StoriesPage'
import SprintGoalsPage from './pages/SprintGoalsPage'
import ReleasesPage from './pages/ReleasesPage'
import BugsPage from './pages/BugsPage'
import GanttPage from './pages/GanttPage'
import CalendarPage from './pages/CalendarPage'
import DependencyGraphPage from './pages/DependencyGraphPage'
import EmailGeneratorPage from './pages/EmailGeneratorPage'
import DailyTasksPage from './pages/DailyTasksPage'
import LinksPage from './pages/LinksPage'
import NSpectPage from './pages/NSpectPage'
import ChangeLogPage from './pages/ChangeLogPage'
import './index.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!isAuthenticated) return <Navigate to="/login" />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FilterProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="stories" element={<ErrorBoundary><StoriesPage /></ErrorBoundary>} />
              <Route path="sprint-goals" element={<ErrorBoundary><SprintGoalsPage /></ErrorBoundary>} />
              <Route path="releases" element={<ErrorBoundary><ReleasesPage /></ErrorBoundary>} />
              <Route path="bugs" element={<ErrorBoundary><BugsPage /></ErrorBoundary>} />
              <Route path="gantt" element={<ErrorBoundary><GanttPage /></ErrorBoundary>} />
              <Route path="calendar" element={<ErrorBoundary><CalendarPage /></ErrorBoundary>} />
              <Route path="dependencies" element={<ErrorBoundary><DependencyGraphPage /></ErrorBoundary>} />
              <Route path="email" element={<ErrorBoundary><EmailGeneratorPage /></ErrorBoundary>} />
              <Route path="daily-tasks" element={<ErrorBoundary><DailyTasksPage /></ErrorBoundary>} />
              <Route path="links" element={<ErrorBoundary><LinksPage /></ErrorBoundary>} />
              <Route path="nspect" element={<ErrorBoundary><NSpectPage /></ErrorBoundary>} />
              <Route path="changelog" element={<ErrorBoundary><ChangeLogPage /></ErrorBoundary>} />
            </Route>
          </Routes>
        </FilterProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
