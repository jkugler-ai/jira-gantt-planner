import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { FilterProvider } from './context/FilterContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import StoriesPage from './pages/StoriesPage'
import SprintGoalsPage from './pages/SprintGoalsPage'
import ReleasesPage from './pages/ReleasesPage'
import BugsPage from './pages/BugsPage'
import GanttPage from './pages/GanttPage'
import CalendarPage from './pages/CalendarPage'
import DependencyGraphPage from './pages/DependencyGraphPage'
import EmailGeneratorPage from './pages/EmailGeneratorPage'
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
              <Route index element={<StoriesPage />} />
              <Route path="sprint-goals" element={<SprintGoalsPage />} />
              <Route path="releases" element={<ReleasesPage />} />
              <Route path="bugs" element={<BugsPage />} />
              <Route path="gantt" element={<GanttPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="dependencies" element={<DependencyGraphPage />} />
              <Route path="email" element={<EmailGeneratorPage />} />
            </Route>
          </Routes>
        </FilterProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
