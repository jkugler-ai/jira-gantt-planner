import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ClipboardList,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Circle,
  Sun,
  Save,
  Search,
  Filter,
  AlertTriangle,
  ChevronUp,
  Play,
  ArrowRight,
  RotateCcw,
  Star,
  X
} from 'lucide-react'
import { useSavedQueries, getDefaultQuery } from '../lib/savedQueries'
import { useDismissed } from '../lib/useDismissed'
import { DismissedPanel } from '../components/DismissControls'

interface JiraTask {
  key: string
  summary: string
  status: string
  statusCategory: string
  priority: string
  type: string
  dueDate: string | null
  updated: string | null
  startDate: string | null
  devTeam: string | null
  assignee: string | null
  programManager: string | null
  statusUpdate: string | null
  notes: string
  completed: boolean
}

interface ManualTask {
  id: string
  title: string
  notes: string
  completed: boolean
  createdAt: string
  dueDate?: string
}

interface FollowUp {
  id: string
  title: string
  source: 'slack' | 'email' | 'other'
  notes: string
  completed: boolean
  assignee: string
  createdDate: string
  dueDate: string
  link: string
}

interface DailyData {
  date: string
  jiraTasks: JiraTask[]
  manualTasks: ManualTask[]
  followUps: FollowUp[]
  overnightSummary: string
  jql: string
  _carriedFrom?: string
}

interface Transition {
  id: string
  name: string
}

interface OvernightChange {
  key: string
  summary: string
  changeType: 'status' | 'new' | 'removed'
  oldValue?: string
  newValue?: string
}

const PAGE_ID = 'daily-tasks'
const DEFAULT_JQL = '(assignee = currentUser() OR cf[12712] = currentUser()) AND statusCategory != Done ORDER BY duedate ASC'

const priorityColors: Record<string, string> = {
  Highest: 'text-red-600',
  High: 'text-orange-500',
  Medium: 'text-yellow-600',
  Low: 'text-blue-500',
  Lowest: 'text-gray-400',
}

const statusColors: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700',
  indeterminate: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

function getToday() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

