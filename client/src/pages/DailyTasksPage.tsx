import { useState, useEffect, useCallback } from 'react'
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
  Save
} from 'lucide-react'

interface JiraTask {
  key: string
  summary: string
  status: string
  statusCategory: string
  priority: string
  type: string
  dueDate: string | null
  startDate: string | null
  devTeam: string | null
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
}

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

export default function DailyTasksPage() {
  const [date, setDate] = useState(getToday())
  const [data, setData] = useState<DailyData>({
    date: getToday(),
    jiraTasks: [],
    manualTasks: [],
    followUps: [],
    overnightSummary: ''
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

  // New item inputs
  const [newManualTask, setNewManualTask] = useState('')
  const [newFollowUp, setNewFollowUp] = useState({ title: '', source: 'slack' as const })

  // Load daily tasks
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/daily-tasks/${date}`, { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setData(json)
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
  const refreshJira = async () => {
    setJiraLoading(true)
    try {
      const res = await fetch(`/api/daily-tasks/${date}/jira`, { credentials: 'include' })
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
        setData(prev => ({ ...prev, jiraTasks: merged }))
        setDirty(true)
      }
    } catch (err) {
      console.error('Failed to refresh Jira:', err)
    } finally {
      setJiraLoading(false)
    }
  }

  // Update helpers
  const updateJiraTask = (key: string, updates: Partial<JiraTask>) => {
    setData(prev => ({
      ...prev,
      jiraTasks: prev.jiraTasks.map(t => t.key === key ? { ...t, ...updates } : t)
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

  // Progress stats
  const totalTasks = data.jiraTasks.length + data.manualTasks.length + data.followUps.length
  const completedTasks = data.jiraTasks.filter(t => t.completed).length +
    data.manualTasks.filter(t => t.completed).length +
    data.followUps.filter(f => f.completed).length
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="p-8 max-w-5xl mx-auto">
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
          {/* Save indicator */}
          {saving && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Save className="w-3 h-3 animate-pulse" /> Saving...
            </span>
          )}
          {dirty && !saving && (
            <span className="text-xs text-amber-500">Unsaved changes</span>
          )}
          {/* Date picker */}
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          {/* Refresh Jira */}
          <button
            onClick={refreshJira}
            disabled={jiraLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${jiraLoading ? 'animate-spin' : ''}`} />
            Refresh Jira
          </button>
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
            {data.jiraTasks.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">
                No Jira tasks loaded. Click "Refresh Jira" to pull your assigned tickets.
              </div>
            ) : (
              <div className="space-y-2">
                {data.jiraTasks.map(task => (
                  <div
                    key={task.key}
                    className={`border border-gray-200 rounded-lg p-3 transition ${task.completed ? 'bg-gray-50 opacity-70' : 'bg-white'}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => updateJiraTask(task.key, { completed: !task.completed })}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {task.completed ?
                          <CheckCircle2 className="w-5 h-5 text-[#76B900]" /> :
                          <Circle className="w-5 h-5 text-gray-300 hover:text-[#76B900]" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={`https://jirasw.nvidia.com/browse/${task.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#76B900] font-medium text-sm hover:underline"
                          >
                            {task.key}
                          </a>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[task.statusCategory] || 'bg-gray-100 text-gray-600'}`}>
                            {task.status}
                          </span>
                          <span className={`text-xs font-medium ${priorityColors[task.priority] || 'text-gray-500'}`}>
                            {task.priority}
                          </span>
                          {task.dueDate && (
                            <span className="text-xs text-gray-400">Due: {task.dueDate}</span>
                          )}
                        </div>
                        <p className={`text-sm mt-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {task.summary}
                        </p>
                        {/* Personal notes */}
                        <textarea
                          value={task.notes}
                          onChange={e => updateJiraTask(task.key, { notes: e.target.value })}
                          placeholder="Add personal notes..."
                          className="mt-2 w-full p-2 text-xs border border-gray-100 rounded bg-gray-50 resize-y min-h-[32px] focus:outline-none focus:ring-1 focus:ring-[#76B900]/30 focus:border-[#76B900]"
                          rows={1}
                        />
                      </div>
                    </div>
                  </div>
                ))}
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
            {/* Add form */}
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
            {/* List */}
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
            {/* Add form */}
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
            {/* List */}
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
