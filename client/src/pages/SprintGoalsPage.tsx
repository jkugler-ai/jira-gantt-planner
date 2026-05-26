import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { ChevronRight, ChevronDown, ExternalLink, Filter, RefreshCw } from 'lucide-react'
import MultiSelect from '../components/MultiSelect'
import { useFilterContext } from '../context/FilterContext'
import type { FilteredIssue } from '../context/FilterContext'

interface SprintGoal {
  key: string
  summary: string
  status: string
  statusCategory: string
  assignee: string
  assigneeKey: string
  priority: string
  priorityRank: number | null
  dueDate: string | null
  startDate: string | null
  statusUpdate: string | null
  devTeam: string | null
  programManager: string | null
  productManager: string | null
  links: any[]
}

interface ChildIssue extends SprintGoal {
  type: string
}

interface FilterOptions {
  assignees: string[]
  devTeams: string[]
  programManagers: string[]
  productManagers: string[]
}

function StatusBadge({ status, category }: { status: string; category: string }) {
  const colorMap: Record<string, string> = {
    done: 'bg-emerald-100 text-emerald-800',
    indeterminate: 'bg-amber-100 text-amber-800',
    new: 'bg-gray-100 text-gray-700',
  }
  const colors = colorMap[category] || 'bg-blue-100 text-blue-800'
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {status}
    </span>
  )
}

