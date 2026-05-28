import { useState, useEffect } from 'react'
import { Shield, Plus, Trash2, Search, ExternalLink, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'

interface NSpectEntry {
  id: string
  nspectId: string
  productName: string
  parentKey: string
  securityEngineer: string
  osrb: { key: string; status: string; link: string }
  exportCompliance: { key: string; status: string; link: string }
  legal: { key: string; status: string; link: string }
  notes: string
}

function emptyCategory() {
  return { key: '', status: '', link: '' }
}

function LinkDisplay({ url }: { url: string }) {
  if (!url) return <span className="text-gray-300">—</span>
  // Display shortened version
  let display = url
  try {
    if (url.includes('nvbugs')) {
      const match = url.match(/\/bug\/(\d+)/)
      display = match ? match[1] : url
    } else if (url.includes('nspect.nvidia.com')) {
      const match = url.match(/\/(\d+)(?:\/|$)/)
      display = match ? match[1] : url.split('/').filter(Boolean).pop() || url
    } else if (url.includes('jirasw.nvidia.com/browse/')) {
      display = url.split('/browse/')[1] || url
    } else {
      display = url.length > 30 ? url.slice(0, 30) + '…' : url
    }
  } catch {}
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#76B900] hover:underline text-xs flex items-center gap-1">
      {display}
      <ExternalLink className="w-3 h-3 flex-shrink-0" />
    </a>
  )
}

function StatusDot({ status }: { status: string }) {
  if (!status) return null
  const s = status.toLowerCase()
  let color = 'bg-gray-300'
  if (s === 'done' || s === 'closed' || s === 'resolved') color = 'bg-emerald-500'
  else if (s === 'in progress' || s === 'in review') color = 'bg-amber-400'
  else if (s === 'open' || s === 'to do' || s === 'new') color = 'bg-blue-400'
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${color} inline-block`} title={status}></span>
      <span className="text-[10px] text-gray-500">{status}</span>
    </span>
  )
}

function JiraLink({ issueKey }: { issueKey: string }) {
  if (!issueKey) return <span className="text-gray-300">—</span>
  return (
    <a href={`https://jirasw.nvidia.com/browse/${issueKey}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] hover:underline text-xs flex items-center gap-1">
      {issueKey}
      <ExternalLink className="w-3 h-3 flex-shrink-0" />
    </a>
  )
}

