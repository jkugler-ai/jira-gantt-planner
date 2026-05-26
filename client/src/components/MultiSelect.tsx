import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface MultiSelectProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
}

export default function MultiSelect({ label, options, selected, onChange, placeholder }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter(o =>
    o.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  const removeChip = (option: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter(s => s !== option))
  }

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div
        className="min-h-[38px] px-3 py-1.5 border border-gray-200 rounded-lg bg-white cursor-pointer flex items-center gap-1 flex-wrap hover:border-[#76B900] transition"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected.length === 0 ? (
          <span className="text-sm text-gray-400">{placeholder || `All ${label}`}</span>
        ) : (
          selected.map(s => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#76B900]/10 text-[#76B900] rounded-full text-xs font-medium"
            >
              {s.length > 20 ? s.slice(0, 20) + '…' : s}
              <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={e => removeChip(s, e)} />
            </span>
          ))
        )}
        <ChevronDown className={`w-4 h-4 ml-auto text-gray-400 transition ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-[#76B900] outline-none"
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-gray-400 text-center">No options</div>
            ) : (
              filteredOptions.map(option => (
                <label
                  key={option}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() => toggle(option)}
                    className="rounded border-gray-300 text-[#76B900] focus:ring-[#76B900]"
                  />
                  <span className="truncate">{option}</span>
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="p-2 border-t border-gray-100">
              <button
                className="text-xs text-gray-500 hover:text-red-500"
                onClick={e => { e.stopPropagation(); onChange([]); }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