function RoleBadge({ username }: { username: string }) {
  const roles: Record<string, { label: string; color: string }> = {
    dlindsey: { label: 'PM', color: 'bg-purple-100 text-purple-700' },
    kilyas: { label: 'PM', color: 'bg-purple-100 text-purple-700' },
    jkugler: { label: 'PgM', color: 'bg-blue-100 text-blue-700' },
    njohns: { label: 'Eng', color: 'bg-orange-100 text-orange-700' },
    dmitria: { label: 'Eng', color: 'bg-orange-100 text-orange-700' },
    dduka: { label: 'Eng', color: 'bg-orange-100 text-orange-700' },
    manskif: { label: 'Eng', color: 'bg-orange-100 text-orange-700' },
    gmahoney: { label: 'Eng', color: 'bg-orange-100 text-orange-700' },
  }
  const role = roles[username]
  if (!role) return null
  return (
    <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${role.color}`}>
      {role.label}
    </span>
  )
}

function SprintGoalRow({ goal, onChildrenLoaded, onChildrenRemoved }: {
  goal: SprintGoal
  onChildrenLoaded: (parentKey: string, children: ChildIssue[]) => void
  onChildrenRemoved: (parentKey: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<ChildIssue[]>([])
  const [loadingChildren, setLoadingChildren] = useState(false)

  async function toggleExpand() {
    if (!expanded && children.length === 0) {
      setLoadingChildren(true)
      try {
        const res = await axios.get(`/api/jira/children/${goal.key}`)
        setChildren(res.data.children)
        onChildrenLoaded(goal.key, res.data.children)
      } catch (err) {
        console.error('Failed to load children', err)
      } finally {
        setLoadingChildren(false)
      }
    }
    if (expanded) {
      onChildrenRemoved(goal.key)
    }
    setExpanded(!expanded)
  }

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition"
        onClick={toggleExpand}
      >
        <td className="px-4 py-3">
          <button className="text-gray-400 hover:text-gray-700">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-4 py-3">
          <a
            href={`https://jirasw.nvidia.com/browse/${goal.key}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#76B900] font-medium hover:underline flex items-center gap-1"
            onClick={e => e.stopPropagation()}
          >
            {goal.key}
            <ExternalLink className="w-3 h-3" />
          </a>
        </td>
        <td className="px-4 py-3 font-medium text-gray-900 max-w-md truncate">
          {goal.summary}
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={goal.status} category={goal.statusCategory} />
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {goal.assignee}
          <RoleBadge username={goal.assigneeKey} />
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{goal.devTeam || '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{goal.startDate || '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{goal.dueDate || '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={goal.statusUpdate || ''}>
          {goal.statusUpdate || '—'}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="px-0 py-0">
            <div className="bg-gray-50/50 border-l-4 border-[#76B900]/30 ml-8 mr-4 my-1 rounded-lg">
              {loadingChildren ? (
                <div className="p-4 text-sm text-gray-500">Loading stories...</div>
              ) : children.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No child stories found</div>
              ) : (
                <table className="w-full">
                  <tbody>
                    {children.map(child => (
                      <tr key={child.key} className="border-b border-gray-100 last:border-0 hover:bg-white/50">
                        <td className="px-4 py-2 w-8">
                          <span className="text-xs text-gray-400">{child.type === 'Story' ? '📖' : '📋'}</span>
                        </td>
                        <td className="px-4 py-2">
                          <a
                            href={`https://jirasw.nvidia.com/browse/${child.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#76B900] text-sm hover:underline flex items-center gap-1"
                          >
                            {child.key}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-800">{child.summary}</td>
                        <td className="px-4 py-2">
                          <StatusBadge status={child.status} category={child.statusCategory} />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {child.assignee}
                          <RoleBadge username={child.assigneeKey} />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">{child.devTeam || '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{child.startDate || '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{child.dueDate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function SprintGoalsPage() {
  const [goals, setGoals] = useState<SprintGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    assignees: [], devTeams: [], programManagers: [], productManagers: []
  })

  // Multi-select filter state
  const [devTeamFilter, setDevTeamFilter] = useState<string[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([])
  const [programManagerFilter, setProgramManagerFilter] = useState<string[]>([])
  const [productManagerFilter, setProductManagerFilter] = useState<string[]>([])
  const [topNLimit, setTopNLimit] = useState<number>(0)

  // Track loaded children per goal for the active dataset
  const [childrenMap, setChildrenMap] = useState<Record<string, ChildIssue[]>>({})
  const { setActiveDataset } = useFilterContext()

  // Update active dataset whenever childrenMap changes
  useEffect(() => {
    const allChildren: FilteredIssue[] = Object.values(childrenMap).flat()
    setActiveDataset(allChildren)
  }, [childrenMap, setActiveDataset])

  const handleChildrenLoaded = useCallback((parentKey: string, children: ChildIssue[]) => {
    setChildrenMap(prev => ({ ...prev, [parentKey]: children }))
  }, [])

  const handleChildrenRemoved = useCallback((parentKey: string) => {
    setChildrenMap(prev => {
      const next = { ...prev }
      delete next[parentKey]
      return next
    })
  }, [])

  // Fetch filter options on mount
  useEffect(() => {
    async function fetchOptions() {
      try {
        const res = await axios.get('/api/jira/filter-options')
        setFilterOptions(res.data)
      } catch (err) {
        console.error('Failed to load filter options', err)
      }
    }
    fetchOptions()
  }, [])

  async function fetchGoals() {
    setLoading(true)
    setError('')
    setChildrenMap({})
    try {
      const params = new URLSearchParams()
      devTeamFilter.forEach(t => params.append('devTeam[]', t))
      assigneeFilter.forEach(a => params.append('assignee[]', a))
      programManagerFilter.forEach(p => params.append('programManager[]', p))
      productManagerFilter.forEach(p => params.append('productManager[]', p))
      if (topNLimit > 0) params.append('limit', String(topNLimit))
      const res = await axios.get(`/api/jira/sprint-goals?${params}`)
      setGoals(res.data.goals)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load sprint goals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGoals()
  }, [devTeamFilter, assigneeFilter, programManagerFilter, productManagerFilter, topNLimit])

  const activeCount = Object.values(childrenMap).flat().length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sprint Goals</h1>
          <p className="text-gray-500 text-sm mt-1">
            Click a goal to expand user stories • {activeCount > 0 ? (
              <span className="text-[#76B900] font-medium">{activeCount} stories in active dataset</span>
            ) : (
              'Expand goals to populate downstream views'
            )}
          </p>
        </div>
        <button
          onClick={fetchGoals}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MultiSelect
            label="Dev Team"
            options={filterOptions.devTeams}
            selected={devTeamFilter}
            onChange={setDevTeamFilter}
          />
          <MultiSelect
            label="Assignee"
            options={filterOptions.assignees}
            selected={assigneeFilter}
            onChange={setAssigneeFilter}
          />
          <MultiSelect
            label="Program Manager"
            options={filterOptions.programManagers}
            selected={programManagerFilter}
            onChange={setProgramManagerFilter}
          />
          <MultiSelect
            label="Product Manager"
            options={filterOptions.productManagers}
            selected={productManagerFilter}
            onChange={setProductManagerFilter}
          />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Top N (Priority Rank)</label>
            <input
              type="number"
              min={0}
              max={200}
              value={topNLimit || ''}
              onChange={e => setTopNLimit(parseInt(e.target.value) || 0)}
              placeholder="All"
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#76B900] outline-none h-[38px]"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Key</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Summary</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignee</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Dev Team</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Start</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Due</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status Update</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading sprint goals...
                </td>
              </tr>
            ) : goals.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  No sprint goals found. Try adjusting filters.
                </td>
              </tr>
            ) : (
              goals.map(goal => (
                <SprintGoalRow
                  key={goal.key}
                  goal={goal}
                  onChildrenLoaded={handleChildrenLoaded}
                  onChildrenRemoved={handleChildrenRemoved}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {!loading && goals.length > 0 && (
        <div className="mt-4 text-sm text-gray-500">
          Showing {goals.length} sprint goals
        </div>
      )}
    </div>
  )
}
