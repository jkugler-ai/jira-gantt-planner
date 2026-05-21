import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'

interface AuthContextType {
  isAuthenticated: boolean
  username: string | null
  loading: boolean
  login: (pat: string, username: string) => Promise<boolean>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const res = await axios.get('/api/auth/status')
      setIsAuthenticated(res.data.authenticated)
      setUsername(res.data.username || null)
    } catch {
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  async function login(pat: string, username: string): Promise<boolean> {
    try {
      const res = await axios.post('/api/auth/login', { pat, username })
      if (res.data.success) {
        setIsAuthenticated(true)
        setUsername(username)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function logout() {
    await axios.post('/api/auth/logout')
    setIsAuthenticated(false)
    setUsername(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
