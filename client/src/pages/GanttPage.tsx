import { useState, useRef } from 'react'
import { format, addDays, differenceInDays } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { useFilterContext } from '../context/FilterContext'

type ZoomLevel = 'week' | 'month' | 'quarter'

export default function GanttPage() {
  const { activeDataset } = useFilterContext()
  const [zoom, setZoom] = useState<ZoomLevel>('month')
  const containerRef = useRef<HTMLDivElement>(null)

  // Only items with at least one date
  const items = activeDataset.filter(i => i.startDate || i.dueDate)

  if (activeDataset.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Gantt Chart</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium">No active dataset</p>
            <p className="text-amber-600 text-sm mt-1">
              Expand sprint goals on the Sprint Goals page to populate data for this view.
              The Gantt chart will display the user stories you've expanded there.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Calculate date range
  const allDates = items.flatMap(i => [i.startDate, i.dueDate].filter(Boolean)) as string[]
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => new Date(d).getTime()))) : new Date()
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))) : addDays(new Date(), 90)

  const rangeStart = addDays(minDate, -7)
  const rangeEnd = addDays(maxDate, 14)
  const totalDays = differenceInDays(rangeEnd, rangeStart)

  const dayWidth = zoom === 'week' ? 40 : zoom === 'month' ? 16 : 6
  const chartWidth = totalDays * dayWidth

  function getBarStyle(item: typeof items[0]) {
    const start = item.startDate ? new Date(item.startDate) : item.dueDate ? addDays(new Date(item.dueDate), -14) : rangeStart
    const end = item.dueDate ? new Date(item.dueDate) : addDays(start, 14)
    const left = differenceInDays(start, rangeStart) * dayWidth
    const width = Math.max(differenceInDays(end, start) * dayWidth, dayWidth)

    const colorMap: Record<string, string> = {
      done: '#10b981',
      indeterminate: '#f59e0b',
      new: '#94a3b8',
    }
    const color = colorMap[item.statusCategory] || '#76B900'

    return { left, width, color }
  }

  // Detect overbooked: same assignee overlapping dates
  function isOverbooked(item: typeof items[0]): boolean {
    if (!item.assigneeKey || !item.startDate || !item.dueDate) return false
    return items.some(other =>
      other.key !== item.key &&
      other.assigneeKey === item.assigneeKey &&
      other.startDate && other.dueDate &&
      new Date(other.startDate) <= new Date(item.dueDate!) &&
      new Date(other.dueDate) >= new Date(item.startDate!)
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gantt Chart</h1>
          <p className="text-gray-500 text-sm mt-1">
            Showing {items.length} stories with dates (from {activeDataset.length} in active dataset) • <span className="text-red-500 font-medium">Red borders</span> = overbooked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom('week')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${zoom === 'week' ? 'bg-[#76B900] text-white border-[#76B900]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >Week</button>
          <button
            onClick={() => setZoom('month')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${zoom === 'month' ? 'bg-[#76B900] text-white border-[#76B900]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >Month</button>
          <button
            onClick={() => setZoom('quarter')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${zoom === 'quarter' ? 'bg-[#76B900] text-white border-[#76B900]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >Quarter</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex">
          {/* Left panel: issue list */}
          <div className="w-80 border-r border-gray-200 flex-shrink-0">
            <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center px-4">
              <span className="text-xs font-semibold text-gray-500 uppercase">Issue</span>
            </div>
            {items.map(item => (
              <div
                key={item.key}
                className="h-10 flex items-center px-4 border-b border-gray-50 hover:bg-gray-50"
              >
                <a
                  href={`https://jirasw.nvidia.com/browse/${item.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#76B900] font-medium hover:underline mr-2"
                >
                  {item.key}
                </a>
                <span className="text-xs text-gray-700 truncate">{item.summary}</span>
              </div>
            ))}
          </div>

          {/* Right panel: gantt bars */}
          <div className="flex-1 overflow-x-auto" ref={containerRef}>
            {/* Header with dates */}
            <div className="h-12 bg-gray-50 border-b border-gray-200 relative" style={{ width: chartWidth }}>
              {Array.from({ length: Math.ceil(totalDays / 30) }).map((_, i) => {
                const d = addDays(rangeStart, i * 30)
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center text-xs text-gray-500 font-medium border-l border-gray-200 px-2"
                    style={{ left: i * 30 * dayWidth }}
                  >
                    {format(d, 'MMM yyyy')}
                  </div>
                )
              })}
            </div>

            {/* Bars */}
            <div className="relative" style={{ width: chartWidth }}>
              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 opacity-60"
                style={{ left: differenceInDays(new Date(), rangeStart) * dayWidth }}
              />

              {items.map(item => {
                const { left, width, color } = getBarStyle(item)
                const overbooked = isOverbooked(item)
                return (
                  <div key={item.key} className="h-10 relative flex items-center border-b border-gray-50">
                    <div
                      className={`absolute h-6 rounded-md shadow-sm flex items-center px-2 text-[10px] text-white font-medium truncate transition-all hover:shadow-md ${overbooked ? 'ring-2 ring-red-500' : ''}`}
                      style={{
                        left,
                        width,
                        backgroundColor: color,
                      }}
                      title={`${item.key}: ${item.summary}\n${item.assignee}\n${item.startDate || '?'} → ${item.dueDate || '?'}${overbooked ? '\n⚠️ OVERBOOKED' : ''}`}
                    >
                      {width > 80 ? item.summary.slice(0, 20) : item.key}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500"></div> Done
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-500"></div> In Progress
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-slate-400"></div> To Do
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#76B900]"></div> Active
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-red-500"></div> Overbooked
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 bg-red-400"></div> Today
        </div>
      </div>
    </div>
  )
}
