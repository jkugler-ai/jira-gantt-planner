import { useEffect, useState } from 'react'
import { useFilterContext } from '../context/FilterContext'
import type { FilteredIssue } from '../context/FilterContext'
import { getDefaultQuery } from '../lib/savedQueries'
import { GanttChart, Calendar, AlertTriangle, CheckCircle, Clock, Bug, RefreshCw, Plus, Trash2, Square, CheckSquare } from 'lucide-react'

const PAGE_DEFAULTS: Record<string, string> = {
  stories: 'project = OMPE AND issuetype = Story AND status != Done ORDER BY cf[13210] ASC, priority ASC',
  releases: 'project = OMPE AND issuetype = Release AND status != Done ORDER BY duedate ASC',
  'sprint-goals': 'project = OMPE AND issuetype = "Sprint Goal" AND status != Done ORDER BY cf[13210] ASC, priority ASC',
  bugs: 'project = OMPE AND issuetype = Bug AND status != Done ORDER BY priority ASC, created DESC',
}

interface WeekItem {
  key: string
  summary: string
  dueDate: string
  type?: string
  source: 'jira' | 'followup'
}

interface ManualTask {
  id: string
  title: string
  notes: string
  completed: boolean
  createdAt: string
  dueDate?: string
}

const MANUAL_TASKS_KEY = 'mission-control-dashboard-todos'

