import { useState, useEffect } from 'react'
import { Shield, Plus, Trash2, Search, ExternalLink, Download, RefreshCw } from 'lucide-react'

interface NSpectEntry {
  id: string
  nspectId: string
  productName: string
  nspectLink: string
  osrb: string
  exportCompliance: string
  legalTicket: string
  programMvsb: string
  notes: string
  createdAt: string
}

// Category detection from PLC Pillar ticket summaries
function categorize(summary: string): string | null {
  const s = summary.toLowerCase()
  if (s.includes('osrb') || s.includes('sbom') || s.includes('oss vuln') || s.includes('oss license') || s.includes('open source')) return 'osrb'
  if (s.includes('export') || s.includes('eccn')) return 'exportCompliance'
  if (s.includes('legal') || s.includes('privacy')) return 'legalTicket'
  if (s.includes('mvsb') || s.includes('malware') || s.includes('secret scan') || s.includes('artifact sign')) return 'programMvsb'
  if (s.includes('nspect') || s.includes('registration')) return 'nspectLink'
  return null
}

export default function NSpectPage() {
  const [entries, setEntries] = useState<NSpectEntry[]>([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importVersion, setImportVersion] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [newEntry, setNewEntry] = useState({ nspectId: '', productName: '', nspectLink: '', osrb: '', exportCompliance: '', legalTicket: '', programMvsb: '', notes: '' })

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mission-control-nspect')
      if (stored) setEntries(JSON.parse(stored))
    } catch {}
  }, [])

  // Save to localStorage
  const save = (updated: NSpectEntry[]) => {
    setEntries(updated)
    localStorage.setItem('mission-control-nspect', JSON.stringify(updated))
  }

  const addEntry = () => {
    if (!newEntry.nspectId.trim() && !newEntry.productName.trim()) return
    const item: NSpectEntry = {
      id: crypto.randomUUID(),
      nspectId: newEntry.nspectId.trim(),
      productName: newEntry.productName.trim(),
      nspectLink: newEntry.nspectLink.trim(),
      osrb: newEntry.osrb.trim(),
      exportCompliance: newEntry.exportCompliance.trim(),
      legalTicket: newEntry.legalTicket.trim(),
      programMvsb: newEntry.programMvsb.trim(),
      notes: newEntry.notes.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    }
    save([item, ...entries])
    setNewEntry({ nspectId: '', productName: '', nspectLink: '', osrb: '', exportCompliance: '', legalTicket: '', programMvsb: '', notes: '' })
    setShowAdd(false)
  }

  const updateEntry = (id: string, updates: Partial<NSpectEntry>) => {
    save(entries.map(e => e.id === id ? { ...e, ...updates } : e))
  }

  const deleteEntry = (id: string) => {
    if (!confirm('Delete this entry?')) return
    save(entries.filter(e => e.id !== id))
  }

  // Import from Jira
  const importFromJira = async () => {
    if (!importVersion.trim()) return
    setImporting(true)
    setImportError('')
    try {
      // Step 1: Find PLC Pillar parent(s) in the fixVersion
      const fvJql = `project = OMPE AND fixVersion = "${importVersion.trim()}" AND issuetype = "PLC Pillar" ORDER BY key ASC`
      const fvRes = await fetch(`/api/jira/query?jql=${encodeURIComponent(fvJql)}&maxResults=50`, { credentials: 'include' })
      if (!fvRes.ok) throw new Error('Failed to query fixVersion')
      const fvData = await fvRes.json()
      const plcParents = fvData.issues || []

      if (plcParents.length === 0) {
        setImportError(`No PLC Pillar tickets found in fixVersion "${importVersion.trim()}"`)
        setImporting(false)
        return
      }

      // Step 2: For each PLC parent, get its blockers
      const newEntries: NSpectEntry[] = []

      for (const parent of plcParents) {
        const linkRes = await fetch(`/api/jira/issue/${parent.key}/links`, { credentials: 'include' })
        if (!linkRes.ok) continue
        const linkData = await linkRes.json()
        const blockers = linkData.blockers || []

        // Create one entry per PLC parent, with categorized children
        const entry: NSpectEntry = {
          id: crypto.randomUUID(),
          nspectId: '',
          productName: parent.summary.replace(/L[01] PLC Parent Task - \[?/, '').replace(/\]?$/, '').trim() || importVersion.trim(),
          nspectLink: '',
          osrb: '',
          exportCompliance: '',
          legalTicket: '',
          programMvsb: '',
          notes: `${parent.key} — ${parent.status}`,
          createdAt: new Date().toISOString().slice(0, 10),
        }

        // Categorize each blocker
        for (const child of blockers) {
          const cat = categorize(child.summary)
          const ticketRef = `${child.key} (${child.status})`
          if (cat === 'osrb') {
            entry.osrb = entry.osrb ? `${entry.osrb}, ${ticketRef}` : ticketRef
          } else if (cat === 'exportCompliance') {
            entry.exportCompliance = entry.exportCompliance ? `${entry.exportCompliance}, ${ticketRef}` : ticketRef
          } else if (cat === 'legalTicket') {
            entry.legalTicket = entry.legalTicket ? `${entry.legalTicket}, ${ticketRef}` : ticketRef
          } else if (cat === 'programMvsb') {
            entry.programMvsb = entry.programMvsb ? `${entry.programMvsb}, ${ticketRef}` : ticketRef
          } else if (cat === 'nspectLink') {
            entry.nspectId = entry.nspectId ? `${entry.nspectId}, ${ticketRef}` : ticketRef
          }
          // Uncategorized blockers go to notes
          if (!cat) {
            const extra = `${child.key}: ${child.summary.slice(0, 40)} (${child.status})`
            entry.notes = entry.notes ? `${entry.notes} | ${extra}` : extra
          }
        }

        newEntries.push(entry)
      }

      // Add new entries (skip if product name already exists)
      const existingNames = new Set(entries.map(e => e.productName.toLowerCase()))
      const toAdd = newEntries.filter(e => !existingNames.has(e.productName.toLowerCase()))
      if (toAdd.length === 0) {
        setImportError(`All PLC parents from "${importVersion.trim()}" already exist in the table`)
      } else {
        save([...toAdd, ...entries])
        setShowImport(false)
        setImportVersion('')
      }
    } catch (e: any) {
      setImportError(e.message || 'Import failed')
    }
    setImporting(false)
  }

  // Filter
  const filtered = entries.filter(e => {
    if (!search) return true
    const s = search.toLowerCase()
    return e.nspectId.toLowerCase().includes(s) || e.productName.toLowerCase().includes(s) || e.osrb.toLowerCase().includes(s) || e.exportCompliance.toLowerCase().includes(s) || e.legalTicket.toLowerCase().includes(s) || e.programMvsb.toLowerCase().includes(s) || e.notes.toLowerCase().includes(s)
  })

  const getUrlSnippet = (url: string) => {
    if (!url) return ''
    try {
      const u = new URL(url)
      const path = u.pathname.split('/').filter(Boolean).pop()
      return path || u.hostname
    } catch {
      return url.slice(0, 30)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#76B900]" />
            nSpect IDs
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track nSpect registrations, OSRB, export compliance, and legal tickets</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(!showImport)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2">
            <Download className="w-4 h-4" /> Import from Jira
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] transition flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>
      </div>

      {/* Import from Jira */}
      {showImport && (
        <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm text-blue-800 mb-2 font-medium">Import PLC Pillar data from a fixVersion</p>
          <p className="text-xs text-blue-600 mb-3">Enter an exact fixVersion name (e.g. "Storage APIs 26.05.1"). This will find PLC Pillar parents and categorize their blockers into OSRB, Export Compliance, Legal, and MVSB columns.</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={importVersion}
              onChange={e => setImportVersion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && importFromJira()}
              placeholder="fixVersion name..."
              className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button onClick={importFromJira} disabled={importing} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2">
              {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {importing ? 'Importing...' : 'Import'}
            </button>
            <button onClick={() => { setShowImport(false); setImportError('') }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition">Cancel</button>
          </div>
          {importError && <p className="text-xs text-red-600 mt-2">{importError}</p>}
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <input type="text" value={newEntry.nspectId} onChange={e => setNewEntry(p => ({ ...p, nspectId: e.target.value }))} placeholder="nSpect ID..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <input type="text" value={newEntry.productName} onChange={e => setNewEntry(p => ({ ...p, productName: e.target.value }))} placeholder="Product/Service Name..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <input type="text" value={newEntry.nspectLink} onChange={e => setNewEntry(p => ({ ...p, nspectLink: e.target.value }))} placeholder="nSpect Link..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <input type="text" value={newEntry.osrb} onChange={e => setNewEntry(p => ({ ...p, osrb: e.target.value }))} placeholder="OSRB..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <input type="text" value={newEntry.exportCompliance} onChange={e => setNewEntry(p => ({ ...p, exportCompliance: e.target.value }))} placeholder="Export Compliance..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <input type="text" value={newEntry.legalTicket} onChange={e => setNewEntry(p => ({ ...p, legalTicket: e.target.value }))} placeholder="Legal Ticket..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <input type="text" value={newEntry.programMvsb} onChange={e => setNewEntry(p => ({ ...p, programMvsb: e.target.value }))} placeholder="Program MVSB..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <input type="text" value={newEntry.notes} onChange={e => setNewEntry(p => ({ ...p, notes: e.target.value }))} placeholder="Notes..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
          </div>
          <div className="flex gap-2">
            <button onClick={addEntry} className="px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] transition">Save</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search nSpect entries..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {entries.length === 0 ? 'No nSpect entries yet. Click "Add Entry" or "Import from Jira" to get started.' : 'No entries match your search.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">nSpect ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product/Service</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">OSRB</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Export Compliance</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Legal Ticket</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program MVSB</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                <th className="w-10 px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-3 py-3">
                    <input type="text" value={entry.nspectId} onChange={e => updateEntry(entry.id, { nspectId: e.target.value })} className="w-full bg-transparent text-sm font-medium text-gray-900 border-0 p-0 focus:outline-none focus:ring-0 min-w-[80px]" placeholder="—" />
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.productName} onChange={e => updateEntry(entry.id, { productName: e.target.value })} className="w-full bg-transparent text-sm text-gray-800 border-0 p-0 focus:outline-none min-w-[120px]" placeholder="—" />
                  </td>
                  <td className="px-3 py-3">
                    {entry.nspectLink ? (
                      <a href={entry.nspectLink} target="_blank" rel="noopener noreferrer" className="text-[#76B900] hover:underline text-xs flex items-center gap-1 max-w-[120px] truncate" title={entry.nspectLink}>
                        {getUrlSnippet(entry.nspectLink)}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <input type="text" value="" onChange={e => updateEntry(entry.id, { nspectLink: e.target.value })} className="w-full bg-transparent text-xs text-gray-400 border-0 p-0 focus:outline-none" placeholder="Add link..." />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.osrb} onChange={e => updateEntry(entry.id, { osrb: e.target.value })} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none min-w-[80px]" placeholder="—" />
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.exportCompliance} onChange={e => updateEntry(entry.id, { exportCompliance: e.target.value })} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none min-w-[80px]" placeholder="—" />
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.legalTicket} onChange={e => updateEntry(entry.id, { legalTicket: e.target.value })} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none min-w-[80px]" placeholder="—" />
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.programMvsb} onChange={e => updateEntry(entry.id, { programMvsb: e.target.value })} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none min-w-[80px]" placeholder="—" />
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.notes} onChange={e => updateEntry(entry.id, { notes: e.target.value })} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none min-w-[80px]" placeholder="—" />
                  </td>
                  <td className="px-2 py-3">
                    <button onClick={() => deleteEntry(entry.id)} className="text-gray-300 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 text-xs text-gray-400">{filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}</div>
    </div>
  )
}
