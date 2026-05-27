import { useEffect, useState } from 'react'
import { useFilterContext } from '../context/FilterContext'
import type { FilteredIssue } from '../context/FilterContext'
import { getDefaultQuery } from '../lib/savedQueries'
import { GanttChart, Calendar, AlertTriangle, CheckCircle, Clock, Bug, RefreshCw } from 'lucide-react'

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

export default function DashboardPage() {
  const { pageDatasets, setPageDataset } = useFilterContext()
  const [weekItems, setWeekItems] = useState<WeekItem[]>([])
  const [loading, setLoading] = useState(true)
  const [followUps, setFollowUps] = useState<any[]>([])

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

    // Jira items with due dates this week
    const allItems = [...stories, ...releases, ...sprintGoals, ...bugs]
    for (const item of allItems) {
      if (item.dueDate) {
        const d = new Date(item.dueDate)
        if (d >= startOfWeek && d <= endOfWeek && item.statusCategory !== 'done') {
          items.push({ key: item.key, summary: item.summary, dueDate: item.dueDate, type: item.type, source: 'jira' })
        }
      }
    }

    // Follow-ups with due dates this week
    for (const fu of followUps) {
      if (fu.dueDate) {
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
              <div key={dayStr} className={`rounded-lg border p-3 min-h-[100px] ${isToday ? 'border-[#76B900] bg-[#76B900]/5' : 'border-gray-200'}`}>
                <div className={`text-xs font-bold mb-2 ${isToday ? 'text-[#76B900]' : 'text-gray-500'}`}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })} {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayItems.slice(0, 5).map(item => (
                    <div key={item.key} className="text-[11px] truncate">
                      {item.source === 'jira' ? (
                        <a
                          href={`https://jirasw.nvidia.com/browse/${item.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#76B900] hover:underline"
                        >
                          {item.key}
                        </a>
                      ) : (
                        <span className="text-purple-600">• {item.summary.slice(0, 25)}</span>
                      )}
                    </div>
                  ))}
                  {dayItems.length > 5 && (
                    <div className="text-[10px] text-gray-400">+{dayItems.length - 5} more</div>
                  )}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                .slice(0, 10)
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
                      <span className="text-gray-700 truncate">{item.summary}</span>
                    </div>
                    <span className="text-xs text-purple-600 font-medium flex-shrink-0 ml-2">{item.dueDate}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Overdue / At Risk */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Overdue / At Risk
          </h2>
          {overdue.length === 0 ? (
            <p className="text-sm text-green-600">All items on schedule ✓</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {overdue.slice(0, 10).map(item => (
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
                    <span className="text-gray-700 truncate">{item.summary}</span>
                  </div>
                  <span className="text-xs text-red-600 font-medium flex-shrink-0 ml-2">Due {item.dueDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
