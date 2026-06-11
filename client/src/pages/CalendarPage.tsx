import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, getDay } from 'date-fns'
import { ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, X } from 'lucide-react'
import { useFilterContext } from '../context/FilterContext'
import axios from 'axios'
import { getDefaultQuery } from '../lib/savedQueries'
import { useDismissed } from '../lib/useDismissed'
import { DismissedPanel } from '../components/DismissControls'

interface CalendarEvent {
  key: string
  summary: string
  date: string
  dateType: 'start' | 'due' | 'holiday'
  issueType: string
  status: string
  statusCategory: string
  assignee: string
}

interface HolidayEntry {
  date: string
  title: string
  type: string
  description: string
  location: string
}

const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  Release: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  'Sprint Goal': { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  Story: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  Bug: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  Manual: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  Holiday: { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
}

const defaultTypeColor = { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' }

const dateTypeIcons: Record<string, string> = {
  start: '▶',
  due: '◼',
  holiday: '🏖️',
}

// Parse holiday date string like "Dec 25" or "Jun 18 - 19" into yyyy-MM-dd dates for a given year
function parseHolidayDates(dateStr: string, year: number): string[] {
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  }

  const trimmed = dateStr.trim()
  // Check for range: "Jun 18 - 19" or "Dec 24 -  25"
  const rangeMatch = trimmed.match(/^(\w{3})\s+(\d{1,2})\s*-\s*(\d{1,2})$/)
  if (rangeMatch) {
    const [, month, startDay, endDay] = rangeMatch
    const monthNum = months[month]
    if (!monthNum) return []
    const dates: string[] = []
    for (let d = parseInt(startDay); d <= parseInt(endDay); d++) {
      dates.push(`${year}-${monthNum}-${String(d).padStart(2, '0')}`)
    }
    return dates
  }

  // Single date: "Dec 25"
  const singleMatch = trimmed.match(/^(\w{3})\s+(\d{1,2})$/)
  if (singleMatch) {
    const [, month, day] = singleMatch
    const monthNum = months[month]
    if (!monthNum) return []
    return [`${year}-${monthNum}-${String(parseInt(day)).padStart(2, '0')}`]
  }

  return []
}

export default function CalendarPage() {
  const { activeDataset, setPageDataset } = useFilterContext()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [autoLoading, setAutoLoading] = useState(false)
  const [manualTasks, setManualTasks] = useState<{id: string; title: string; dueDate: string}[]>([])
  const [holidays, setHolidays] = useState<HolidayEntry[]>([])
  const [showHolidays, setShowHolidays] = useState(true)
  const [holidayLocation, setHolidayLocation] = useState('United States')
  const [availableLocations, setAvailableLocations] = useState<string[]>([])
  const { dismissed, dismiss, restore, restoreAll } = useDismissed('calendar')

  // Auto-load data from default Stories JQL if nothing is loaded
  useEffect(() => {
    if (activeDataset.length === 0 && !autoLoading) {
      setAutoLoading(true)
      const defaultJql = getDefaultQuery('stories', 'project = OMPE AND issuetype in (Story, "Sprint Goal", Release, Bug) AND (duedate is not EMPTY OR "Start date" is not EMPTY) AND status != Done ORDER BY duedate ASC')
      axios.get('/api/jira/query', { params: { jql: defaultJql } })
        .then(res => {
          if (res.data.issues && res.data.issues.length > 0) {
            setPageDataset('_calendar_auto', res.data.issues)
          }
        })
        .catch(() => {})
        .finally(() => setAutoLoading(false))
    }
  }, [])

  function handleRefresh() {
    setAutoLoading(true)
    const defaultJql = getDefaultQuery('stories', 'project = OMPE AND issuetype in (Story, "Sprint Goal", Release, Bug) AND (duedate is not EMPTY OR "Start date" is not EMPTY) AND status != Done ORDER BY duedate ASC')
    axios.get('/api/jira/query', { params: { jql: defaultJql, refresh: 'true' } })
      .then(res => {
        if (res.data.issues && res.data.issues.length > 0) {
          setPageDataset('_calendar_auto', res.data.issues)
        }
      })
      .catch(() => {})
      .finally(() => setAutoLoading(false))
  }

  // Fetch holidays
  useEffect(() => {
    axios.get('/api/jira/holidays')
      .then(res => {
        const data: HolidayEntry[] = Array.isArray(res.data) ? res.data : []
        setHolidays(data)
        // Extract unique locations
        const locs = [...new Set(data.map(h => h.location).filter(Boolean))].sort()
        setAvailableLocations(locs)
      })
      .catch(() => {})
  }, [])

  // Fetch manual tasks with due dates
  useEffect(() => {
    axios.get('/api/daily-tasks/calendar/manual')
      .then(res => setManualTasks(res.data.tasks || []))
      .catch(() => {})
  }, [])

  if (activeDataset.length === 0 && autoLoading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Calendar</h1>
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading calendar data...
        </div>
      </div>
    )
  }

  if (activeDataset.length === 0 && !autoLoading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Calendar</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium">No active dataset</p>
            <p className="text-amber-600 text-sm mt-1">
              Navigate to any data page (Stories, Releases, Sprint Goals, Bugs) and run a query.
              All results will appear here automatically.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Build calendar events from active dataset (excluding dismissed)
  const events: CalendarEvent[] = []
  for (const item of activeDataset) {
    if (dismissed.includes(item.key)) continue
    if (item.startDate) {
      events.push({
        key: item.key,
        summary: item.summary,
        date: item.startDate,
        dateType: 'start',
        issueType: item.type || 'Story',
        status: item.status,
        statusCategory: item.statusCategory,
        assignee: item.assignee
      })
    }
    if (item.dueDate) {
      events.push({
        key: item.key,
        summary: item.summary,
        date: item.dueDate,
        dateType: 'due',
        issueType: item.type || 'Story',
        status: item.status,
        statusCategory: item.statusCategory,
        assignee: item.assignee
      })
    }
  }

  // Add manual tasks with due dates
  for (const task of manualTasks) {
    if (task.dueDate) {
      events.push({
        key: `manual-${task.id}`,
        summary: task.title,
        date: task.dueDate,
        dateType: 'due',
        issueType: 'Manual',
        status: 'To Do',
        statusCategory: 'new',
        assignee: 'Me'
      })
    }
  }

  // Add NVIDIA holidays (deduplicated)
  if (showHolidays && holidays.length > 0) {
    const currentYear = new Date().getFullYear()
    const filteredHolidays = holidays.filter(h => {
      // Default filter: United States location OR entries with "NVIDIA" in title from all locations
      if (holidayLocation === '__all__') return true
      return h.location === holidayLocation || h.title.includes('NVIDIA')
    })

    // Group holidays by date+title to deduplicate NVIDIA Free Days and annotate country-specific ones
    const holidayMap = new Map<string, { title: string; locations: Set<string>; isNvidiaFreeDay: boolean }>()
    for (const holiday of filteredHolidays) {
      const dates = parseHolidayDates(holiday.date, currentYear)
      const isNvidiaFreeDay = /^NVIDIA Free Day/i.test(holiday.title)
      for (const dateStr of dates) {
        const mapKey = `${dateStr}||${isNvidiaFreeDay ? 'NVIDIA Free Days' : holiday.title}`
        if (!holidayMap.has(mapKey)) {
          holidayMap.set(mapKey, {
            title: isNvidiaFreeDay ? 'NVIDIA Free Days' : holiday.title,
            locations: new Set(),
            isNvidiaFreeDay
          })
        }
        holidayMap.get(mapKey)!.locations.add(holiday.location)
      }
    }

    for (const [mapKey, entry] of holidayMap.entries()) {
      const dateStr = mapKey.split('||')[0]
      let displayTitle: string
      if (entry.isNvidiaFreeDay) {
        // Company-wide — show once without country
        displayTitle = 'NVIDIA Free Days'
      } else if (entry.locations.size === 1) {
        displayTitle = `${entry.title} (${[...entry.locations][0]})`
      } else {
        displayTitle = entry.title
      }
      events.push({
        key: `holiday-${entry.title}-${dateStr}`,
        summary: displayTitle,
        date: dateStr,
        dateType: 'holiday',
        issueType: 'Holiday',
        status: 'Holiday',
        statusCategory: 'holiday',
        assignee: [...entry.locations].join(', ')
      })
    }
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDay = getDay(monthStart)

  function getEventsForDay(date: Date): CalendarEvent[] {
    const dateStr = format(date, 'yyyy-MM-dd')
    return events.filter(e => e.date === dateStr)
  }

  // Sort: Holidays first, then Releases, then Sprint Goals, then others
  function sortEvents(evs: CalendarEvent[]): CalendarEvent[] {
    const priority: Record<string, number> = { Holiday: -1, Release: 0, 'Sprint Goal': 1, Story: 2, Bug: 3 }
    return evs.sort((a, b) => (priority[a.issueType] ?? 4) - (priority[b.issueType] ?? 4))
  }

  // Check if a day has a holiday
  function dayHasHoliday(date: Date): boolean {
    const dateStr = format(date, 'yyyy-MM-dd')
    return events.some(e => e.date === dateStr && e.issueType === 'Holiday')
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">
            Showing dates from {activeDataset.length} items across all data pages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={autoLoading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition disabled:opacity-50"
            title="Refresh data from Jira (bypass cache)"
          >
            <RefreshCw className={`w-4 h-4 ${autoLoading ? 'animate-spin' : ''}`} />
            🔄
          </button>
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold text-gray-800 min-w-[160px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Holiday Controls */}
      <div className="mb-4 flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-lg px-4 py-2">
        <label className="flex items-center gap-2 text-sm font-medium text-violet-800">
          <input
            type="checkbox"
            checked={showHolidays}
            onChange={e => setShowHolidays(e.target.checked)}
            className="rounded border-violet-300 text-violet-600 focus:ring-violet-500"
          />
          🏖️ NVIDIA Holidays
        </label>
        {showHolidays && (
          <select
            value={holidayLocation}
            onChange={e => setHolidayLocation(e.target.value)}
            className="text-sm border border-violet-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-violet-400 outline-none"
          >
            <option value="United States">United States</option>
            <option value="__all__">All Locations</option>
            {availableLocations.filter(l => l !== 'United States').map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-[0.5fr_1fr_1fr_1fr_1fr_1fr_0.5fr] border-b border-gray-200 bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase text-center">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-[0.5fr_1fr_1fr_1fr_1fr_1fr_0.5fr]">
          {/* Empty cells for days before month start */}
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50/50"></div>
          ))}

          {days.map(day => {
            const dayEvents = sortEvents(getEventsForDay(day))
            const today = isToday(day)
            const dayOfWeek = getDay(day)
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
            const hasHoliday = dayHasHoliday(day)
            return (
              <div
                key={day.toISOString()}
                className={`${isWeekend ? 'min-h-[100px]' : 'min-h-[160px]'} border-b border-r border-gray-100 p-1 overflow-hidden ${hasHoliday ? 'bg-violet-50/60' : today ? 'bg-[#76B900]/5' : isWeekend ? 'bg-gray-50/80' : 'hover:bg-gray-50'}`}
              >
                <div className={`text-xs font-medium mb-1 px-1 ${today ? 'text-[#76B900] font-bold' : isWeekend ? 'text-gray-400' : 'text-gray-600'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5 overflow-y-auto max-h-[140px]">
                  {dayEvents.slice(0, 8).map((ev, i) => {
                    const colors = typeColors[ev.issueType] || defaultTypeColor
                    const isRelease = ev.issueType === 'Release'
                    const isHoliday = ev.issueType === 'Holiday'
                    if (isHoliday) {
                      return (
                        <div
                          key={`${ev.key}-${i}`}
                          className={`block px-1.5 py-0.5 rounded text-[10px] truncate border ${colors.bg} ${colors.text} ${colors.border} font-medium`}
                          title={`${ev.summary} (${ev.assignee})`}
                        >
                          🏖️ {ev.summary}
                        </div>
                      )
                    }
                    return (
                      <div key={`${ev.key}-${ev.dateType}-${i}`} className="flex items-center gap-0.5 group">
                        <a
                          href={ev.key.startsWith('manual-') ? undefined : `https://jirasw.nvidia.com/browse/${ev.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex-1 block px-1.5 py-0.5 rounded text-[10px] truncate border ${colors.bg} ${colors.text} ${colors.border} hover:opacity-80 ${isRelease ? 'font-bold' : ''}`}
                          title={`${dateTypeIcons[ev.dateType]} ${ev.issueType} | ${ev.key}: ${ev.summary} (${ev.assignee})`}
                        >
                          {isRelease ? '🚀 ' : dateTypeIcons[ev.dateType] + ' '}{ev.key} {ev.summary.length > 15 ? ev.summary.slice(0, 15) + '…' : ev.summary}
                        </a>
                        {!ev.key.startsWith('manual-') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (window.confirm(`Hide ${ev.key} from this view? (This won't change anything in Jira)`)) {
                                dismiss(ev.key)
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors"
                            title={`Hide ${ev.key}`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {dayEvents.length > 8 && (
                    <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 8} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-gray-500 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-100 border border-purple-300"></div> Release
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-indigo-100 border border-indigo-300"></div> Sprint Goal
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div> Story
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div> Bug
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div> Manual Task
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-violet-100 border border-violet-300"></div> NVIDIA Holiday
        </div>
        <div className="ml-4 flex items-center gap-2">
          <span>▶ Start</span>
          <span>◼ Due</span>
        </div>
      </div>
      <DismissedPanel dismissed={dismissed} onRestore={restore} onRestoreAll={restoreAll} />
    </div>
  )
}
