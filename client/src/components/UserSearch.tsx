import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { X, Search as SearchIcon } from 'lucide-react'

interface UserSearchProps {
  label: string
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function UserSearch({ label, selected, onChange }: UserSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ key: string; name: string; displayName: string }[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (search.length < 2) {
      setResults([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await axios.get('/api/jira/user-search', { params: { query: search } })
        setResults(res.data.users)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [search])

  const addUser = (displayName: string) => {
    if (!selected.includes(displayName)) {
      onChange([...selected, displayName])
    }
    setSearch('')
    setResults([])
  }

  const removeUser = (displayName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter(s => s !== displayName))
  }

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div
        className="min-h-[38px] px-3 py-1.5 border border-gray-200 rounded-lg bg-white cursor-text flex items-center gap-1 flex-wrap hover:border-[#76B900] transition"
        onClick={() => setIsOpen(true)}
      >
        {selected.map(s => (
          <span
            key={s}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#76B900]/10 text-[#76B900] rounded-full text-xs font-medium"
          >
            {s.length > 18 ? s.slice(0, 18) + '…' : s}
            <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={e => removeUser(s, e)} />
          </span>
        ))}
        {isOpen && (
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[80px] text-sm outline-none border-none p-0"
            placeholder="Type to search..."
            autoFocus
          />
        )}
        {!isOpen && selected.length === 0 && (
          <span className="text-sm text-gray-400">Search users...</span>
        )}
        <SearchIcon className="w-3.5 h-3.5 ml-auto text-gray-400" />
      </div>

      {isOpen && (search.length >= 2 || results.length > 0) && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-gray-400 text-center">Searching...</div>
          ) : results.length === 0 && search.length >= 2 ? (
            <div className="p-3 text-sm text-gray-400 text-center">No users found</div>
          ) : (
            results.map(user => (
              <button
                key={user.key}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center justify-between"
                onClick={() => addUser(user.displayName)}
              >
                <span>{user.displayName}</span>
                <span className="text-xs text-gray-400">{user.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
