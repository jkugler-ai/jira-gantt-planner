import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { KeyRound, Shield } from 'lucide-react'

export default function LoginPage() {
  const [pat, setPat] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const success = await login(pat, username)
    setLoading(false)
    if (success) {
      navigate('/')
    } else {
      setError('Login failed. Check your PAT.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* NVIDIA Logo */}
        <div className="text-center mb-8">
          <img
            src="https://www.nvidia.com/content/dam/en-zz/Solutions/about-nvidia/logo-and-brand/02-nvidia-logo-color-grn-500x200-4c25-p@2x.png"
            alt="NVIDIA"
            className="h-12 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900">Mission Control</h1>
          <p className="text-gray-500 mt-1">OMPE Program Management Dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-[#76B900]" />
            <h2 className="text-lg font-semibold text-gray-800">Sign In with Jira PAT</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Your Jira username (e.g. jkugler)"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#76B900] focus:border-transparent outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personal Access Token</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={pat}
                  onChange={e => setPat(e.target.value)}
                  placeholder="Paste your Jira PAT"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#76B900] focus:border-transparent outline-none transition"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Generate at: Profile → Personal Access Tokens
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#76B900] hover:bg-[#5a8f00] text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connecting...' : 'Connect to Jira'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              Your PAT is stored server-side in an encrypted session. Never shared or logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
