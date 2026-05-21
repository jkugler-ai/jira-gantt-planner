import { useState, useEffect } from 'react'
import axios from 'axios'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, getDay } from 'date-fns'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

interface CalendarEvent {
  key: string
  summary: string
  date: string
  type: 'start' | 'due' | 'needby'
  status: string
  statusCategory: string
  assignee: string
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  async function fetchData() {
    setLoading(true)
    try {
      const res = await axios.get('/api/jira/gantt-data')
      const calEvents: CalendarEvent[] = []

      for (const item of res.data.items) {
        if (item.startDate) {
          calEvents.push({
            key: item.key,
            summary: item.summary,
            date: item.startDate,
            type: 'start',
            status: item.status,
            statusCategory: item.statusCategory,
            assignee: item.assignee
          })
        }
        if (item.dueDate) {
          calEvents.push({
            key: item.key,
            summary: item.summary,
            date: item.dueDate,
            type: 'due',
            status: item.status,
            statusCategory: item.statusCategory,
            assignee: item.assignee
          })
        }
      }
      setEvents(calEvents)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDay = getDay(monthStart)

  function getEventsForDay(date: Date): CalendarEvent[] {
    const dateStr = format(date, 'yyyy-MM-dd')
    return events.filter(e => e.date === dateStr)
  }

  const typeColors: Record<string, string> = {
    start: 'bg-blue-100 text-blue-700 border-blue-200',
    due: 'bg-red-100 text-red-700 border-red-200',
    needby: 'bg-purple-100 text-purple-700 border-purple-200',
  }

  const typeLabels: Record<string, string> = {
    start: '▶',
    due: '◼',
    needby: '◆',
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">Start dates, due dates, and milestones</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold text-gray-800 min-w-[160px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={fetchData} className="p-2 text-gray-400 hover:text-gray-700 ml-2">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase text-center">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells for days before month start */}
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-28 border-b border-r border-gray-100 bg-gray-50/50"></div>
          ))}

          {days.map(day => {
            const dayEvents = getEventsForDay(day)
            const today = isToday(day)
            return (
              <div
                key={day.toISOString()}
                className={`h-28 border-b border-r border-gray-100 p-1 overflow-hidden ${today ? 'bg-[#76B900]/5' : 'hover:bg-gray-50'}`}
              >
                <div className={`text-xs font-medium mb-1 px-1 ${today ? 'text-[#76B900] font-bold' : 'text-gray-600'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5 overflow-y-auto max-h-20">
                  {dayEvents.slice(0, 4).map((ev, i) => (
                    <a
                      key={`${ev.key}-${ev.type}-${i}`}
                      href={`https://jirasw.nvidia.com/browse/${ev.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block px-1.5 py-0.5 rounded text-[10px] truncate border ${typeColors[ev.type]} hover:opacity-80`}
                      title={`${typeLabels[ev.type]} ${ev.key}: ${ev.summary} (${ev.assignee})`}
                    >
                      {typeLabels[ev.type]} {ev.key}
                    </a>
                  ))}
                  {dayEvents.length > 4 && (
                    <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 4} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div> Start Date
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div> Due Date
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></div> Need By
        </div>
      </div>
    </div>
  )
}
