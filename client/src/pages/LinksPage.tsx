import { useState, useEffect } from 'react'
import { Link2, Plus, Trash2, Search, ExternalLink } from 'lucide-react'

interface LinkItem {
  id: string
  title: string
  url: string
  category: string
  notes: string
  createdAt: string
}

export default function LinksPage() {
  const [links, setLinks] = useState<LinkItem[]>([])
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newLink, setNewLink] = useState({ title: '', url: '', category: '', notes: '' })

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mission-control-links')
      if (stored) setLinks(JSON.parse(stored))
    } catch {}
  }, [])

  // Save to localStorage
  const save = (updated: LinkItem[]) => {
    setLinks(updated)
    localStorage.setItem('mission-control-links', JSON.stringify(updated))
  }

  const addLink = () => {
    if (!newLink.title.trim() || !newLink.url.trim()) return
    const item: LinkItem = {
      id: crypto.randomUUID(),
      title: newLink.title.trim(),
      url: newLink.url.trim(),
      category: newLink.category.trim(),
      notes: newLink.notes.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    }
    save([item, ...links])
    setNewLink({ title: '', url: '', category: '', notes: '' })
    setShowAdd(false)
  }

  const updateLink = (id: string, updates: Partial<LinkItem>) => {
    save(links.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  const deleteLink = (id: string) => {
    if (!confirm('Delete this link?')) return
    save(links.filter(l => l.id !== id))
  }

  // Filter and search
  const categories = [...new Set(links.map(l => l.category).filter(Boolean))].sort()
  const filtered = links.filter(l => {
    if (filterCategory && l.category !== filterCategory) return false
    if (search) {
      const s = search.toLowerCase()
      return l.title.toLowerCase().includes(s) || l.url.toLowerCase().includes(s) || l.notes.toLowerCase().includes(s) || l.category.toLowerCase().includes(s)
    }
    return true
  })

  const getUrlSnippet = (url: string) => {
    try {
      const u = new URL(url)
      const path = u.pathname.split('/').filter(Boolean).pop()
      return path ? `${u.hostname}/.../${path}` : u.hostname
    } catch {
      return url.slice(0, 40)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="w-6 h-6 text-[#76B900]" />
            Links
          </h1>
          <p className="text-gray-500 text-sm mt-1">Searchable bookmarks and reference links</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] transition flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Link
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input type="text" value={newLink.title} onChange={e => setNewLink(p => ({ ...p, title: e.target.value }))} placeholder="Title..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <input type="text" value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))} placeholder="URL..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <input type="text" value={newLink.category} onChange={e => setNewLink(p => ({ ...p, category: e.target.value }))} placeholder="Category (optional)..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" list="link-categories" />
            <input type="text" value={newLink.notes} onChange={e => setNewLink(p => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
          </div>
          <datalist id="link-categories">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
          <div className="flex gap-2">
            <button onClick={addLink} className="px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] transition">Save</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search links..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
        </div>
        {categories.length > 0 && (
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Links Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {links.length === 0 ? 'No links saved yet. Click "Add Link" to get started.' : 'No links match your search.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                <th className="w-10 px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(link => (
                <tr key={link.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <input type="text" value={link.title} onChange={e => updateLink(link.id, { title: e.target.value })} className="w-full bg-transparent text-sm font-medium text-gray-900 border-0 p-0 focus:outline-none focus:ring-0" />
                  </td>
                  <td className="px-4 py-3">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[#76B900] hover:underline text-xs flex items-center gap-1 max-w-[200px] truncate" title={link.url}>
                      {getUrlSnippet(link.url)}
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={link.category} onChange={e => updateLink(link.id, { category: e.target.value })} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none" placeholder="—" list="link-categories" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={link.notes} onChange={e => updateLink(link.id, { notes: e.target.value })} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none" placeholder="—" />
                  </td>
                  <td className="px-2 py-3">
                    <button onClick={() => deleteLink(link.id)} className="text-gray-300 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 text-xs text-gray-400">{filtered.length} link{filtered.length !== 1 ? 's' : ''}</div>
    </div>
  )
}
