import { useState, useEffect } from 'react'
import { Shield, Plus, Trash2, Search, ExternalLink, Download, RefreshCw, AlertCircle, CheckCircle, Copy, Lock, Unlock, Undo2 } from 'lucide-react'

interface NSpectEntry {
  id: string
  nspectId: string
  nspectLink: string
  productName: string
  parentKey: string
  securityEngineer: string
  osrbTicket: string
  exportCompliance: string
  legalLink: string
  platforms: string
  notes: string
  locked: boolean
  eng: string
  fixVersion: string
  lastUpdated: string
}

function MultiLinkDisplay({ value, type }: { value: string; type: 'nvbugs' | 'nspect' | 'jira' }) {
  if (!value) return <span className="text-gray-300">—</span>
  const items = value.split(',').map(s => s.trim()).filter(Boolean)
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => {
        let url = item
        let display = item
        if (type === 'nvbugs') {
          // item is a numeric ID or a full URL
          const idMatch = item.match(/(\d+)/)
          const id = idMatch ? idMatch[1] : item
          url = `https://nvbugspro.nvidia.com/bug/${id}`
          display = id
        } else if (type === 'nspect') {
          // item is a full URL - shorten it
          url = item
          const match = item.match(/\/(\d+)(?:\/|$)/)
          if (match) {
            display = match[1]
          } else {
            const parts = item.split('/').filter(Boolean)
            display = parts[parts.length - 1] || item
            if (display.length > 20) display = display.slice(0, 20) + '…'
          }
        } else if (type === 'jira') {
          url = `https://jirasw.nvidia.com/browse/${item}`
          display = item
        }
        return (
          <a key={`${item}-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="text-[#76B900] hover:underline text-xs inline-flex items-center gap-0.5 whitespace-nowrap">
            {display}
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        )
      })}
    </div>
  )
}

function NSpectIdLink({ nspectId, nspectLink }: { nspectId: string; nspectLink: string }) {
  if (!nspectId) return <span className="text-sm font-mono text-gray-400">—</span>
  const url = nspectLink || `https://nspect.nvidia.com/registrations?search=${encodeURIComponent(nspectId)}`
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-[#76B900] font-medium hover:underline inline-flex items-center gap-1">
      {nspectId}
      <ExternalLink className="w-3 h-3 flex-shrink-0" />
    </a>
  )
}

// Seed data from OneNote export
const SEED_DATA: Omit<NSpectEntry, 'id'>[] = [
  { nspectId: "NSPECT-SRJE-WI5W", nspectLink: "https://nspect.nvidia.com/registration/programs/3395/versions", productName: "DDCS (Derived Data Cache)", parentKey: "", securityEngineer: "", osrbTicket: "3840915", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/962", platforms: "OVonSM, OVonDGXC", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-A23X-PJ7A", nspectLink: "https://nspect.nvidia.com/registration/programs/2497/versions", productName: "Hub", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "OVonDGXC, Kit", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-1P7O-W8EM", nspectLink: "https://nspect.nvidia.com/registration/programs/12879/versions", productName: "UCC (USD Content Cache)", parentKey: "", securityEngineer: "", osrbTicket: "5357552", exportCompliance: "", legalLink: "", platforms: "OVonSM, OVonDGXC", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-PVEZ-MYOX", nspectLink: "https://nspect.nvidia.com/registration/programs/350/versions", productName: "Client Library", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "Kit, OV RTX", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-Z3RU-SUEX", nspectLink: "https://nspect.nvidia.com/registration/programs?id=NSPECT-Z3RU-SUEX", productName: "Storage APIs - Agent Skills", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/943", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-XQPV-EDBQ", nspectLink: "https://nspect.nvidia.com/registration/programs/16176/versions", productName: "Simple NGINX (Discovery Service)", parentKey: "", securityEngineer: "", osrbTicket: "5610168", exportCompliance: "5634762", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/934", platforms: "OVonSM, OVonDGXC", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-5TC5-EP0X", nspectLink: "https://nspect.nvidia.com/registration/programs/17074/versions", productName: "Storage API Discovery Service (helm)", parentKey: "", securityEngineer: "", osrbTicket: "5610168", exportCompliance: "5729334", legalLink: "", platforms: "OVonSM, OVonDGXC", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-XV4E-WJW4", nspectLink: "https://nspect.nvidia.com/registration/programs/12710/versions", productName: "USD Storage APIs Envoy Auth Extension", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/935", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-KETX-8HHI", nspectLink: "https://nspect.nvidia.com/registration/programs/16960/versions", productName: "Storage API Validation Tests", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/937", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-E5HZ-J3CI", nspectLink: "https://nspect.nvidia.com/registration/programs/12733/versions", productName: "Storage APIs - Navigator", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/936", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-36VS-TCJ8", nspectLink: "https://nspect.nvidia.com/registration/programs/15336/versions", productName: "USD Storage APIs Notification Service", parentKey: "", securityEngineer: "", osrbTicket: "5586001", exportCompliance: "5552542", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/933", platforms: "OVonSM, OVonDGXC", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-GIH7-9JFJ", nspectLink: "https://nspect.nvidia.com/registration/programs/16643", productName: "Storage APIs - Notifications API (proto)", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/939", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-2PGM-AE57", nspectLink: "https://nspect.nvidia.com/registration/programs/15256/versions", productName: "USD Storage Permission Panel UI", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-B372-3HK0", nspectLink: "https://nspect.nvidia.com/registration/programs/12729/versions", productName: "USD Storage APIs Permission Service", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-JSIR-HO21", nspectLink: "https://nspect.nvidia.com/registration/programs/16642", productName: "Storage APIs - Permissions API (proto)", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/940", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-RYHK-7TPB", nspectLink: "https://nspect.nvidia.com/registration/programs/15237/versions", productName: "USD Storage APIs Permission UI", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-YN8F-3UY0", nspectLink: "https://nspect.nvidia.com/registration/programs/17879/versions", productName: "Storage APIs - Smoke Test", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "OVonSM, OVonDGXC", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-0IP1-TKSQ", nspectLink: "https://nspect.nvidia.com/registration/programs/20547", productName: "OneDrive Storage Adapter", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-1RHM-CABY", nspectLink: "https://nspect.nvidia.com/registration/programs/16076/versions", productName: "USD Storage APIs Storage Service", parentKey: "", securityEngineer: "", osrbTicket: "5621446", exportCompliance: "5589221", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/932", platforms: "OVonSM, OVonDGXC", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-G2B8-GZ2M", nspectLink: "https://nspect.nvidia.com/registration/programs/8376", productName: "Storage APIs - Storage Service API (proto)", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "https://nspect.nvidia.com/actions/compliance/legal/software/938", platforms: "OVonSM, OVonDGXC", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-EJQD-OLPS", nspectLink: "https://nspect.nvidia.com/registration/programs/20472/versions", productName: "OV.Libraries - ovstorage", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "NSPECT-Y7PS-6K4L", nspectLink: "https://nspect.nvidia.com/registration/programs?id=NSPECT-Y7PS-6K4L", productName: "WRAPP", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "", nspectLink: "", productName: "OKAS (Kit App Streaming)", parentKey: "", securityEngineer: "", osrbTicket: "multiple (4860797-4860816)", exportCompliance: "5717426", legalLink: "", platforms: "OVonSM, OVonDGXC", notes: "", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
  { nspectId: "", nspectLink: "", productName: "Live Edit (pending)", parentKey: "", securityEngineer: "", osrbTicket: "", exportCompliance: "", legalLink: "", platforms: "", notes: "Pending nSpect registration", locked: false, eng: "", fixVersion: "", lastUpdated: "" },
]

const STORAGE_KEY = 'mission-control-nspect-v5'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
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
  const [undoStack, setUndoStack] = useState<NSpectEntry[][]>([])
  const [saveFlash, setSaveFlash] = useState(false)

  // Load from localStorage, seed if empty
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Migrate: add new fields if missing
        setEntries(parsed.map((e: any) => ({
          ...e,
          locked: e.locked ?? false,
          eng: e.eng ?? '',
          fixVersion: e.fixVersion ?? '',
          lastUpdated: e.lastUpdated ?? '',
        })))
      } else {
        const seeded = SEED_DATA.map(s => ({ ...s, id: crypto.randomUUID() }))
        setEntries(seeded)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
      }
    } catch {}
  }, [])

  const save = (updated: NSpectEntry[], pushUndo = true) => {
    if (pushUndo && entries.length > 0) {
      setUndoStack(prev => [...prev.slice(-19), entries])
    }
    setEntries(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 1500)
  }

  const undo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(s => s.slice(0, -1))
    setEntries(prev)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prev))
  }

  const cloneEntry = (entry: NSpectEntry) => {
    const clone: NSpectEntry = {
      ...entry,
      id: crypto.randomUUID(),
      notes: entry.notes ? `(cloned) ${entry.notes}` : '(cloned)',
      lastUpdated: todayStr(),
    }
    const idx = entries.findIndex(e => e.id === entry.id)
    const updated = [...entries]
    updated.splice(idx + 1, 0, clone)
    save(updated)
  }

  const toggleLock = (id: string) => {
    save(entries.map(e => e.id === id ? { ...e, locked: !e.locked } : e))
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

      const fixVersionStr = (data.parent.fixVersions || []).join(', ')
      const today = todayStr()

      const existing = entries.find(e => e.nspectId.toLowerCase() === id.toLowerCase())
      if (existing) {
        if (existing.locked) {
          // Clone instead of edit
          const clone: NSpectEntry = {
            ...existing,
            id: crypto.randomUUID(),
            parentKey: data.parent.key,
            securityEngineer: data.parent.assignee || existing.securityEngineer,
            osrbTicket: data.osrb?.link?.match(/\d+$/)?.[0] || existing.osrbTicket,
            exportCompliance: data.exportCompliance?.link?.match(/\d+$/)?.[0] || existing.exportCompliance,
            legalLink: data.legal?.link || existing.legalLink,
            fixVersion: fixVersionStr || existing.fixVersion,
            notes: `Updated ${today}`,
            locked: false,
            lastUpdated: today,
          }
          const idx = entries.findIndex(e => e.id === existing.id)
          const updated = [...entries]
          updated.splice(idx + 1, 0, clone)
          save(updated)
          setLookupSuccess(`Cloned "${existing.productName}" (locked row) — new version added below`)
        } else {
          // Update in place
          const updates: Partial<NSpectEntry> = {
            parentKey: data.parent.key,
            securityEngineer: data.parent.assignee || existing.securityEngineer,
            fixVersion: fixVersionStr || existing.fixVersion,
            lastUpdated: today,
          }
          if (data.osrb) updates.osrbTicket = data.osrb.link?.match(/\d+$/)?.[0] || existing.osrbTicket
          if (data.exportCompliance) updates.exportCompliance = data.exportCompliance.link?.match(/\d+$/)?.[0] || existing.exportCompliance
          if (data.legal) updates.legalLink = data.legal.link || existing.legalLink
          save(entries.map(e => e.id === existing.id ? { ...e, ...updates } : e))
          setLookupSuccess(`Updated "${existing.productName}" from ${data.parent.key}`)
        }
      } else {
        const entry: NSpectEntry = {
          id: crypto.randomUUID(),
          nspectId: id,
          nspectLink: '',
          productName: data.parent.summary.replace(/L[01] PLC Parent Task\s*[-–—]?\s*\[?/i, '').replace(/\]?\s*$/, '').trim() || id,
          parentKey: data.parent.key,
          securityEngineer: data.parent.assignee || '',
          osrbTicket: data.osrb?.link?.match(/\d+$/)?.[0] || '',
          exportCompliance: data.exportCompliance?.link?.match(/\d+$/)?.[0] || '',
          legalLink: data.legal?.link || '',
          platforms: '',
          notes: '',
          locked: false,
          eng: '',
          fixVersion: fixVersionStr,
          lastUpdated: today,
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
      nspectLink: '',
      productName: manualEntry.productName.trim(),
      parentKey: '',
      securityEngineer: '',
      osrbTicket: '',
      exportCompliance: '',
      legalLink: '',
      platforms: '',
      notes: '',
      locked: false,
      eng: '',
      fixVersion: '',
      lastUpdated: todayStr(),
    }
    save([entry, ...entries])
    setManualEntry({ nspectId: '', productName: '' })
    setShowManualAdd(false)
  }

  const updateEntry = (id: string, field: keyof NSpectEntry, value: string) => {
    save(entries.map(e => e.id === id ? { ...e, [field]: value, lastUpdated: todayStr() } : e))
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
      e.eng.toLowerCase().includes(s) ||
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
        <div className="flex gap-2 items-center">
          {saveFlash && (
            <span className="text-xs text-green-600 flex items-center gap-1 animate-pulse">
              <CheckCircle className="w-3 h-3" /> Saved
            </span>
          )}
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Undo last change"
            className="px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1"
          >
            <Undo2 className="w-4 h-4" /> Undo
          </button>
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
          <p className="text-xs text-gray-500 mb-3">Enter an nSpect ID. If the row is 🔒 locked, it will clone instead of overwriting. Otherwise it updates in place.</p>
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
            placeholder="Search by name, nSpect ID, platform, engineer..."
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
          <table className="w-full text-left table-auto">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">nSpect ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component / Service</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">PLC Parent</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Security Eng</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eng</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">OSRB</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Export</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Legal</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fix Version</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platforms</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.id} className={`border-b border-gray-100 hover:bg-gray-50 transition ${entry.locked ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-3 py-3 align-top" style={{ wordBreak: 'break-word' }}>
                    <NSpectIdLink nspectId={entry.nspectId} nspectLink={entry.nspectLink} />
                  </td>
                  <td className="px-3 py-3 align-top" style={{ wordBreak: 'break-word' }}>
                    <input type="text" value={entry.productName} onChange={e => updateEntry(entry.id, 'productName', e.target.value)} className="w-full bg-transparent text-sm text-gray-800 border-0 p-0 focus:outline-none" style={{ wordBreak: 'break-word' }} placeholder="—" />
                  </td>
                  <td className="px-3 py-3 align-top" style={{ wordBreak: 'break-word' }}>
                    {entry.parentKey ? (
                      <a href={`https://jirasw.nvidia.com/browse/${entry.parentKey}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] hover:underline text-xs inline-flex items-center gap-1">
                        {entry.parentKey}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <input type="text" value="" onChange={e => updateEntry(entry.id, 'parentKey', e.target.value)} className="w-full bg-transparent text-xs text-gray-400 border-0 p-0 focus:outline-none" placeholder="OMPE-..." />
                    )}
                  </td>
                  <td className="px-3 py-3 align-top" style={{ wordBreak: 'break-word' }}>
                    <input type="text" value={entry.securityEngineer} onChange={e => updateEntry(entry.id, 'securityEngineer', e.target.value)} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none" style={{ wordBreak: 'break-word' }} placeholder="—" />
                  </td>
                  <td className="px-3 py-3 align-top" style={{ wordBreak: 'break-word' }}>
                    <input type="text" value={entry.eng} onChange={e => updateEntry(entry.id, 'eng', e.target.value)} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none" style={{ wordBreak: 'break-word' }} placeholder="—" />
                  </td>
                  <td className="px-3 py-3 align-top" style={{ wordBreak: 'break-word' }}>
                    {entry.osrbTicket ? (
                      <MultiLinkDisplay value={entry.osrbTicket} type="nvbugs" />
                    ) : (
                      <input type="text" value="" onChange={e => updateEntry(entry.id, 'osrbTicket', e.target.value)} className="w-full bg-transparent text-xs text-gray-400 border-0 p-0 focus:outline-none" placeholder="—" />
                    )}
                  </td>
                  <td className="px-3 py-3 align-top" style={{ wordBreak: 'break-word' }}>
                    {entry.exportCompliance ? (
                      <MultiLinkDisplay value={entry.exportCompliance} type="nvbugs" />
                    ) : (
                      <input type="text" value="" onChange={e => updateEntry(entry.id, 'exportCompliance', e.target.value)} className="w-full bg-transparent text-xs text-gray-400 border-0 p-0 focus:outline-none" placeholder="—" />
                    )}
                  </td>
                  <td className="px-3 py-3 align-top" style={{ wordBreak: 'break-word' }}>
                    {entry.legalLink ? (
                      <MultiLinkDisplay value={entry.legalLink} type="nspect" />
                    ) : (
                      <input type="text" value="" onChange={e => updateEntry(entry.id, 'legalLink', e.target.value)} className="w-full bg-transparent text-xs text-gray-400 border-0 p-0 focus:outline-none" placeholder="—" />
                    )}
                  </td>
                  <td className="px-3 py-3 align-top" style={{ wordBreak: 'break-word' }}>
                    <span className="text-xs text-gray-600">{entry.fixVersion || '—'}</span>
                  </td>
                  <td className="px-3 py-3 align-top" style={{ wordBreak: 'break-word' }}>
                    <input type="text" value={entry.platforms} onChange={e => updateEntry(entry.id, 'platforms', e.target.value)} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none" style={{ wordBreak: 'break-word' }} placeholder="—" />
                  </td>
                  <td className="px-3 py-3 align-top" style={{ wordBreak: 'break-word' }}>
                    <input type="text" value={entry.notes} onChange={e => updateEntry(entry.id, 'notes', e.target.value)} className="w-full bg-transparent text-xs text-gray-600 border-0 p-0 focus:outline-none" style={{ wordBreak: 'break-word' }} placeholder="—" />
                  </td>
                  <td className="px-3 py-3 align-top whitespace-nowrap">
                    <span className="text-xs text-gray-400">{entry.lastUpdated || '—'}</span>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleLock(entry.id)} title={entry.locked ? 'Unlock (edits will overwrite)' : 'Lock (updates will clone)'} className={`transition ${entry.locked ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-gray-500'}`}>
                        {entry.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => cloneEntry(entry)} title="Clone row" className="text-gray-300 hover:text-blue-500 transition">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteEntry(entry.id)} title="Delete" className="text-gray-300 hover:text-red-400 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>
          {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
          {entries.filter(e => e.locked).length > 0 && <span className="ml-2">• {entries.filter(e => e.locked).length} locked</span>}
        </span>
        <span>Auto-saves to browser • {undoStack.length} undo step{undoStack.length !== 1 ? 's' : ''} available</span>
      </div>
    </div>
  )
}