export default function DashboardPage() {
  const { pageDatasets, setPageDataset } = useFilterContext()
  const [weekItems, setWeekItems] = useState<WeekItem[]>([])
  const [loading, setLoading] = useState(true)
  const [followUps, setFollowUps] = useState<any[]>([])
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')

  // Load manual tasks from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MANUAL_TASKS_KEY)
      if (stored) setManualTasks(JSON.parse(stored))
    } catch {}
  }, [])

  const saveManualTasks = (tasks: ManualTask[]) => {
    setManualTasks(tasks)
    localStorage.setItem(MANUAL_TASKS_KEY, JSON.stringify(tasks))
  }

  const addManualTask = () => {
    if (!newTaskTitle.trim()) return
    const task: ManualTask = {
      id: crypto.randomUUID(),
      title: newTaskTitle.trim(),
      notes: '',
      completed: false,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    saveManualTasks([task, ...manualTasks])
    setNewTaskTitle('')
  }

  const toggleManualTask = (id: string) => {
    saveManualTasks(manualTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const deleteManualTask = (id: string) => {
    saveManualTasks(manualTasks.filter(t => t.id !== id))
  }

  const stories = pageDatasets['stories'] || []
  const releases = pageDatasets['releases'] || []
  const sprintGoals = pageDatasets['sprint-goals'] || []
  const bugs = pageDatasets['bugs'] || []

  const today = new Date()
  const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  // Auto-load all default queries on mount
  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      try {
        const pages = Object.keys(PAGE_DEFAULTS)
        await Promise.all(pages.map(async (pageId) => {
          // Skip if already loaded
          if (pageDatasets[pageId] && pageDatasets[pageId].length > 0) return
          const jql = getDefaultQuery(pageId, PAGE_DEFAULTS[pageId])
          const res = await fetch(`/api/jira/query?jql=${encodeURIComponent(jql)}&maxResults=200`, { credentials: 'include' })
          if (res.ok) {
            const data = await res.json()
            const issues: FilteredIssue[] = (data.issues || []).map((issue: any) => ({
              key: issue.key,
              summary: issue.summary || issue.fields?.summary,
              status: issue.status || issue.fields?.status?.name,
              statusCategory: issue.statusCategory || issue.fields?.status?.statusCategory?.key,
              type: issue.type || issue.fields?.issuetype?.name,
              dueDate: issue.dueDate || issue.fields?.duedate,
              startDate: issue.startDate || issue.fields?.customfield_10015,
              assignee: issue.assignee || issue.fields?.assignee?.displayName,
              priority: issue.priority || issue.fields?.priority?.name,
            }))
            setPageDataset(pageId, issues)
          }
        }))
        // Also fetch follow-ups for the week
        const res = await fetch('/api/daily-tasks/calendar/manual', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setFollowUps(data.tasks || [])
        }
      } catch (e) {
        console.error('Dashboard load error:', e)
      }
      setLoading(false)
    }
    loadAll()
  }, [])

  // Build week items from loaded data + follow-ups
  useEffect(() => {
    const startOfWeek = getMonday(today)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 4) // Friday

    const items: WeekItem[] = []

    // Jira items with due dates this week (deduplicate by key)
    const seen = new Set<string>()
    const allItems = [...stories, ...releases, ...sprintGoals, ...bugs]
    for (const item of allItems) {
      if (item.dueDate && !seen.has(item.key)) {
        seen.add(item.key)
        const d = new Date(item.dueDate)
        if (d >= startOfWeek && d <= endOfWeek && item.statusCategory !== 'done') {
          items.push({ key: item.key, summary: item.summary, dueDate: item.dueDate, type: item.type, source: 'jira' })
        }
      }
    }

    // Follow-ups with due dates this week (deduplicate by id)
    for (const fu of followUps) {
      if (fu.dueDate && !seen.has(fu.id)) {
        seen.add(fu.id)
        const d = new Date(fu.dueDate)
        if (d >= startOfWeek && d <= endOfWeek) {
          items.push({ key: fu.id, summary: fu.title, dueDate: fu.dueDate, source: 'followup' })
        }
      }
    }

    setWeekItems(items)
  }, [stories, releases, sprintGoals, bugs, followUps])

  // All items combined for stats
  const allLoaded = [...stories, ...releases, ...sprintGoals, ...bugs]
  const totalItems = allLoaded.length
  const done = allLoaded.filter(i => i.statusCategory === 'done')
  const inProgress = allLoaded.filter(i => i.statusCategory === 'indeterminate')
  const toDo = allLoaded.filter(i => i.statusCategory === 'new')
  const overdue = allLoaded.filter(i => i.dueDate && new Date(i.dueDate) < today && i.statusCategory !== 'done')
  const upcomingDue = allLoaded.filter(i => i.dueDate && new Date(i.dueDate) >= today && new Date(i.dueDate) <= twoWeeksOut && i.statusCategory !== 'done')

  // Health
  const totalActive = inProgress.length + toDo.length
  const overdueRatio = totalActive > 0 ? overdue.length / totalActive : 0
  let healthStatus = 'On Track'
  let healthColor = 'text-green-700'
  let healthBg = 'bg-green-50 border-green-200'
  if (overdueRatio > 0.3) { healthStatus = 'At Risk'; healthColor = 'text-red-700'; healthBg = 'bg-red-50 border-red-200'; }
  else if (overdueRatio > 0.1 || overdue.length > 2) { healthStatus = 'Needs Attention'; healthColor = 'text-amber-700'; healthBg = 'bg-amber-50 border-amber-200'; }

  // This Week calendar
  const startOfWeek = getMonday(today)
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(d.getDate() + i)
    return d
  })

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading data from all queries...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Program health at a glance • {totalItems} items loaded across all pages</p>
      </div>

      {/* Health Banner */}
      {totalItems > 0 && (
        <div className={`mb-6 p-4 rounded-xl border ${healthBg}`}>
          <div className="flex items-center gap-3">
            <div className={`text-lg font-bold ${healthColor}`}>{healthStatus}</div>
            <div className="text-sm text-gray-600">
              {done.length} completed • {inProgress.length} in progress • {toDo.length} to do • {overdue.length} overdue
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2">
            <Clock className="w-4 h-4" />
            STORIES
          </div>
          <div className="text-2xl font-bold text-gray-900">{stories.length}</div>
          <div className="text-xs text-gray-500 mt-1">{stories.filter(s => s.statusCategory === 'done').length} done</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2">
            <GanttChart className="w-4 h-4" />
            RELEASES
          </div>
          <div className="text-2xl font-bold text-gray-900">{releases.length}</div>
          <div className="text-xs text-gray-500 mt-1">{releases.filter(r => r.dueDate && new Date(r.dueDate) <= twoWeeksOut && new Date(r.dueDate) >= today).length} due in 2 weeks</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2">
            <CheckCircle className="w-4 h-4" />
            SPRINT GOALS
          </div>
          <div className="text-2xl font-bold text-gray-900">{sprintGoals.length}</div>
          <div className="text-xs text-gray-500 mt-1">{sprintGoals.filter(s => s.statusCategory === 'indeterminate').length} in progress</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2">
            <Bug className="w-4 h-4" />
            BUGS
          </div>
          <div className="text-2xl font-bold text-gray-900">{bugs.length}</div>
          <div className="text-xs text-gray-500 mt-1">{bugs.filter(b => b.statusCategory !== 'done').length} open</div>
        </div>
      </div>

      {/* Past Due Items */}
      {overdue.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-5 mb-6">
          <h2 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Past Due ({overdue.length})
          </h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {overdue
              .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
              .map(item => {
                const daysLate = Math.ceil((today.getTime() - new Date(item.dueDate!).getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={item.key} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <a
                        href={`https://jirasw.nvidia.com/browse/${item.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#76B900] font-medium hover:underline flex-shrink-0"
                      >
                        {item.key}
                      </a>
                      {item.type && <span className="text-xs text-gray-400 flex-shrink-0">{item.type}</span>}
                      <span className="text-gray-700 truncate">{item.summary}</span>
                    </div>
                    <span className="text-xs text-red-600 font-bold flex-shrink-0 ml-2">{daysLate}d late</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* This Week Mini Calendar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#76B900]" />
          This Week
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {weekDays.map(day => {
            const dayStr = day.toISOString().slice(0, 10)
            const isToday = dayStr === today.toISOString().slice(0, 10)
            const dayItems = weekItems.filter(i => i.dueDate === dayStr)
            return (
              <div key={dayStr} className={`rounded-lg border p-3 ${isToday ? 'border-[#76B900] bg-[#76B900]/5' : 'border-gray-200'}`}>
                <div className={`text-xs font-bold mb-2 ${isToday ? 'text-[#76B900]' : 'text-gray-500'}`}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })} {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayItems.map(item => (
                    <div key={item.key} className="text-[11px]">
                      {item.source === 'jira' ? (
                        <a
                          href={`https://jirasw.nvidia.com/browse/${item.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#76B900] hover:underline"
                          title={item.summary}
                        >
                          {item.key}
                        </a>
                      ) : (
                        <span className="text-purple-600" title={item.summary}>• {item.summary.slice(0, 30)}</span>
                      )}
                    </div>
                  ))}
                  {dayItems.length === 0 && (
                    <div className="text-[10px] text-gray-300">—</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Upcoming Dates */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-500" />
            Upcoming Due Dates (2 Weeks)
          </h2>
          {upcomingDue.length === 0 ? (
            <p className="text-sm text-gray-400">No upcoming due dates</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {upcomingDue
                .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                .slice(0, 15)
                .map(item => (
                  <div key={item.key} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <a
                        href={`https://jirasw.nvidia.com/browse/${item.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#76B900] font-medium hover:underline flex-shrink-0"
                      >
                        {item.key}
                      </a>
                      {item.type && <span className="text-xs text-gray-400 flex-shrink-0">{item.type}</span>}
                      <span className="text-gray-700 truncate">{item.summary}</span>
                    </div>
                    <span className="text-xs text-purple-600 font-medium flex-shrink-0 ml-2">{item.dueDate}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Quick Stats / Stale Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Summary
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Total active items</span><span className="font-bold">{totalActive}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">In Progress</span><span className="font-bold text-blue-600">{inProgress.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">To Do</span><span className="font-bold text-gray-600">{toDo.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Overdue</span><span className="font-bold text-red-600">{overdue.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Due next 2 weeks</span><span className="font-bold text-purple-600">{upcomingDue.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Open Bugs</span><span className="font-bold text-orange-600">{bugs.filter(b => b.statusCategory !== 'done').length}</span></div>
          </div>
        </div>
      </div>

      {/* Manual To-Do List */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-[#76B900]" />
          Quick To-Do List
        </h2>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addManualTask()}
            placeholder="Add a task..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#76B900]/30"
          />
          <button onClick={addManualTask} className="px-3 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] transition flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {manualTasks.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks yet. Add one above.</p>
        ) : (
          <div className="space-y-1">
            {manualTasks.map(task => (
              <div key={task.id} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 group ${task.completed ? 'opacity-50' : ''}`}>
                <button onClick={() => toggleManualTask(task.id)} className="flex-shrink-0 text-gray-400 hover:text-[#76B900] transition">
                  {task.completed ? <CheckSquare className="w-4 h-4 text-[#76B900]" /> : <Square className="w-4 h-4" />}
                </button>
                <span className={`text-sm flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{task.createdAt}</span>
                <button onClick={() => deleteManualTask(task.id)} className="flex-shrink-0 text-gray-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}
