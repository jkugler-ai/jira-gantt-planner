import { useEffect, useState, useCallback } from 'react'
import { useFilterContext } from '../context/FilterContext'
import type { FilteredIssue } from '../context/FilterContext'
import { useDismissed } from '../lib/useDismissed'
import { DismissButton, DismissedPanel } from '../components/DismissControls'
import { GanttChart, Calendar, AlertTriangle, CheckCircle, Clock, Bug, RefreshCw, ExternalLink, MessageSquare } from 'lucide-react'

const PAGE_DEFAULTS: Record<string, string> = {
  stories: 'project = OMPE AND issuetype = Story AND statusCategory != Done ORDER BY cf[13210] ASC, priority ASC',
  releases: 'project = OMPE AND issuetype = Release AND statusCategory != Done ORDER BY duedate ASC',
  'sprint-goals': 'project = OMPE AND issuetype = "Sprint Goal" AND statusCategory != Done ORDER BY cf[13210] ASC, priority ASC',
  bugs: 'project = OMPE AND issuetype = Bug AND statusCategory != Done ORDER BY priority ASC, created DESC',
}

interface WeekItem {
  key: string
  summary: string
  dueDate: string
  type?: string
  source: 'jira' | 'followup'
}

interface FollowUpItem {
  id: string
  title: string
  source: 'slack' | 'email' | 'other'
  notes: string
  completed: boolean
  assignee: string
  createdDate: string
  dueDate: string
  link: string
  sourceDate: string
}

