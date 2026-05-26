import { useFilterContext } from '../context/FilterContext'
import { GanttChart, Calendar, AlertTriangle, CheckCircle, Clock, Bug } from 'lucide-react'

export default function DashboardPage() {
  const { activeDataset, pageDatasets } = useFilterContext()

  const stories = pageDatasets['stories'] || []
  const releases = pageDatasets['releases'] || []
  const sprintGoals = pageDatasets['sprint-goals'] || []
  const bugs = pageDatasets['bugs'] || []

  const today = new Date()
  const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  // Stats
  const totalItems = activeDataset.length
  const done = activeDataset.filter(i => i.statusCategory === 'done')
  const inProgress = activeDataset.filter(i => i.statusCategory === 'indeterminate')
  const toDo = activeDataset.filter(i => i.statusCategory === 'new')
  const overdue = activeDataset.filter(i => i.dueDate && new Date(i.dueDate) < today && i.statusCategory !== 'done')
  const upcomingDue = activeDataset.filter(i => i.dueDate && new Date(i.dueDate) >= today && new Date(i.dueDate) <= twoWeeksOut && i.statusCategory !== 'done')

  // Health
  const totalActive = inProgress.length + toDo.length
  const overdueRatio = totalActive > 0 ? overdue.length / totalActive : 0
  let healthStatus = 'On Track'
  let healthColor = 'text-green-700'
  let healthBg = 'bg-green-50 border-green-200'
  if (overdueRatio > 0.3) { healthStatus = 'At Risk'; healthColor = 'text-red-700'; healthBg = 'bg-red-50 border-red-200'; }
  else if (overdueRatio > 0.1 || overdue.length > 2) { healthStatus = 'Needs Attention'; healthColor = 'text-amber-700'; healthBg = 'bg-amber-50 border-amber-200'; }

  if (totalItems === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium">No data loaded yet</p>
            <p className="text-amber-600 text-sm mt-1">
              Visit the data pages (Stories, Releases, Sprint Goals, Bugs) and run queries.
              This dashboard will automatically show a summary of all loaded data.
            </p>
          </div>
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
      <div className={`mb-6 p-4 rounded-xl border ${healthBg}`}>
        <div className="flex items-center gap-3">
          <div className={`text-lg font-bold ${healthColor}`}>{healthStatus}</div>
          <div className="text-sm text-gray-600">
            {done.length} completed • {inProgress.length} in progress • {toDo.length} to do • {overdue.length} overdue
          </div>
        </div>
      </div>

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
