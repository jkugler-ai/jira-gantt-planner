import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, getDay } from 'date-fns'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { useFilterContext } from '../context/FilterContext'

interface CalendarEvent {
  key: string
  summary: string
  date: string
  type: 'start' | 'due'
  status: string
  statusCategory: string
  assignee: string
}

export default function CalendarPage() {
  const { activeDataset } = useFilterContext()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  if (activeDataset.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Calendar</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium">No active dataset</p>
            <p className="text-amber-600 text-sm mt-1">
              Expand sprint goals on the Sprint Goals page to populate data for this view.
              The Calendar will display dates from the user stories you've expanded there.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Build calendar events from active dataset
  const events: CalendarEvent[] = []
  for (const item of activeDataset) {
    if (item.startDate) {
      events.push({
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
      events.push({
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
  }

  const typeLabels: Record<string, string> = {
    start: '▶',
    due: '◼',
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">
            Showing dates from {activeDataset.length} stories in active dataset
          </p>
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
      </div>
    </div>
  )
}
