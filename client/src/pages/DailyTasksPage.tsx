import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ClipboardList,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Mail,
  Hash,
  CheckCircle2,
  Circle,
  Sun,
  Save,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  ChevronUp,
  Play,
  ArrowRight,
  RotateCcw
} from 'lucide-react'

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
}

interface FollowUp {
  id: string
  title: string
  source: 'slack' | 'email' | 'other'
  notes: string
  completed: boolean
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

const DEFAULT_JQL = '(assignee = currentUser() OR cf[12712] = currentUser()) AND status != Done AND status != Closed ORDER BY priority ASC, duedate ASC'

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
  // Staleness component
  const staleness = getStaleness(task.updated)
  if (staleness.days > 14) score += 3
  else if (staleness.days > 7) score += 2
  else if (staleness.days > 3) score += 1

  // Overdue
  if (task.dueDate && new Date(task.dueDate) < new Date()) {
    const overdueDays = Math.floor((Date.now() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    if (overdueDays > 7) score += 3
    else if (overdueDays > 3) score += 2
    else score += 1
  }

  // Priority
  if (task.priority === 'Highest') score += 2
  else if (task.priority === 'High') score += 1

  // No status update
  if (!task.statusUpdate) score += 1

  if (score >= 5) return { label: 'Critical', color: 'bg-red-100 text-red-700', score }
  if (score >= 3) return { label: 'At Risk', color: 'bg-orange-100 text-orange-700', score }
  if (score >= 1) return { label: 'Watch', color: 'bg-yellow-100 text-yellow-700', score }
  return { label: 'OK', color: 'bg-green-100 text-green-700', score }
}

type SortField = 'key' | 'priority' | 'status' | 'dueDate' | 'updated' | 'risk' | 'staleness'
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
  const [expandedSections, setExpandedSections] = useState({
    overnight: true,
    jira: true,
    followups: true,
    manual: true
  })
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [jqlInput, setJqlInput] = useState(DEFAULT_JQL)
  const [sortField, setSortField] = useState<SortField>('risk')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [filterDevTeam, setFilterDevTeam] = useState<string>('')

  // New item inputs
  const [newManualTask, setNewManualTask] = useState('')
  const [newFollowUp, setNewFollowUp] = useState({ title: '', source: 'slack' as const })
  
  // Transitions
  const [transitionMenuKey, setTransitionMenuKey] = useState<string | null>(null)
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [transitionLoading, setTransitionLoading] = useState(false)

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

  // Save data
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
        // Merge with existing notes/completed status
        const existingMap = new Map(data.jiraTasks.map(t => [t.key, t]))
        const merged = json.tasks.map((task: JiraTask) => {
          const existing = existingMap.get(task.key)
          return {
            ...task,
            notes: existing?.notes || '',
            completed: existing?.completed || false
          }
        })
        setData(prev => ({ ...prev, jiraTasks: merged, jql }))
        setDirty(true)
      }
    } catch (err) {
      console.error('Failed to refresh Jira:', err)
    } finally {
      setJiraLoading(false)
    }
  }

  // Filter options derived from data
  const filterOptions = useMemo(() => {
    const statuses = new Set<string>()
    const priorities = new Set<string>()
    const devTeams = new Set<string>()
    data.jiraTasks.forEach(t => {
      if (t.status) statuses.add(t.status)
      if (t.priority) priorities.add(t.priority)
      if (t.devTeam) devTeams.add(t.devTeam)
    })
    return {
      statuses: [...statuses].sort(),
      priorities: [...priorities].sort(),
      devTeams: [...devTeams].sort()
    }
  }, [data.jiraTasks])

  // Filtered and sorted Jira tasks
  const filteredJiraTasks = useMemo(() => {
    let tasks = [...data.jiraTasks]
    if (filterStatus) tasks = tasks.filter(t => t.status === filterStatus)
    if (filterPriority) tasks = tasks.filter(t => t.priority === filterPriority)
    if (filterDevTeam) tasks = tasks.filter(t => t.devTeam === filterDevTeam)

    // Sort
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
        case 'staleness': {
          cmp = getStaleness(a.updated).days - getStaleness(b.updated).days
          break
        }
        case 'risk': {
          cmp = getRisk(a).score - getRisk(b).score
          break
        }
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return tasks
  }, [data.jiraTasks, filterStatus, filterPriority, filterDevTeam, sortField, sortDir])

  // Update helpers
  const updateJiraTask = (key: string, updates: Partial<JiraTask>) => {
    setData(prev => ({
      ...prev,
      jiraTasks: prev.jiraTasks.map(t => t.key === key ? { ...t, ...updates } : t)
    }))
    setDirty(true)
  }

  // Quick action: get transitions for an issue
  const openTransitions = async (key: string) => {
    if (transitionMenuKey === key) {
      setTransitionMenuKey(null)
      return
    }
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

  // Quick action: perform a transition
  const doTransition = async (key: string, transitionId: string, transitionName: string) => {
    try {
      const res = await fetch(`/api/daily-tasks/transitions/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transitionId })
      })
      if (res.ok) {
        // Update local state with new status
        updateJiraTask(key, { status: transitionName, statusCategory: 'indeterminate' })
        setTransitionMenuKey(null)
      }
    } catch (err) {
      console.error('Failed to transition:', err)
    }
  }

  const removeJiraTask = (key: string) => {
    setData(prev => ({
      ...prev,
      jiraTasks: prev.jiraTasks.filter(t => t.key !== key)
    }))
    setDirty(true)
  }

  const updateManualTask = (id: string, updates: Partial<ManualTask>) => {
    setData(prev => ({
      ...prev,
      manualTasks: prev.manualTasks.map(t => t.id === id ? { ...t, ...updates } : t)
    }))
    setDirty(true)
  }

  const updateFollowUp = (id: string, updates: Partial<FollowUp>) => {
    setData(prev => ({
      ...prev,
      followUps: prev.followUps.map(f => f.id === id ? { ...f, ...updates } : f)
    }))
    setDirty(true)
  }

  const addManualTask = () => {
    if (!newManualTask.trim()) return
    const task: ManualTask = {
      id: crypto.randomUUID(),
      title: newManualTask.trim(),
      notes: '',
      completed: false,
      createdAt: new Date().toISOString()
    }
    setData(prev => ({ ...prev, manualTasks: [...prev.manualTasks, task] }))
    setNewManualTask('')
    setDirty(true)
  }

  const addFollowUp = () => {
    if (!newFollowUp.title.trim()) return
    const followUp: FollowUp = {
      id: crypto.randomUUID(),
      title: newFollowUp.title.trim(),
      source: newFollowUp.source,
      notes: '',
      completed: false
    }
    setData(prev => ({ ...prev, followUps: [...prev.followUps, followUp] }))
    setNewFollowUp({ title: '', source: 'slack' })
    setDirty(true)
  }

  const deleteManualTask = (id: string) => {
    setData(prev => ({ ...prev, manualTasks: prev.manualTasks.filter(t => t.id !== id) }))
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
    setExpandedNotes(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Progress stats
  const totalTasks = data.jiraTasks.length + data.manualTasks.length + data.followUps.length
  const completedTasks = data.jiraTasks.filter(t => t.completed).length +
    data.manualTasks.filter(t => t.completed).length +
    data.followUps.filter(f => f.completed).length
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-[#76B900]" />
            <h1 className="text-2xl font-bold text-gray-900">Daily Tasks</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Your personal daily command center</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Save className="w-3 h-3 animate-pulse" /> Saving...
            </span>
          )}
          {dirty && !saving && (
            <span className="text-xs text-amber-500">Unsaved changes</span>
          )}
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Progress bar */}
      {totalTasks > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Today's Progress</span>
            <span className="text-sm text-gray-500">{completedTasks} / {totalTasks} tasks ({progressPct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-[#76B900] h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Carry-over banner */}
      {data._carriedFrom && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-blue-700">
            Incomplete tasks carried over from <span className="font-medium">{data._carriedFrom}</span>
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* Overnight Summary */}
          <Section
            title="Overnight Summary"
            icon={<Sun className="w-4 h-4 text-amber-500" />}
            expanded={expandedSections.overnight}
            onToggle={() => toggleSection('overnight')}
            count={data.overnightSummary ? 1 : 0}
          >
            <textarea
              value={data.overnightSummary}
              onChange={e => {
                setData(prev => ({ ...prev, overnightSummary: e.target.value }))
                setDirty(true)
              }}
              placeholder="What happened overnight? Paste Slack summaries, email highlights, or notes here..."
              className="w-full min-h-[120px] p-3 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#76B900]/30 focus:border-[#76B900]"
            />
          </Section>

          {/* Jira Tasks */}
          <Section
            title="Jira Tasks"
            icon={<ExternalLink className="w-4 h-4 text-[#76B900]" />}
            expanded={expandedSections.jira}
            onToggle={() => toggleSection('jira')}
            count={data.jiraTasks.length}
            completedCount={data.jiraTasks.filter(t => t.completed).length}
          >
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
                <button
                  onClick={() => refreshJira(jqlInput)}
                  disabled={jiraLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] disabled:opacity-50 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${jiraLoading ? 'animate-spin' : ''}`} />
                  Run
                </button>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <button
                  onClick={() => { setJqlInput(DEFAULT_JQL); refreshJira(DEFAULT_JQL) }}
                  className="text-[10px] text-gray-400 hover:text-[#76B900] transition"
                >
                  Reset to default
                </button>
              </div>
            </div>

            {/* Filters */}
            {data.jiraTasks.length > 0 && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1"
                >
                  <option value="">All Statuses</option>
                  {filterOptions.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={filterPriority}
                  onChange={e => setFilterPriority(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1"
                >
                  <option value="">All Priorities</option>
                  {filterOptions.priorities.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  value={filterDevTeam}
                  onChange={e => setFilterDevTeam(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1"
                >
                  <option value="">All Teams</option>
                  {filterOptions.devTeams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {(filterStatus || filterPriority || filterDevTeam) && (
                  <button
                    onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterDevTeam('') }}
                    className="text-[10px] text-gray-400 hover:text-red-500 ml-1"
                  >
                    Clear filters
                  </button>
                )}
                <span className="text-[10px] text-gray-400 ml-auto">
                  {filteredJiraTasks.length} of {data.jiraTasks.length} shown
                </span>
              </div>
            )}

            {/* Table */}
            {data.jiraTasks.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">
                No Jira tasks loaded. Click "Run" to pull tickets with your JQL query.
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="w-8 px-2 py-2"></th>
                      <SortHeader field="key" label="Key" current={sortField} dir={sortDir} onClick={handleSort} />
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
                      <SortHeader field="status" label="Status" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="priority" label="Priority" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="dueDate" label="Due" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="updated" label="Updated" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="staleness" label="Stale" current={sortField} dir={sortDir} onClick={handleSort} />
                      <SortHeader field="risk" label="Risk" current={sortField} dir={sortDir} onClick={handleSort} />
                      <th className="w-16 px-2 py-2"></th>
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
                          <tr
                            className={`border-b border-gray-100 hover:bg-gray-50 transition ${task.completed ? 'opacity-50 bg-gray-50' : ''}`}
                          >
                            <td className="px-2 py-2 text-center">
                              <button onClick={() => updateJiraTask(task.key, { completed: !task.completed })}>
                                {task.completed ?
                                  <CheckCircle2 className="w-4 h-4 text-[#76B900]" /> :
                                  <Circle className="w-4 h-4 text-gray-300 hover:text-[#76B900]" />
                                }
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <a
                                href={`https://jirasw.nvidia.com/browse/${task.key}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#76B900] font-medium text-xs hover:underline whitespace-nowrap"
                              >
                                {task.key}
                              </a>
                            </td>
                            <td className="px-3 py-2 max-w-xs">
                              <span className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                {task.summary}
                              </span>
                              {task.devTeam && (
                                <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                  {task.devTeam}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[task.statusCategory] || 'bg-gray-100 text-gray-600'}`}>
                                {task.status}
                              </span>
                            </td>
                            <td className={`px-3 py-2 text-xs font-medium ${priorityColors[task.priority] || 'text-gray-500'}`}>
                              {task.priority}
                            </td>
                            <td className={`px-3 py-2 text-xs whitespace-nowrap ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                              {task.dueDate || '—'}
                              {isOverdue && <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                              {task.updated ? new Date(task.updated).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs ${staleness.color}`} title={`Last updated ${staleness.days} days ago`}>
                                {staleness.icon} {staleness.label}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${risk.color}`}>
                                {risk.label}
                              </span>
                            </td>
                            <td className="px-2 py-2 relative">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openTransitions(task.key)}
                                  className="text-gray-300 hover:text-[#76B900] transition"
                                  title="Change status"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => toggleNotes(task.key)}
                                  className="text-gray-300 hover:text-blue-500 transition"
                                  title="Notes"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => removeJiraTask(task.key)}
                                  className="text-gray-300 hover:text-red-400 transition"
                                  title="Remove from today"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {/* Transition dropdown */}
                              {transitionMenuKey === task.key && (
                                <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                                  {transitionLoading ? (
                                    <div className="px-3 py-2 text-xs text-gray-400">Loading...</div>
                                  ) : transitions.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-gray-400">No transitions available</div>
                                  ) : (
                                    transitions.map(t => (
                                      <button
                                        key={t.id}
                                        onClick={() => doTransition(task.key, t.id, t.name)}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 transition"
                                      >
                                        <ArrowRight className="w-3 h-3 text-gray-400" />
                                        {t.name}
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                          {hasNotes && (
                            <tr key={`${task.key}-notes`} className="bg-blue-50/30">
                              <td></td>
                              <td colSpan={9} className="px-3 py-2">
                                <textarea
                                  value={task.notes}
                                  onChange={e => updateJiraTask(task.key, { notes: e.target.value })}
                                  placeholder="Personal notes (local only)..."
                                  className="w-full p-2 text-xs border border-gray-100 rounded bg-white resize-y min-h-[48px] focus:outline-none focus:ring-1 focus:ring-[#76B900]/30"
                                  rows={2}
                                />
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
          </Section>

          {/* Follow-ups & Action Items */}
          <Section
            title="Follow-ups & Action Items"
            icon={<MessageSquare className="w-4 h-4 text-purple-500" />}
            expanded={expandedSections.followups}
            onToggle={() => toggleSection('followups')}
            count={data.followUps.length}
            completedCount={data.followUps.filter(f => f.completed).length}
          >
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={newFollowUp.title}
                onChange={e => setNewFollowUp(prev => ({ ...prev, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addFollowUp()}
                placeholder="Add a follow-up..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              />
              <select
                value={newFollowUp.source}
                onChange={e => setNewFollowUp(prev => ({ ...prev, source: e.target.value as 'slack' | 'email' | 'other' }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="slack">Slack</option>
                <option value="email">Email</option>
                <option value="other">Other</option>
              </select>
              <button
                onClick={addFollowUp}
                className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {data.followUps.map(fu => (
                <div
                  key={fu.id}
                  className={`border border-gray-200 rounded-lg p-3 transition ${fu.completed ? 'bg-gray-50 opacity-70' : 'bg-white'}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => updateFollowUp(fu.id, { completed: !fu.completed })}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {fu.completed ?
                        <CheckCircle2 className="w-5 h-5 text-purple-500" /> :
                        <Circle className="w-5 h-5 text-gray-300 hover:text-purple-500" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <SourceBadge source={fu.source} />
                        <p className={`text-sm ${fu.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {fu.title}
                        </p>
                      </div>
                      <textarea
                        value={fu.notes}
                        onChange={e => updateFollowUp(fu.id, { notes: e.target.value })}
                        placeholder="Notes..."
                        className="mt-2 w-full p-2 text-xs border border-gray-100 rounded bg-gray-50 resize-y min-h-[32px] focus:outline-none focus:ring-1 focus:ring-purple-200"
                        rows={1}
                      />
                    </div>
                    <button
                      onClick={() => deleteFollowUp(fu.id)}
                      className="text-gray-300 hover:text-red-400 transition flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Manual Tasks */}
          <Section
            title="Manual Tasks"
            icon={<Plus className="w-4 h-4 text-blue-500" />}
            expanded={expandedSections.manual}
            onToggle={() => toggleSection('manual')}
            count={data.manualTasks.length}
            completedCount={data.manualTasks.filter(t => t.completed).length}
          >
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={newManualTask}
                onChange={e => setNewManualTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addManualTask()}
                placeholder="Add a task..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
              <button
                onClick={addManualTask}
                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {data.manualTasks.map(task => (
                <div
                  key={task.id}
                  className={`border border-gray-200 rounded-lg p-3 transition ${task.completed ? 'bg-gray-50 opacity-70' : 'bg-white'}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => updateManualTask(task.id, { completed: !task.completed })}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {task.completed ?
                        <CheckCircle2 className="w-5 h-5 text-blue-500" /> :
                        <Circle className="w-5 h-5 text-gray-300 hover:text-blue-500" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {task.title}
                      </p>
                      <textarea
                        value={task.notes}
                        onChange={e => updateManualTask(task.id, { notes: e.target.value })}
                        placeholder="Notes..."
                        className="mt-2 w-full p-2 text-xs border border-gray-100 rounded bg-gray-50 resize-y min-h-[32px] focus:outline-none focus:ring-1 focus:ring-blue-200"
                        rows={1}
                      />
                    </div>
                    <button
                      onClick={() => deleteManualTask(task.id)}
                      className="text-gray-300 hover:text-red-400 transition flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}

// Section component
function Section({
  title,
  icon,
  expanded,
  onToggle,
  children,
  count,
  completedCount
}: {
  title: string
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  count?: number
  completedCount?: number
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          {icon}
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="text-xs text-gray-400 ml-1">
              {completedCount !== undefined ? `${completedCount}/${count}` : count}
            </span>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

// Sort header
function SortHeader({ field, label, current, dir, onClick }: {
  field: SortField
  label: string
  current: SortField
  dir: SortDir
  onClick: (f: SortField) => void
}) {
  const isActive = current === field
  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
      onClick={() => onClick(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive && (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  )
}

// Source badge
function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
    slack: { icon: <Hash className="w-3 h-3" />, bg: 'bg-purple-100', text: 'text-purple-700' },
    email: { icon: <Mail className="w-3 h-3" />, bg: 'bg-amber-100', text: 'text-amber-700' },
    other: { icon: <MessageSquare className="w-3 h-3" />, bg: 'bg-gray-100', text: 'text-gray-600' }
  }
  const c = config[source] || config.other
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>
      {c.icon}
      {source}
    </span>
  )
}
