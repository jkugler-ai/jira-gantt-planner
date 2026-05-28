import { useState, useEffect } from 'react'
import { Shield, Plus, Trash2, Search, ExternalLink, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'

interface NSpectEntry {
  id: string
  nspectId: string
  productName: string
  parentKey: string
  securityEngineer: string
  osrbTicket: string
  exportCompliance: string
  legalLink: string
  platforms: string
  notes: string
}

function LinkDisplay({ url, label }: { url: string; label?: string }) {
  if (!url) return <span className="text-gray-300">—</span>
  let display = label || url
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

function NvbugsLink({ ticketId }: { ticketId: string }) {
  if (!ticketId) return <span className="text-gray-300">—</span>
  // Handle "multiple (range)" case
  if (ticketId.includes('multiple')) {
    return <span className="text-xs text-gray-500">{ticketId}</span>
  }
  // Could be comma-separated
  const ids = ticketId.split(',').map(s => s.trim()).filter(Boolean)
  return (
    <div className="space-y-0.5">
      {ids.map(id => (
        <a key={id} href={`https://nvbugspro.nvidia.com/bug/${id}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] hover:underline text-xs flex items-center gap-1">
          {id}
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      ))}
    </div>
  )
}

function NSpectIdLink({ nspectId }: { nspectId: string }) {
  if (!nspectId || nspectId === 'OKAS') return <span className="text-sm font-mono text-gray-900 font-medium">{nspectId || '—'}</span>
  // Link to nspect.nvidia.com search/registration
  const url = `https://nspect.nvidia.com/registrations?search=${encodeURIComponent(nspectId)}`
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-[#76B900] font-medium hover:underline flex items-center gap-1 whitespace-nowrap">
      {nspectId}
      <ExternalLink className="w-3 h-3 flex-shrink-0" />
    </a>
  )
}

// Seed data from OneNote export
const SEED_DATA: Omit<NSpectEntry, 'id'>[] = [
  { nspectId: "NSPECT-SRJE-WI5W", productName: "DDCS (Derived Data Cache)", parentKey: "", securityEngineer: "", osrbTicket: "3840915", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/962", platforms: "OVonSM, OVonDGXC", notes: "" },
  { nspectId: "NSPECT-A23X-PJ7A", productName: "Hub", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "OVonDGXC, Kit", notes: "" },
  { nspectId: "NSPECT-1P7O-W8EM", productName: "UCC (USD Content Cache)", parentKey: "", securityEngineer: "", osrbTicket: "5357552", exportCompliance: "", legalLink: "", platforms: "OVonSM, OVonDGXC", notes: "" },
  { nspectId: "NSPECT-PVEZ-MYOX", productName: "Client Library", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "Kit, OV RTX", notes: "" },
  { nspectId: "NSPECT-Z3RU-SUEX", productName: "Storage APIs - Agent Skills", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/943", platforms: "", notes: "" },
  { nspectId: "NSPECT-XQPV-EDBQ", productName: "Simple NGINX (Discovery Service)", parentKey: "", securityEngineer: "", osrbTicket: "5610168", exportCompliance: "5634762", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/934", platforms: "OVonSM, OVonDGXC", notes: "" },
  { nspectId: "NSPECT-5TC5-EP0X", productName: "Storage API Discovery Service (helm)", parentKey: "", securityEngineer: "", osrbTicket: "5610168", exportCompliance: "5729334", legalLink: "", platforms: "OVonSM, OVonDGXC", notes: "" },
  { nspectId: "NSPECT-XV4E-WJW4", productName: "USD Storage APIs Envoy Auth Extension", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/935", platforms: "", notes: "" },
  { nspectId: "NSPECT-KETX-8HHI", productName: "Storage API Validation Tests", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/937", platforms: "", notes: "" },
  { nspectId: "NSPECT-E5HZ-J3CI", productName: "Storage APIs - Navigator", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/936", platforms: "", notes: "" },
  { nspectId: "NSPECT-36VS-TCJ8", productName: "USD Storage APIs Notification Service", parentKey: "", securityEngineer: "", osrbTicket: "5586001", exportCompliance: "5552542", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/933", platforms: "OVonSM, OVonDGXC", notes: "" },
  { nspectId: "NSPECT-GIH7-9JFJ", productName: "Storage APIs - Notifications API (proto)", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/939", platforms: "", notes: "" },
  { nspectId: "NSPECT-2PGM-AE57", productName: "USD Storage Permission Panel UI", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "" },
  { nspectId: "NSPECT-B372-3HK0", productName: "USD Storage APIs Permission Service", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "" },
  { nspectId: "NSPECT-JSIR-HO21", productName: "Storage APIs - Permissions API (proto)", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/940", platforms: "", notes: "" },
  { nspectId: "NSPECT-RYHK-7TPB", productName: "USD Storage APIs Permission UI", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "" },
  { nspectId: "NSPECT-YN8F-3UY0", productName: "Storage APIs - Smoke Test", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "OVonSM, OVonDGXC", notes: "" },
  { nspectId: "NSPECT-0IP1-TKSQ", productName: "OneDrive Storage Adapter", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "" },
  { nspectId: "NSPECT-1RHM-CABY", productName: "USD Storage APIs Storage Service", parentKey: "", securityEngineer: "", osrbTicket: "5621446", exportCompliance: "5589221", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/932", platforms: "OVonSM, OVonDGXC", notes: "" },
  { nspectId: "NSPECT-G2B8-GZ2M", productName: "Storage APIs - Storage Service API (proto)", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/938", platforms: "OVonSM, OVonDGXC", notes: "" },
  { nspectId: "NSPECT-EJQD-OLPS", productName: "OV.Libraries - ovstorage", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "" },
  { nspectId: "NSPECT-Y7PS-6K4L", productName: "WRAPP", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "" },
  { nspectId: "", productName: "OKAS (Kit App Streaming)", parentKey: "", securityEngineer: "", osrbTicket: "multiple (4860797-4860816)", exportCompliance: "5717426", legalLink: "", platforms: "OVonSM, OVonDGXC", notes: "" },
  { nspectId: "", productName: "Live Edit (pending)", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "Pending nSpect registration" },
]

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

  // Load from localStorage, seed if empty
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mission-control-nspect-v3')
      if (stored) {
        setEntries(JSON.parse(stored))
      } else {
        // First load: seed with data from OneNote export
        const seeded = SEED_DATA.map(s => ({ ...s, id: crypto.randomUUID() }))
        setEntries(seeded)
        localStorage.setItem('mission-control-nspect-v3', JSON.stringify(seeded))
      }
    } catch {}
  }, [])

  const save = (updated: NSpectEntry[]) => {
    setEntries(updated)
    localStorage.setItem('mission-control-nspect-v3', JSON.stringify(updated))
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

      // Check if already exists — update it if so
      const existing = entries.find(e => e.nspectId.toLowerCase() === id.toLowerCase())
      if (existing) {
        const updates: Partial<NSpectEntry> = {
          parentKey: data.parent.key,
          securityEngineer: data.parent.assignee || existing.securityEngineer,
        }
        if (data.osrb) updates.osrbTicket = data.osrb.link?.match(/\d+$/)?.[0] || existing.osrbTicket
        if (data.exportCompliance) updates.exportCompliance = data.exportCompliance.link?.match(/\d+$/)?.[0] || existing.exportCompliance
        if (data.legal) updates.legalLink = data.legal.link || existing.legalLink
        save(entries.map(e => e.id === existing.id ? { ...e, ...updates } : e))
        setLookupSuccess(`Updated "${existing.productName}" from ${data.parent.key}`)
      } else {
        const entry: NSpectEntry = {
          id: crypto.randomUUID(),
          nspectId: id,
          productName: data.parent.summary.replace(/L[01] PLC Parent Task\s*[-–—]?\s*\[?/i, '').replace(/\]?\s*$/, '').trim() || id,
          parentKey: data.parent.key,
          securityEngineer: data.parent.assignee || '',
          osrbTicket: data.osrb?.link?.match(/\d+$/)?.[0] || '',
          exportCompliance: data.exportCompliance?.link?.match(/\d+$/)?.[0] || '',
          legalLink: data.legal?.link || '',
          platforms: '',
          notes: '',
        }
        save([entry, ...entries])
        setLookupSuccess(`Added "${entry.productName}" from ${data.parent.key}`)
      }
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
      osrbTicket: '',
      exportCompliance: '',
      legalLink: '',
      platforms: '',
      notes: '',
    }
    save([entry, ...entries])
    setManualEntry({ nspectId: '', productName: '' })
    setShowManualAdd(false)
  }

  const updateEntry = (id: string, field: keyof NSpectEntry, value: string) => {
    save(entries.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  const deleteEntry = (id: string) => {
    if (!confirm('Delete this entry?')) return
    save(entries.filter(e => e.id !== id))
  }

  // Filter
  const filtered = entries.filter(e => {
    if (!search) return true
    const s = search.toLowerCase()
    return e.nspectId.toLowerCase().includes(s) ||
      e.productName.toLowerCase().includes(s) ||
      e.securityEngineer.toLowerCase().includes(s) ||
      e.parentKey.toLowerCase().includes(s) ||
      e.platforms.toLowerCase().includes(s) ||
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
          <p className="text-gray-500 text-sm mt-1">PLC compliance — {entries.length} registrations tracked</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowLookup(!showLookup); setShowManualAdd(false) }} className="px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] transition flex items-center gap-2">
            <Download className="w-4 h-4" /> Import from Jira
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
          <p className="text-xs text-gray-500 mb-3">Enter an nSpect ID. If it already exists in the table, it will update the row with latest Jira data. Otherwise it creates a new entry.</p>
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
          {lookupError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {lookupError}</p>}
          {lookupSuccess && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {lookupSuccess}</p>}
        </div>
      )}

      {/* Manual Add */}
      {showManualAdd && (
        <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <input type="text" value={manualEntry.nspectId} onChange={e => setManualEntry(p => ({ ...p, nspectId: e.target.value }))} placeholder="nSpect ID..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
            <input type="text" value={manualEntry.productName} onChange={e => setManualEntry(p => ({ ...p, productName: e.target.value }))} placeholder="Product/Service Name..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-[#76B900]/30" />
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
            placeholder="Search by name, nSpect ID, platform..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{entries.length === 0 ? 'No entries yet.' : 'No matching entries.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">nSpect ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component / Service</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">PLC Parent</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Security Eng</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">OSRB</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Export Compliance</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Legal</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platforms</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                <th className="w-10 px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-3 py-3">
                    <NSpectIdLink nspectId={entry.nspectId} />
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.productName} onChange={e => updateEntry(entry.id, 'productName', e.target.value)} className="w-full bg-transparent text-sm text-gray-800 border-0 p-0 focus:outline-none min-w-[160px]" placeholder="—" />
                  </td>
                  <td className="px-3 py-3">
                    {entry.parentKey ? (
                      <a href={`https://jirasw.nvidia.com/browse/${entry.parentKey}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] hover:underline text-xs flex items-center gap-1">
                        {entry.parentKey}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.securityEngineer} onChange={e => updateEntry(entry.id, 'securityEngineer', e.target.value)} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none min-w-[90px]" placeholder="—" />
                  </td>
                  <td className="px-3 py-3">
                    {entry.osrbTicket ? (
                      <NvbugsLink ticketId={entry.osrbTicket} />
                    ) : (
                      <input type="text" value="" onChange={e => updateEntry(entry.id, 'osrbTicket', e.target.value)} className="w-full bg-transparent text-xs text-gray-400 border-0 p-0 focus:outline-none" placeholder="—" />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {entry.exportCompliance ? (
                      <NvbugsLink ticketId={entry.exportCompliance} />
                    ) : (
                      <input type="text" value="" onChange={e => updateEntry(entry.id, 'exportCompliance', e.target.value)} className="w-full bg-transparent text-xs text-gray-400 border-0 p-0 focus:outline-none" placeholder="—" />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {entry.legalLink ? (
                      <LinkDisplay url={entry.legalLink} />
                    ) : (
                      <input type="text" value="" onChange={e => updateEntry(entry.id, 'legalLink', e.target.value)} className="w-full bg-transparent text-xs text-gray-400 border-0 p-0 focus:outline-none" placeholder="—" />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.platforms} onChange={e => updateEntry(entry.id, 'platforms', e.target.value)} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none min-w-[80px]" placeholder="—" />
                  </td>
                  <td className="px-3 py-3">
                    <input type="text" value={entry.notes} onChange={e => updateEntry(entry.id, 'notes', e.target.value)} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none min-w-[80px]" placeholder="—" />
                  </td>
                  <td className="px-2 py-3">
                    <button onClick={() => deleteEntry(entry.id)} title="Delete" className="text-gray-300 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400">
        {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
        {entries.length > 0 && <span className="ml-3">• Data stored locally in browser • Use "Import from Jira" to refresh PLC data</span>}
      </div>
    </div>
  )
}