export default function NSpectPage() {
  const [entries, setEntries] = useState<NSpectEntry[]>([])
  const [search, setSearch] = useState('')
  const [lookupId, setLookupId] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [lookupSuccess, setLookupSuccess] = useState('')
  const [showLookup, setShowLookup] = useState(false)
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [manualEntry, setManualEntry] = useState({ nspectId: '', productName: '' })

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mission-control-nspect-v2')
      if (stored) setEntries(JSON.parse(stored))
    } catch {}
  }, [])

  const save = (updated: NSpectEntry[]) => {
    setEntries(updated)
    localStorage.setItem('mission-control-nspect-v2', JSON.stringify(updated))
  }

  const lookupNSpect = async () => {
    const id = lookupId.trim()
    if (!id) return
    setLookupLoading(true)
    setLookupError('')
    setLookupSuccess('')
    try {
      const res = await fetch(`/api/jira/nspect/lookup?nspectId=${encodeURIComponent(id)}`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Lookup failed')
      }
      const data = await res.json()
      if (!data.found) {
        setLookupError(data.message || 'No matching PLC Parent found')
        setLookupLoading(false)
        return
      }

      // Check if already exists
      if (entries.some(e => e.nspectId.toLowerCase() === id.toLowerCase())) {
        setLookupError(`"${id}" already exists in the table`)
        setLookupLoading(false)
        return
      }

      const entry: NSpectEntry = {
        id: crypto.randomUUID(),
        nspectId: id,
        productName: data.parent.summary.replace(/L[01] PLC Parent Task\s*[-–—]?\s*\[?/i, '').replace(/\]?\s*$/, '').trim() || id,
        parentKey: data.parent.key,
        securityEngineer: data.parent.assignee || '',
        osrb: data.osrb ? { key: data.osrb.key, status: data.osrb.status, link: data.osrb.link || '' } : emptyCategory(),
        exportCompliance: data.exportCompliance ? { key: data.exportCompliance.key, status: data.exportCompliance.status, link: data.exportCompliance.link || '' } : emptyCategory(),
        legal: data.legal ? { key: data.legal.key, status: data.legal.status, link: data.legal.link || '' } : emptyCategory(),
        notes: '',
      }

      save([entry, ...entries])
      setLookupSuccess(`Added "${entry.productName}" from ${data.parent.key}`)
      setLookupId('')
    } catch (e: any) {
      setLookupError(e.message || 'Lookup failed')
    }
    setLookupLoading(false)
  }

  const addManual = () => {
    if (!manualEntry.nspectId.trim() && !manualEntry.productName.trim()) return
    const entry: NSpectEntry = {
      id: crypto.randomUUID(),
      nspectId: manualEntry.nspectId.trim(),
      productName: manualEntry.productName.trim(),
      parentKey: '',
      securityEngineer: '',
      osrb: emptyCategory(),
      exportCompliance: emptyCategory(),
      legal: emptyCategory(),
      notes: '',
    }
    save([entry, ...entries])
    setManualEntry({ nspectId: '', productName: '' })
    setShowManualAdd(false)
  }

  const updateEntry = (id: string, updates: Partial<NSpectEntry>) => {
    save(entries.map(e => e.id === id ? { ...e, ...updates } : e))
  }

  const updateCategory = (id: string, category: 'osrb' | 'exportCompliance' | 'legal', field: string, value: string) => {
    save(entries.map(e => {
      if (e.id !== id) return e
      return { ...e, [category]: { ...e[category], [field]: value } }
    }))
  }

  const deleteEntry = (id: string) => {
    if (!confirm('Delete this entry?')) return
    save(entries.filter(e => e.id !== id))
  }

  const refreshEntry = async (entry: NSpectEntry) => {
    if (!entry.nspectId) return
    try {
      const res = await fetch(`/api/jira/nspect/lookup?nspectId=${encodeURIComponent(entry.nspectId)}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (!data.found) return

      const updates: Partial<NSpectEntry> = {
        parentKey: data.parent.key,
        securityEngineer: data.parent.assignee || entry.securityEngineer,
      }
      if (data.osrb) updates.osrb = { key: data.osrb.key, status: data.osrb.status, link: data.osrb.link || entry.osrb.link }
      if (data.exportCompliance) updates.exportCompliance = { key: data.exportCompliance.key, status: data.exportCompliance.status, link: data.exportCompliance.link || entry.exportCompliance.link }
      if (data.legal) updates.legal = { key: data.legal.key, status: data.legal.status, link: data.legal.link || entry.legal.link }

      updateEntry(entry.id, updates)
    } catch {}
  }

  // Filter
  const filtered = entries.filter(e => {
    if (!search) return true
    const s = search.toLowerCase()
    return e.nspectId.toLowerCase().includes(s) ||
      e.productName.toLowerCase().includes(s) ||
      e.securityEngineer.toLowerCase().includes(s) ||
      e.parentKey.toLowerCase().includes(s) ||
      e.notes.toLowerCase().includes(s)
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#76B900]" />
            nSpect Tracker
          </h1>
          <p className="text-gray-500 text-sm mt-1">PLC compliance tracking — OSRB, Export, Legal</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowLookup(!showLookup); setShowManualAdd(false) }} className="px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] transition flex items-center gap-2">
            <Download className="w-4 h-4" /> Import by nSpect ID
          </button>
          <button onClick={() => { setShowManualAdd(!showManualAdd); setShowLookup(false) }} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Manual
          </button>
        </div>
      </div>

      {/* Lookup Panel */}
      {showLookup && (
        <div className="mb-4 p-4 bg-[#76B900]/5 rounded-xl border border-[#76B900]/20">
          <p className="text-sm text-gray-700 mb-2 font-medium">Look up by nSpect ID</p>
          <p className="text-xs text-gray-500 mb-3">Enter an nSpect ID (e.g. NSPECT-B372-3HK0). I'll find the PLC Parent ticket and pull OSRB, Export Compliance, and Legal data from its children.</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={lookupId}
              onChange={e => setLookupId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupNSpect()}
              placeholder="NSPECT-XXXX-XXXX"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30"
            />
            <button onClick={lookupNSpect} disabled={lookupLoading} className="px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] disabled:opacity-50 transition flex items-center gap-2">
              {lookupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {lookupLoading ? 'Looking up...' : 'Look Up'}
            </button>
          </div>
          {lookupError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{lookupError}</p>}
          {lookupSuccess && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{lookupSuccess}</p>}
        </div>
      )}

      {/* Manual Add */}
      {showManualAdd && (
        <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <input type="text" value={manualEntry.nspectId} onChange={e => setManualEntry(p => ({ ...p, nspectId: e.target.value }))} placeholder="nSpect ID..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <input type="text" value={manualEntry.productName} onChange={e => setManualEntry(p => ({ ...p, productName: e.target.value }))} placeholder="Product Name..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <button onClick={addManual} className="px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] transition">Add</button>
            <button onClick={() => setShowManualAdd(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search entries..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{entries.length === 0 ? 'No entries yet. Import by nSpect ID or add manually.' : 'No matching entries.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">nSpect ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product / Service</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">PLC Parent</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Security Eng</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">OSRB</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Export Compliance</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Legal</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                <th className="w-16 px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-3 py-3 text-sm font-mono text-gray-900 font-medium whitespace-nowrap">
                    {entry.nspectId || '—'}
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.productName} onChange={e => updateEntry(entry.id, { productName: e.target.value })} className="w-full bg-transparent text-sm text-gray-800 border-0 p-0 focus:outline-none min-w-[140px]" placeholder="—" />
                  </td>
                  <td className="px-3 py-3">
                    <JiraLink issueKey={entry.parentKey} />
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.securityEngineer} onChange={e => updateEntry(entry.id, { securityEngineer: e.target.value })} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none min-w-[100px]" placeholder="—" />
                  </td>
                  {/* OSRB */}
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <JiraLink issueKey={entry.osrb.key} />
                      <StatusDot status={entry.osrb.status} />
                      {entry.osrb.link ? <LinkDisplay url={entry.osrb.link} /> : (
                        <input type="text" value="" onChange={e => updateCategory(entry.id, 'osrb', 'link', e.target.value)} className="w-full bg-transparent text-[10px] text-gray-400 border-0 p-0 focus:outline-none" placeholder="Add link..." />
                      )}
                    </div>
                  </td>
                  {/* Export Compliance */}
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <JiraLink issueKey={entry.exportCompliance.key} />
                      <StatusDot status={entry.exportCompliance.status} />
                      {entry.exportCompliance.link ? <LinkDisplay url={entry.exportCompliance.link} /> : (
                        <input type="text" value="" onChange={e => updateCategory(entry.id, 'exportCompliance', 'link', e.target.value)} className="w-full bg-transparent text-[10px] text-gray-400 border-0 p-0 focus:outline-none" placeholder="Add link..." />
                      )}
                    </div>
                  </td>
                  {/* Legal */}
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <JiraLink issueKey={entry.legal.key} />
                      <StatusDot status={entry.legal.status} />
                      {entry.legal.link ? <LinkDisplay url={entry.legal.link} /> : (
                        <input type="text" value="" onChange={e => updateCategory(entry.id, 'legal', 'link', e.target.value)} className="w-full bg-transparent text-[10px] text-gray-400 border-0 p-0 focus:outline-none" placeholder="Add link..." />
                      )}
                    </div>
                  </td>
                  {/* Notes */}
                  <td className="px-3 py-3">
                    <input type="text" value={entry.notes} onChange={e => updateEntry(entry.id, { notes: e.target.value })} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none min-w-[100px]" placeholder="Add notes..." />
                  </td>
                  {/* Actions */}
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => refreshEntry(entry)} title="Refresh from Jira" className="text-gray-300 hover:text-[#76B900] transition"><RefreshCw className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteEntry(entry.id)} title="Delete" className="text-gray-300 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400">
        {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
        {entries.length > 0 && <span className="ml-3">• Data stored locally in browser</span>}
      </div>
    </div>
  )
}