function getStaleness(updated: string | null): { label: string; color: string; icon: string; days: number } {
  if (!updated) return { label: 'Unknown', color: 'text-gray-400', icon: '❓', days: -1 }
  const days = Math.floor((Date.now() - new Date(updated).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 2) return { label: `${days}d`, color: 'text-green-600', icon: '🟢', days }
  if (days <= 7) return { label: `${days}d`, color: 'text-yellow-600', icon: '🟡', days }
  if (days <= 14) return { label: `${days}d`, color: 'text-orange-600', icon: '🔴', days }
  return { label: `${days}d`, color: 'text-red-700', icon: '💀', days }
}

function getRisk(task: JiraTask): { label: string; color: string; score: number } {
  let score = 0
  const staleness = getStaleness(task.updated)
  if (staleness.days > 14) score += 3
  else if (staleness.days > 7) score += 2
  else if (staleness.days > 3) score += 1

  if (task.dueDate && new Date(task.dueDate) < new Date()) {
    const overdueDays = Math.floor((Date.now() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    if (overdueDays > 7) score += 3
    else if (overdueDays > 3) score += 2
    else score += 1
  }

  if (task.priority === 'Highest') score += 2
  else if (task.priority === 'High') score += 1

  if (!task.statusUpdate) score += 1

  if (score >= 5) return { label: 'Critical', color: 'bg-red-100 text-red-700', score }
  if (score >= 3) return { label: 'At Risk', color: 'bg-orange-100 text-orange-700', score }
  if (score >= 1) return { label: 'Watch', color: 'bg-yellow-100 text-yellow-700', score }
  return { label: 'OK', color: 'bg-green-100 text-green-700', score }
}

type SortField = 'key' | 'priority' | 'status' | 'type' | 'dueDate' | 'updated' | 'risk' | 'staleness' | 'assignee' | 'devTeam'
type SortDir = 'asc' | 'desc'

export default function DailyTasksPage() {
  const [date, setDate] = useState(getToday())
  const [data, setData] = useState<DailyData>({
    date: getToday(),
    jiraTasks: [],
    manualTasks: [],
    followUps: [],
    overnightSummary: '',
    jql: DEFAULT_JQL
  })
  const [loading, setLoading] = useState(false)
  const [jiraLoading, setJiraLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const { dismissed, dismiss, restore, restoreAll } = useDismissed('daily-tasks')
  const [expandedSections, setExpandedSections] = useState({
    overnight: true,
    jira: false,
    followups: true,
    manual: false
  })
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [jqlInput, setJqlInput] = useState(() => getDefaultQuery(PAGE_ID, DEFAULT_JQL))
  const [sortField, setSortField] = useState<SortField>('risk')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [filterDevTeam, setFilterDevTeam] = useState<string>('')
  const [filterAssignee, setFilterAssignee] = useState<string>('')
  
  // Follow-up filters
  const [filterFuAssignee, setFilterFuAssignee] = useState<string>('')
  const [filterFuSource, setFilterFuSource] = useState<string>('')

  // New item inputs
  const [newFollowUp, setNewFollowUp] = useState<{ title: string; source: 'slack' | 'email' | 'other'; assignee: string; dueDate: string; link: string }>({ title: '', source: 'slack', assignee: '', dueDate: '', link: '' })
  
  // Transitions
  const [transitionMenuKey, setTransitionMenuKey] = useState<string | null>(null)
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [transitionLoading, setTransitionLoading] = useState(false)

  // Overnight changes summary
  const [overnightChanges, setOvernightChanges] = useState<OvernightChange[]>([])
  const [lastLoadHoursAgo, setLastLoadHoursAgo] = useState<number | null>(null)

  // Saved queries
  const { queries, save: saveQuery, remove: removeQuery } = useSavedQueries(PAGE_ID)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveQueryName, setSaveQueryName] = useState('')

  // Load daily tasks
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/daily-tasks/${date}`, { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setData(json)
        if (json.jql) setJqlInput(json.jql)
      }
    } catch (err) {
      console.error('Failed to load daily tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-save with debounce
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => {
      saveData()
    }, 1500)
    return () => clearTimeout(timer)
  }, [data, dirty])

  const saveData = async () => {
    setSaving(true)
    try {
      await fetch(`/api/daily-tasks/${date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      })
      setDirty(false)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  // Refresh Jira tasks
  const refreshJira = async (customJql?: string) => {
    setJiraLoading(true)
    const jql = customJql || jqlInput || DEFAULT_JQL
    try {
      const res = await fetch(`/api/daily-tasks/${date}/jira?jql=${encodeURIComponent(jql)}`, { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        const existingMap = new Map(data.jiraTasks.map(t => [t.key, t]))
        const merged = json.tasks.map((task: JiraTask) => {
          const existing = existingMap.get(task.key)
          return {
            ...task,
            notes: existing?.notes || '',
            completed: existing?.completed || false
          }
        })

        // Overnight changes detection
        const lastLoadTimestamp = localStorage.getItem('daily-tasks-last-load')
        const lastSnapshot = localStorage.getItem('daily-tasks-last-snapshot')
        if (lastLoadTimestamp && lastSnapshot) {
          const hoursAgo = Math.round((Date.now() - parseInt(lastLoadTimestamp)) / (1000 * 60 * 60))
          setLastLoadHoursAgo(hoursAgo)
          try {
            const prevTasks: Record<string, { status: string; updated: string | null }> = JSON.parse(lastSnapshot)
            const changes: OvernightChange[] = []
            for (const task of json.tasks) {
              const prev = prevTasks[task.key]
              if (!prev) {
                changes.push({ key: task.key, summary: task.summary, changeType: 'new' })
              } else if (prev.status !== task.status) {
                changes.push({ key: task.key, summary: task.summary, changeType: 'status', oldValue: prev.status, newValue: task.status })
              }
            }
            // Check for removed tickets
            const currentKeys = new Set(json.tasks.map((t: JiraTask) => t.key))
            for (const key of Object.keys(prevTasks)) {
              if (!currentKeys.has(key)) {
                changes.push({ key, summary: key, changeType: 'removed' })
              }
            }
            setOvernightChanges(changes)
          } catch {
            setOvernightChanges([])
          }
        } else {
          setOvernightChanges([])
          setLastLoadHoursAgo(null)
        }

        // Save current snapshot for next comparison
        const snapshot: Record<string, { status: string; updated: string | null }> = {}
        for (const task of json.tasks) {
          snapshot[task.key] = { status: task.status, updated: task.updated }
        }
        localStorage.setItem('daily-tasks-last-load', String(Date.now()))
        localStorage.setItem('daily-tasks-last-snapshot', JSON.stringify(snapshot))

        setData(prev => ({ ...prev, jiraTasks: merged, jql }))
        setDirty(true)
      }
    } catch (err) {
      console.error('Failed to refresh Jira:', err)
    } finally {
      setJiraLoading(false)
    }
  }

  // Saved queries handlers
  function handleSaveQuery(asDefault: boolean) {
    if (!saveQueryName.trim()) return
    saveQuery({ name: saveQueryName.trim(), jql: jqlInput, isDefault: asDefault })
    setShowSaveDialog(false)
    setSaveQueryName('')
  }

  function handleLoadQuery(savedJql: string) {
    setJqlInput(savedJql)
    refreshJira(savedJql)
  }

  // Filter options derived from data
  const filterOptions = useMemo(() => {
    const statuses = new Set<string>()
    const priorities = new Set<string>()
    const devTeams = new Set<string>()
    const assignees = new Set<string>()
    data.jiraTasks.forEach(t => {
      if (t.status) statuses.add(t.status)
      if (t.priority) priorities.add(t.priority)
      if (t.devTeam) devTeams.add(t.devTeam)
      if (t.assignee) assignees.add(t.assignee)
    })
    return {
      statuses: [...statuses].sort(),
      priorities: [...priorities].sort(),
      devTeams: [...devTeams].sort(),
      assignees: [...assignees].sort()
    }
  }, [data.jiraTasks])

  // Filtered and sorted Jira tasks
  const filteredJiraTasks = useMemo(() => {
    let tasks = [...data.jiraTasks]
    // Filter out dismissed
    tasks = tasks.filter(t => !dismissed.includes(t.key))
    if (filterStatus) tasks = tasks.filter(t => t.status === filterStatus)
    if (filterPriority) tasks = tasks.filter(t => t.priority === filterPriority)
    if (filterDevTeam) tasks = tasks.filter(t => t.devTeam === filterDevTeam)
    if (filterAssignee) tasks = tasks.filter(t => t.assignee === filterAssignee)

    tasks.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'key': cmp = a.key.localeCompare(b.key); break
        case 'priority': {
          const order = ['Highest', 'High', 'Medium', 'Low', 'Lowest']
          cmp = order.indexOf(a.priority || 'Medium') - order.indexOf(b.priority || 'Medium')
          break
        }
        case 'status': cmp = (a.status || '').localeCompare(b.status || ''); break
        case 'type': cmp = (a.type || '').localeCompare(b.type || ''); break
        case 'dueDate': {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
          cmp = da - db
          break
        }
        case 'updated': {
          const ua = a.updated ? new Date(a.updated).getTime() : 0
          const ub = b.updated ? new Date(b.updated).getTime() : 0
          cmp = ua - ub
          break
        }
        case 'staleness': cmp = getStaleness(a.updated).days - getStaleness(b.updated).days; break
        case 'risk': cmp = getRisk(a).score - getRisk(b).score; break
        case 'assignee': cmp = (a.assignee || '').localeCompare(b.assignee || ''); break
        case 'devTeam': cmp = (a.devTeam || '').localeCompare(b.devTeam || ''); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return tasks
  }, [data.jiraTasks, filterStatus, filterPriority, filterDevTeam, filterAssignee, sortField, sortDir, dismissed])

  // Update helpers
  const updateJiraTask = (key: string, updates: Partial<JiraTask>) => {
    setData(prev => ({
      ...prev,
      jiraTasks: prev.jiraTasks.map(t => t.key === key ? { ...t, ...updates } : t)
    }))
    setDirty(true)
  }

  const openTransitions = async (key: string) => {
    if (transitionMenuKey === key) { setTransitionMenuKey(null); return }
    setTransitionMenuKey(key)
    setTransitionLoading(true)
    try {
      const res = await fetch(`/api/daily-tasks/transitions/${key}`, { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setTransitions(json.transitions || [])
      }
    } catch (err) {
      console.error('Failed to fetch transitions:', err)
    } finally {
      setTransitionLoading(false)
    }
  }

  const doTransition = async (key: string, transitionId: string, transitionName: string) => {
    try {
      const res = await fetch(`/api/daily-tasks/transitions/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transitionId })
      })
      if (res.ok) {
        updateJiraTask(key, { status: transitionName, statusCategory: 'indeterminate' })
        setTransitionMenuKey(null)
      }
    } catch (err) {
      console.error('Failed to transition:', err)
    }
  }

  const removeJiraTask = (key: string) => {
    setData(prev => ({ ...prev, jiraTasks: prev.jiraTasks.filter(t => t.key !== key) }))
    setDirty(true)
  }

  const updateFollowUp = (id: string, updates: Partial<FollowUp>) => {
    setData(prev => ({ ...prev, followUps: prev.followUps.map(f => f.id === id ? { ...f, ...updates } : f) }))
    setDirty(true)
  }

  const addFollowUp = () => {
    if (!newFollowUp.title.trim()) return
    setData(prev => ({ ...prev, followUps: [...prev.followUps, { id: crypto.randomUUID(), title: newFollowUp.title.trim(), source: newFollowUp.source, notes: '', completed: false, assignee: newFollowUp.assignee, createdDate: getToday(), dueDate: newFollowUp.dueDate, link: newFollowUp.link }] }))
    setNewFollowUp({ title: '', source: 'slack', assignee: '', dueDate: '', link: '' })
    setDirty(true)
  }


  const deleteFollowUp = (id: string) => {
    setData(prev => ({ ...prev, followUps: prev.followUps.filter(f => f.id !== id) }))
    setDirty(true)
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const toggleNotes = (key: string) => {
    setExpandedNotes(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  // Progress stats
  const totalTasks = data.jiraTasks.length + data.followUps.length
  const completedTasks = data.jiraTasks.filter(t => t.completed).length + data.followUps.filter(f => f.completed).length
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-[#76B900]" />
            <h1 className="text-2xl font-bold text-gray-900">Daily Tasks</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Your personal daily command center</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-gray-400 flex items-center gap-1"><Save className="w-3 h-3 animate-pulse" /> Saving...</span>}
          {dirty && !saving && <span className="text-xs text-amber-500">Unsaved changes</span>}
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Progress bar */}
      {totalTasks > 0 && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Today's Progress</span>
            <span className="text-sm text-gray-500">{completedTasks} / {totalTasks} tasks ({progressPct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className="bg-[#76B900] h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Carry-over banner */}
      {data._carriedFrom && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-blue-700">Incomplete tasks carried over from <span className="font-medium">{data._carriedFrom}</span></span>
        </div>
      )}

      {/* Overnight Changes Summary */}
      {overnightChanges.length > 0 && lastLoadHoursAgo !== null && (
        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
            <Sun className="w-4 h-4 text-purple-500" />
            Changes since your last visit ({lastLoadHoursAgo}h ago)
          </h3>
          <div className="space-y-1">
            {overnightChanges.map(change => (
              <div key={change.key} className="text-xs text-purple-700 flex items-center gap-2">
                <a
                  href={`https://jirasw.nvidia.com/browse/${change.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#76B900] font-medium hover:underline"
                >
                  {change.key}
                </a>
                {change.changeType === 'status' && (
                  <span>status <span className="font-medium">{change.oldValue}</span> → <span className="font-medium">{change.newValue}</span></span>
                )}
                {change.changeType === 'new' && (
                  <span className="text-green-700 font-medium">new ticket appeared</span>
                )}
                {change.changeType === 'removed' && (
                  <span className="text-gray-500 font-medium">no longer in query results</span>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setOvernightChanges([])}
            className="mt-2 text-[10px] text-purple-500 hover:text-purple-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* Overnight Summary */}
          <Section title="Overnight Summary" icon={<Sun className="w-4 h-4 text-amber-500" />} expanded={expandedSections.overnight} onToggle={() => toggleSection('overnight')} count={data.overnightSummary ? 1 : 0}>
            <textarea
              value={data.overnightSummary}
              onChange={e => { setData(prev => ({ ...prev, overnightSummary: e.target.value })); setDirty(true) }}
              placeholder="What happened overnight? Paste Slack summaries, email highlights, or notes here..."
              className="w-full min-h-[120px] p-3 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#76B900]/30 focus:border-[#76B900]"
            />
          </Section>

          {/* Jira Tasks */}
          <Section title="Jira Tasks" icon={<ExternalLink className="w-4 h-4 text-[#76B900]" />} expanded={expandedSections.jira} onToggle={() => toggleSection('jira')} count={data.jiraTasks.length} completedCount={data.jiraTasks.filter(t => t.completed).length}>
            {/* JQL Bar */}
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={jqlInput}
                    onChange={e => setJqlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && refreshJira(jqlInput)}
                    placeholder="JQL query..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#76B900]/30 focus:border-[#76B900]"
                  />
                </div>
                <button onClick={() => refreshJira(jqlInput)} disabled={jiraLoading} className="flex items-center gap-2 px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] disabled:opacity-50 transition">
                  <RefreshCw className={`w-4 h-4 ${jiraLoading ? 'animate-spin' : ''}`} /> Run
                </button>
                <button onClick={() => setShowSaveDialog(true)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition" title="Save query">
                  <Save className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Saved queries */}
              {queries.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {queries.map(q => (
                    <div key={q.name} className="inline-flex items-center gap-1 group">
                      <button onClick={() => handleLoadQuery(q.jql)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${q.isDefault ? 'bg-[#76B900]/15 text-[#76B900] border border-[#76B900]/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} title={q.jql}>
                        {q.isDefault && <Star className="w-3 h-3 inline mr-1" />}{q.name}
                      </button>
                      <button onClick={() => removeQuery(q.name)} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Save dialog */}
              {showSaveDialog && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex gap-2 items-center">
                    <input type="text" value={saveQueryName} onChange={e => setSaveQueryName(e.target.value)} placeholder="Query name..." className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#76B900] outline-none" autoFocus />
                    <button onClick={() => handleSaveQuery(false)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50">Save</button>
                    <button onClick={() => handleSaveQuery(true)} className="px-3 py-1.5 bg-[#76B900] text-white rounded-lg text-xs font-medium hover:bg-[#5a8f00]">Save as Default</button>
                    <button onClick={() => setShowSaveDialog(false)} className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-sm">✕</button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1 mt-1">
                <button onClick={() => { setJqlInput(DEFAULT_JQL); refreshJira(DEFAULT_JQL) }} className="text-[10px] text-gray-400 hover:text-[#76B900] transition">Reset to default</button>
              </div>
            </div>

            {/* Filters */}
            {data.jiraTasks.length > 0 && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1">
                  <option value="">All Statuses</option>
                  {filterOptions.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1">
                  <option value="">All Priorities</option>
                  {filterOptions.priorities.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterDevTeam} onChange={e => setFilterDevTeam(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1">
                  <option value="">All Teams</option>
                  {filterOptions.devTeams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1">
                  <option value="">All Assignees</option>
                  {filterOptions.assignees.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {(filterStatus || filterPriority || filterDevTeam || filterAssignee) && (
                  <button onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterDevTeam(''); setFilterAssignee('') }} className="text-[10px] text-gray-400 hover:text-red-500 ml-1">Clear filters</button>
                )}
                <span className="text-[10px] text-gray-400 ml-auto">{filteredJiraTasks.length} of {data.jiraTasks.length} shown</span>
              </div>
            )}

            {/* Table */}
            {data.jiraTasks.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">No Jira tasks loaded. Click "Run" to pull tickets with your JQL query.</div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="w-8 px-2 py-2"></th>
                      <SortHeader field="key" label="Key" current={sortField} dir={sortDir} onClick={handleSort} />
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
                      <SortHeader field="status" label="Status" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="type" label="Type" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="priority" label="Priority" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="assignee" label="Assignee" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="devTeam" label="Dev Team" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="dueDate" label="Due" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="updated" label="Updated" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="staleness" label="Stale" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="risk" label="Risk" current={sortField} dir={sortDir} onClick={handleSort} />
                      <th className="w-20 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJiraTasks.map(task => {
                      const staleness = getStaleness(task.updated)
                      const risk = getRisk(task)
                      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
                      const hasNotes = expandedNotes.has(task.key)
                      return (
                        <React.Fragment key={task.key}>
                          <tr className={`border-b border-gray-100 hover:bg-gray-50 transition ${task.completed ? 'opacity-50 bg-gray-50' : ''}`}>
                            <td className="px-2 py-2 text-center">
                              <button onClick={() => updateJiraTask(task.key, { completed: !task.completed })}>
                                {task.completed ? <CheckCircle2 className="w-4 h-4 text-[#76B900]" /> : <Circle className="w-4 h-4 text-gray-300 hover:text-[#76B900]" />}
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <a href={`https://jirasw.nvidia.com/browse/${task.key}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] font-medium text-xs hover:underline whitespace-nowrap">{task.key}</a>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.summary}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[task.statusCategory] || 'bg-gray-100 text-gray-600'}`}>{task.status}</span>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">{task.type || '—'}</td>
                            <td className={`px-3 py-2 text-xs font-medium ${priorityColors[task.priority] || 'text-gray-500'}`}>{task.priority}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">{task.assignee || '—'}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{task.devTeam || '—'}</td>
                            <td className={`px-3 py-2 text-xs whitespace-nowrap ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                              {task.dueDate || '—'}{isOverdue && <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{task.updated ? new Date(task.updated).toLocaleDateString() : '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs ${staleness.color}`} title={`Last updated ${staleness.days} days ago`}>{staleness.icon} {staleness.label}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${risk.color}`}>{risk.label}</span>
                            </td>
                            <td className="px-2 py-2 relative">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openTransitions(task.key)} className="text-gray-300 hover:text-[#76B900] transition" title="Change status"><Play className="w-3.5 h-3.5" /></button>
                                <button onClick={() => toggleNotes(task.key)} className="text-gray-300 hover:text-blue-500 transition" title="Notes"><MessageSquare className="w-3.5 h-3.5" /></button>
                                <button onClick={() => {
                                  if (window.confirm(`Hide ${task.key} from this view? (This won't change anything in Jira)`)) {
                                    dismiss(task.key)
                                  }
                                }} className="text-gray-300 hover:text-red-500 transition" title="Hide from view"><X className="w-3.5 h-3.5" /></button>
                                <button onClick={() => removeJiraTask(task.key)} className="text-gray-300 hover:text-red-400 transition" title="Remove from today"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                              {transitionMenuKey === task.key && (
                                <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                                  {transitionLoading ? <div className="px-3 py-2 text-xs text-gray-400">Loading...</div> :
                                    transitions.length === 0 ? <div className="px-3 py-2 text-xs text-gray-400">No transitions</div> :
                                    transitions.map(t => (
                                      <button key={t.id} onClick={() => doTransition(task.key, t.id, t.name)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 transition">
                                        <ArrowRight className="w-3 h-3 text-gray-400" />{t.name}
                                      </button>
                                    ))
                                  }
                                </div>
                              )}
                            </td>
                          </tr>
                          {hasNotes && (
                            <tr key={`${task.key}-notes`} className="bg-blue-50/30">
                              <td></td>
                              <td colSpan={11} className="px-3 py-2">
                                <textarea value={task.notes} onChange={e => updateJiraTask(task.key, { notes: e.target.value })} placeholder="Personal notes (local only)..." className="w-full p-2 text-xs border border-gray-100 rounded bg-white resize-y min-h-[48px] focus:outline-none focus:ring-1 focus:ring-[#76B900]/30" rows={2} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <DismissedPanel dismissed={dismissed} onRestore={restore} onRestoreAll={restoreAll} />
          </Section>

          {/* Follow-ups & Action Items */}
          <Section title="Follow-ups & Action Items" icon={<MessageSquare className="w-4 h-4 text-purple-500" />} expanded={expandedSections.followups} onToggle={() => toggleSection('followups')} count={data.followUps.length} completedCount={data.followUps.filter(f => f.completed).length}>
            {/* Add form */}
            <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
                <input type="text" value={newFollowUp.title} onChange={e => setNewFollowUp(prev => ({ ...prev, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addFollowUp()} placeholder="Title..." className="col-span-2 border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
                <input type="text" value={newFollowUp.assignee} onChange={e => setNewFollowUp(prev => ({ ...prev, assignee: e.target.value }))} placeholder="Assignee..." className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
                <select value={newFollowUp.source} onChange={e => setNewFollowUp(prev => ({ ...prev, source: e.target.value as 'slack' | 'email' | 'other' }))} className="border border-gray-200 rounded px-3 py-1.5 text-sm">
                  <option value="slack">Slack</option>
                  <option value="email">Email</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <input type="date" value={newFollowUp.dueDate} onChange={e => setNewFollowUp(prev => ({ ...prev, dueDate: e.target.value }))} className="border border-gray-200 rounded px-3 py-1.5 text-sm" title="Due date" />
                <input type="text" value={newFollowUp.link} onChange={e => setNewFollowUp(prev => ({ ...prev, link: e.target.value }))} placeholder="Link (URL)..." className="col-span-2 border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
                <button onClick={addFollowUp} className="px-4 py-1.5 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 transition">Add</button>
              </div>
            </div>

            {/* Filters */}
            {data.followUps.length > 0 && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select value={filterFuAssignee} onChange={e => setFilterFuAssignee(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1">
                  <option value="">All Assignees</option>
                  {[...new Set(data.followUps.map(f => f.assignee).filter(Boolean))].sort().map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select value={filterFuSource} onChange={e => setFilterFuSource(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1">
                  <option value="">All Sources</option>
                  <option value="slack">Slack</option>
                  <option value="email">Email</option>
                  <option value="other">Other</option>
                </select>
                {(filterFuAssignee || filterFuSource) && (
                  <button onClick={() => { setFilterFuAssignee(''); setFilterFuSource('') }} className="text-[10px] text-gray-400 hover:text-red-500">Clear</button>
                )}
              </div>
            )}

            {/* Table */}
            {data.followUps.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">No follow-ups yet. Add one above.</div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="w-8 px-2 py-2"></th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assignee</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                      <th className="w-10 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.followUps
                      .filter(fu => !filterFuAssignee || fu.assignee === filterFuAssignee)
                      .filter(fu => !filterFuSource || fu.source === filterFuSource)
                      .map(fu => (
                      <tr key={fu.id} className={`border-b border-gray-100 hover:bg-gray-50 transition ${fu.completed ? 'opacity-50 bg-gray-50' : ''}`}>
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => updateFollowUp(fu.id, { completed: !fu.completed })}>
                            {fu.completed ? <CheckCircle2 className="w-4 h-4 text-purple-500" /> : <Circle className="w-4 h-4 text-gray-300 hover:text-purple-500" />}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={fu.title} onChange={e => updateFollowUp(fu.id, { title: e.target.value })} className={`w-full bg-transparent text-sm border-0 p-0 focus:outline-none focus:ring-0 ${fu.completed ? 'line-through text-gray-400' : 'text-gray-800'}`} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={fu.assignee || ''} onChange={e => updateFollowUp(fu.id, { assignee: e.target.value })} className="w-full bg-transparent text-xs border-0 p-0 text-gray-600 focus:outline-none" placeholder="—" />
                        </td>
                        <td className="px-3 py-2">
                          <select value={fu.source} onChange={e => updateFollowUp(fu.id, { source: e.target.value as 'slack' | 'email' | 'other' })} className="text-xs border-0 bg-transparent p-0 text-gray-600 focus:outline-none">
                            <option value="slack">Slack</option>
                            <option value="email">Email</option>
                            <option value="other">Other</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fu.createdDate || '—'}</td>
                        <td className="px-3 py-2">
                          <input type="date" value={fu.dueDate || ''} onChange={e => updateFollowUp(fu.id, { dueDate: e.target.value })} className="text-xs border-0 bg-transparent p-0 text-gray-600 focus:outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          {fu.link ? (
                            <a href={fu.link} target="_blank" rel="noopener noreferrer" className="text-[#76B900] text-xs hover:underline truncate block max-w-[120px]" title={fu.link}>
                              {(() => { try { const u = new URL(fu.link); return u.pathname.split('/').pop() || u.hostname } catch { return fu.link.slice(0, 20) } })()}
                            </a>
                          ) : (
                            <input type="text" value="" onChange={e => updateFollowUp(fu.id, { link: e.target.value })} className="w-full bg-transparent text-xs border-0 p-0 text-gray-400 focus:outline-none" placeholder="Add link..." />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={fu.notes} onChange={e => updateFollowUp(fu.id, { notes: e.target.value })} className="w-full bg-transparent text-xs border-0 p-0 text-gray-600 focus:outline-none" placeholder="Notes..." />
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => deleteFollowUp(fu.id)} className="text-gray-300 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}

// Section component
function Section({ title, icon, expanded, onToggle, children, count, completedCount }: { title: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void; children: React.ReactNode; count?: number; completedCount?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition">
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          {icon}
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
          {count !== undefined && count > 0 && <span className="text-xs text-gray-400 ml-1">{completedCount !== undefined ? `${completedCount}/${count}` : count}</span>}
        </div>
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// Sort header
function SortHeader({ field, label, current, dir, onClick }: { field: SortField; label: string; current: SortField; dir: SortDir; onClick: (f: SortField) => void }) {
  const isActive = current === field
  return (
    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none whitespace-nowrap" onClick={() => onClick(field)}>
      <span className="flex items-center gap-1">{label}{isActive && (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</span>
    </th>
  )
}

// Source badge