export default function DashboardPage() {
  const { pageDatasets, setPageDataset } = useFilterContext()
  const [weekItems, setWeekItems] = useState<WeekItem[]>([])
  const [loading, setLoading] = useState(true)
  const [followUps, setFollowUps] = useState<any[]>([])
  const [activeFollowUps, setActiveFollowUps] = useState<FollowUpItem[]>([])
  const { dismissed, dismiss, restore, restoreAll } = useDismissed('dashboard')


  const stories = (pageDatasets['stories'] || []).filter(i => !dismissed.includes(i.key))
  const releases = (pageDatasets['releases'] || []).filter(i => !dismissed.includes(i.key))
  const sprintGoals = (pageDatasets['sprint-goals'] || []).filter(i => !dismissed.includes(i.key))
  const bugs = (pageDatasets['bugs'] || []).filter(i => !dismissed.includes(i.key))

  const today = new Date()
  const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  // Auto-load all default queries on mount
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const pages = Object.keys(PAGE_DEFAULTS)
      await Promise.all(pages.map(async (pageId) => {
        const jql = PAGE_DEFAULTS[pageId]
        if (!jql) return
        const res = await fetch(`/api/jira/query?jql=${encodeURIComponent(jql)}&maxResults=200`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const issues: FilteredIssue[] = (data.issues || []).map((issue: any) => ({
            key: issue.key,
            summary: issue.summary || issue.fields?.summary,
            status: issue.status || issue.fields?.status?.name,
            statusCategory: issue.statusCategory || issue.fields?.status?.statusCategory?.key,
            resolution: issue.resolution || issue.fields?.resolution?.name || null,
            type: issue.type || issue.fields?.issuetype?.name,
            dueDate: issue.dueDate || issue.fields?.duedate,
            startDate: issue.startDate || issue.fields?.customfield_10015,
            assignee: issue.assignee || issue.fields?.assignee?.displayName,
            priority: issue.priority || issue.fields?.priority?.name,
            updated: issue.updated || null,
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
      // Fetch all active follow-ups for the action items section
      const fuRes = await fetch('/api/daily-tasks/follow-ups/active', { credentials: 'include' })
      if (fuRes.ok) {
        const fuData = await fuRes.json()
        setActiveFollowUps(fuData.followUps || [])
      }
    } catch (e) {
      console.error('Dashboard load error:', e)
    }
    setLoading(false)
  }, [setPageDataset])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Auto-refresh when navigating back or tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadAll()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [loadAll])

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
  const isCompleted = (i: any) => i.statusCategory === 'done' || !!i.resolution || /^(done|released|closed|resolved)$/i.test(i.status)
  const done = allLoaded.filter(i => isCompleted(i))
  const inProgress = allLoaded.filter(i => i.statusCategory === 'indeterminate')
  const toDo = allLoaded.filter(i => i.statusCategory === 'new')
  const overdue = allLoaded.filter(i => i.dueDate && new Date(i.dueDate) < today && !isCompleted(i))
  const upcomingDue = allLoaded.filter(i => i.dueDate && new Date(i.dueDate) >= today && new Date(i.dueDate) <= twoWeeksOut && !isCompleted(i))

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Program health at a glance • {totalItems} items loaded across all pages</p>
        </div>
        <button
          onClick={() => loadAll()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
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
          <div className="text-2xl font-bold text-gray-900">{bugs.filter(b => b.statusCategory !== 'done').length}</div>
          <div className="text-xs text-gray-500 mt-1">open of {bugs.length} total</div>
        </div>
      </div>

      {/* Past Due Items */}
      {overdue.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-5 mb-6">
          <h2 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Past Due ({overdue.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-200">
                  <th className="text-left text-xs font-medium text-red-600 uppercase py-1 pr-3">Key</th>
                  <th className="text-left text-xs font-medium text-red-600 uppercase py-1 pr-3">Summary</th>
                  <th className="text-left text-xs font-medium text-red-600 uppercase py-1 pr-3">Assignee</th>
                  <th className="text-left text-xs font-medium text-red-600 uppercase py-1 pr-3">Last Updated</th>
                  <th className="text-right text-xs font-medium text-red-600 uppercase py-1 pr-3">Late</th>
                  <th className="text-right text-xs font-medium text-red-600 uppercase py-1"></th>
                </tr>
              </thead>
              <tbody>
                {overdue
                  .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                  .map(item => {
                    const daysLate = Math.ceil((today.getTime() - new Date(item.dueDate!).getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <tr key={item.key} className="border-b border-red-100 last:border-0">
                        <td className="py-1.5 pr-3">
                          <a
                            href={`https://jirasw.nvidia.com/browse/${item.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#76B900] font-medium hover:underline whitespace-nowrap"
                          >
                            {item.key}
                          </a>
                        </td>
                        <td className="py-1.5 pr-3 text-gray-700 truncate max-w-[300px]">{item.summary}</td>
                        <td className="py-1.5 pr-3 text-gray-600 whitespace-nowrap">{item.assignee || '\u2014'}</td>
                        <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{(item as any).updated || '\u2014'}</td>
                        <td className="py-1.5 pr-3 text-right text-red-600 font-bold whitespace-nowrap">{daysLate}d</td>
                        <td className="py-1.5 text-right">
                          <DismissButton ticketKey={item.key} onDismiss={dismiss} />
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
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

        {/* Next Week */}
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mt-5 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-500" />
          Next Week
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }, (_, i) => {
            const d = new Date(startOfWeek)
            d.setDate(d.getDate() + 7 + i)
            return d
          }).map(day => {
            const dayStr = day.toISOString().slice(0, 10)
            // Check all loaded items for next week due dates
            const nextWeekJiraItems = allLoaded.filter(i => i.dueDate === dayStr && i.statusCategory !== 'done')
            const nextWeekFollowUps = followUps.filter((fu: any) => fu.dueDate === dayStr)
            const combined = [
              ...nextWeekJiraItems.map(i => ({ key: i.key, summary: i.summary, source: 'jira' as const })),
              ...nextWeekFollowUps.map((fu: any) => ({ key: fu.id, summary: fu.title, source: 'followup' as const }))
            ]
            // Deduplicate
            const seen = new Set<string>()
            const deduped = combined.filter(item => {
              if (seen.has(item.key)) return false
              seen.add(item.key)
              return true
            })
            return (
              <div key={dayStr} className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-bold mb-2 text-gray-500">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })} {day.getDate()}
                </div>
                <div className="space-y-1">
                  {deduped.map(item => (
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
                  {deduped.length === 0 && (
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-1.5 pr-3">Key</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-1.5 pr-3">Type</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-1.5 pr-3">Summary</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-1.5 pr-3">Assignee</th>
                    <th className="text-right text-xs font-medium text-purple-600 uppercase py-1.5 pr-3">Due</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingDue
                    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                    .map(item => (
                      <tr key={item.key} className="border-b border-gray-100 last:border-0">
                        <td className="py-1.5 pr-3">
                          <a
                            href={`https://jirasw.nvidia.com/browse/${item.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#76B900] font-medium hover:underline whitespace-nowrap"
                          >
                            {item.key}
                          </a>
                        </td>
                        <td className="py-1.5 pr-3 text-xs text-gray-400 whitespace-nowrap">{item.type || '\u2014'}</td>
                        <td className="py-1.5 pr-3 text-gray-700 truncate max-w-[300px]">{item.summary}</td>
                        <td className="py-1.5 pr-3 text-gray-600 whitespace-nowrap">{item.assignee || '\u2014'}</td>
                        <td className="py-1.5 pr-3 text-right text-purple-600 font-medium whitespace-nowrap">{item.dueDate}</td>
                        <td className="py-1.5 text-right">
                          <DismissButton ticketKey={item.key} onDismiss={dismiss} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
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

      {/* Follow-ups & Action Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-purple-500" />
          Follow-ups & Action Items ({activeFollowUps.length})
        </h2>
        {activeFollowUps.length === 0 ? (
          <p className="text-sm text-gray-400">No active follow-ups. Add them from the Daily Tasks page.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assignee</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
                </tr>
              </thead>
              <tbody>
                {activeFollowUps
                  .sort((a, b) => {
                    // Items with due dates first, sorted by due date
                    if (a.dueDate && !b.dueDate) return -1
                    if (!a.dueDate && b.dueDate) return 1
                    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
                    return b.sourceDate.localeCompare(a.sourceDate)
                  })
                  .map(fu => {
                    const isOverdue = fu.dueDate && new Date(fu.dueDate) < today
                    return (
                      <tr key={fu.id} className={`border-b border-gray-100 hover:bg-gray-50 transition ${isOverdue ? 'bg-red-50/50' : ''}`}>
                        <td className="px-3 py-2 text-sm text-gray-800">{fu.title}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{fu.assignee || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            fu.source === 'slack' ? 'bg-purple-100 text-purple-700' :
                            fu.source === 'email' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{fu.source}</span>
                        </td>
                        <td className={`px-3 py-2 text-xs whitespace-nowrap ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                          {fu.dueDate || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {fu.link ? (
                            <a href={fu.link} target="_blank" rel="noopener noreferrer" className="text-[#76B900] text-xs hover:underline inline-flex items-center gap-0.5">
                              Link <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dismissed Panel */}
      <DismissedPanel dismissed={dismissed} onRestore={restore} onRestoreAll={restoreAll} />
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
