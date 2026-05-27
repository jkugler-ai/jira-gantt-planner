import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { ExternalLink, Filter, RefreshCw, Save, Star, Trash2, Search, ChevronUp, ChevronDown } from 'lucide-react'
import MultiSelect from './MultiSelect'
import { useFilterContext } from '../context/FilterContext'
import type { FilteredIssue } from '../context/FilterContext'
import { useSavedQueries, getDefaultQuery } from '../lib/savedQueries'

interface JqlDataPageProps {
  pageId: string
  title: string
  subtitle?: string
  defaultJql: string
  extraColumns?: string[]
}

interface JiraIssue {
  key: string
  summary: string
  type?: string
  status: string
  statusCategory: string
  assignee: string
  assigneeKey: string
  priority: string
  priorityRank?: number | null
  dueDate: string | null
  startDate: string | null
  created: string | null
  statusUpdate: string | null
  devTeam: string | null
  programManager: string | null
  productManager: string | null
  engPic: string | null
  fixVersion: string | null
  links: any[]
}

interface FilterOptions {
  assignees: string[]
  devTeams: string[]
  programManagers: string[]
  productManagers: string[]
  engPics: string[]
}

type SortField = 'key' | 'type' | 'summary' | 'status' | 'assignee' | 'devTeam' | 'startDate' | 'dueDate' | 'priority' | 'fixVersion' | 'created'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest']

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

function PriorityBadge({ priority }: { priority: string }) {
  const colorMap: Record<string, string> = {
    Highest: 'text-red-600',
    High: 'text-orange-500',
    Medium: 'text-yellow-600',
    Low: 'text-blue-500',
    Lowest: 'text-gray-400',
  }
  return (
    <span className={`text-xs font-medium ${colorMap[priority] || 'text-gray-500'}`}>
      {priority || '—'}
    </span>
  )
}

function getNvbugsLink(links: any[]): React.ReactNode {
  // Look for NVBugs references in issue links
  for (const link of links) {
    const linked = link.inwardIssue || link.outwardIssue
    if (linked) {
      const key = linked.key || ''
      // NVBugs tickets often have a specific pattern or are in a separate project
      if (key.toLowerCase().includes('nvbug') || (link.type?.name || '').toLowerCase().includes('nvbug')) {
        return (
          <a href={`https://nvbugs.nvidia.com/${key}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] hover:underline text-xs">
            {key}
          </a>
        )
      }
    }
    // Also check for summary text that contains NVBugs ID pattern
    const summary = (link.inwardIssue?.fields?.summary || link.outwardIssue?.fields?.summary || '')
    const nvbugMatch = summary.match(/(?:NVBug|nvbug)[s]?[:\s#]*(\d+)/i)
    if (nvbugMatch) {
      return (
        <a href={`https://nvbugs.nvidia.com/${nvbugMatch[1]}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] hover:underline text-xs">
          {nvbugMatch[1]}
        </a>
      )
    }
  }
  return <span className="text-gray-400">—</span>
}

function SortHeader({ field, label, current, dir, onClick }: {
  field: SortField
  label: string
  current: SortField | null
  dir: SortDir
  onClick: (f: SortField) => void
}) {
  const isActive = current === field
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none"
      onClick={() => onClick(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive && (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  )
}

export default function JqlDataPage({ pageId, title, subtitle, defaultJql, extraColumns = [] }: JqlDataPageProps) {
  const [jql, setJql] = useState('')
  const [jqlInput, setJqlInput] = useState('')
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    assignees: [], devTeams: [], programManagers: [], productManagers: [], engPics: []
  })
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveQueryName, setSaveQueryName] = useState('')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Filters
  const [devTeamFilter, setDevTeamFilter] = useState<string[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([])
  const [programManagerFilter, setProgramManagerFilter] = useState<string[]>([])
  const [productManagerFilter, setProductManagerFilter] = useState<string[]>([])
  const [engPicFilter, setEngPicFilter] = useState<string[]>([])

  const { setPageDataset } = useFilterContext()
  const { queries, save, remove } = useSavedQueries(pageId)

  // Which extra columns to show
  const showPriority = extraColumns.includes('priority')
  const showFixVersion = extraColumns.includes('fixVersion')
  const showCreated = extraColumns.includes('created')
  const showNvbugs = extraColumns.includes('nvbugs')

  // Initialize JQL from saved default or page default
  useEffect(() => {
    const initial = getDefaultQuery(pageId, defaultJql)
    setJql(initial)
    setJqlInput(initial)
  }, [pageId, defaultJql])

  // Fetch data when JQL changes
  useEffect(() => {
    if (jql) fetchData()
  }, [jql])

  // Build filter options from current results
  useEffect(() => {
    const assignees = new Set<string>()
    const devTeams = new Set<string>()
    const programManagers = new Set<string>()
    const productManagers = new Set<string>()
    const engPics = new Set<string>()

    issues.forEach(issue => {
      if (issue.assignee && issue.assignee !== 'Unassigned') assignees.add(issue.assignee)
      if (issue.devTeam) devTeams.add(issue.devTeam)
      if (issue.programManager) programManagers.add(issue.programManager)
      if (issue.productManager) productManagers.add(issue.productManager)
      if (issue.engPic) engPics.add(issue.engPic)
    })

    setFilterOptions({
      assignees: [...assignees].sort(),
      devTeams: [...devTeams].sort(),
      programManagers: [...programManagers].sort(),
      productManagers: [...productManagers].sort(),
      engPics: [...engPics].sort()
    })
  }, [issues])

  // Update downstream dataset for this page whenever issues or filters change
  useEffect(() => {
    const filtered = applyClientFilters(issues)
    setPageDataset(pageId, filtered as FilteredIssue[])
  }, [issues, devTeamFilter, assigneeFilter, programManagerFilter, productManagerFilter, engPicFilter])

  // Fetch filter options
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

  function applyClientFilters(data: JiraIssue[]): JiraIssue[] {
    let filtered = [...data]
    if (devTeamFilter.length > 0) {
      filtered = filtered.filter(i => i.devTeam && devTeamFilter.includes(i.devTeam))
    }
    if (assigneeFilter.length > 0) {
      filtered = filtered.filter(i => assigneeFilter.includes(i.assignee))
    }
    if (programManagerFilter.length > 0) {
      filtered = filtered.filter(i => i.programManager && programManagerFilter.includes(i.programManager))
    }
    if (productManagerFilter.length > 0) {
      filtered = filtered.filter(i => i.productManager && productManagerFilter.includes(i.productManager))
    }
    if (engPicFilter.length > 0) {
      filtered = filtered.filter(i => i.engPic && engPicFilter.includes(i.engPic))
    }
    return filtered
  }

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const res = await axios.get('/api/jira/query', { params: { jql } })
      setIssues(res.data.issues)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  function handleJqlSubmit(e: React.FormEvent) {
    e.preventDefault()
    setJql(jqlInput)
  }

  function handleSaveQuery(asDefault: boolean) {
    if (!saveQueryName.trim()) return
    save({ name: saveQueryName.trim(), jql: jqlInput, isDefault: asDefault })
    setShowSaveDialog(false)
    setSaveQueryName('')
  }

  function handleLoadQuery(savedJql: string) {
    setJqlInput(savedJql)
    setJql(savedJql)
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const filteredIssues = applyClientFilters(issues)

  // Apply sorting
  const sortedIssues = useMemo(() => {
    if (!sortField) return filteredIssues
    const sorted = [...filteredIssues]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'key': cmp = a.key.localeCompare(b.key); break
        case 'type': cmp = (a.type || '').localeCompare(b.type || ''); break
        case 'summary': cmp = a.summary.localeCompare(b.summary); break
        case 'status': cmp = (a.status || '').localeCompare(b.status || ''); break
        case 'assignee': cmp = (a.assignee || '').localeCompare(b.assignee || ''); break
        case 'devTeam': cmp = (a.devTeam || '').localeCompare(b.devTeam || ''); break
        case 'startDate': {
          const da = a.startDate ? new Date(a.startDate).getTime() : Infinity
          const db = b.startDate ? new Date(b.startDate).getTime() : Infinity
          cmp = da - db
          break
        }
        case 'dueDate': {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
          cmp = da - db
          break
        }
        case 'priority': {
          cmp = PRIORITY_ORDER.indexOf(a.priority || 'Medium') - PRIORITY_ORDER.indexOf(b.priority || 'Medium')
          break
        }
        case 'fixVersion': {
          cmp = (a.fixVersion || '').localeCompare(b.fixVersion || '')
          break
        }
        case 'created': {
          const ca = a.created ? new Date(a.created).getTime() : 0
          const cb = b.created ? new Date(b.created).getTime() : 0
          cmp = ca - cb
          break
        }
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return sorted
  }, [filteredIssues, sortField, sortDir])

  const colSpan = 8 + (showPriority ? 1 : 0) + (showFixVersion ? 1 : 0) + (showCreated ? 1 : 0) + (showNvbugs ? 1 : 0)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* JQL Input */}
      <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
        <form onSubmit={handleJqlSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={jqlInput}
              onChange={e => setJqlInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#76B900] outline-none"
              placeholder="Enter JQL query..."
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[#76B900] text-white text-sm font-medium rounded-lg hover:bg-[#5a8f00] transition"
          >
            Run
          </button>
          <button
            type="button"
            onClick={() => setShowSaveDialog(true)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            title="Save query"
          >
            <Save className="w-4 h-4 text-gray-600" />
          </button>
        </form>

        {/* Saved queries */}
        {queries.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {queries.map(q => (
              <div key={q.name} className="inline-flex items-center gap-1 group">
                <button
                  onClick={() => handleLoadQuery(q.jql)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    q.isDefault
                      ? 'bg-[#76B900]/15 text-[#76B900] border border-[#76B900]/30'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={q.jql}
                >
                  {q.isDefault && <Star className="w-3 h-3 inline mr-1" />}
                  {q.name}
                </button>
                <button
                  onClick={() => remove(q.name)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Save dialog */}
        {showSaveDialog && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={saveQueryName}
                onChange={e => setSaveQueryName(e.target.value)}
                placeholder="Query name..."
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#76B900] outline-none"
                autoFocus
              />
              <button
                onClick={() => handleSaveQuery(false)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50"
              >
                Save
              </button>
              <button
                onClick={() => handleSaveQuery(true)}
                className="px-3 py-1.5 bg-[#76B900] text-white rounded-lg text-xs font-medium hover:bg-[#5a8f00]"
              >
                Save as Default
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Quick Filters</span>
          <span className="ml-auto text-xs text-[#76B900] font-medium">
            ● Feeds Calendar / Gantt / Dependencies / Email ({filteredIssues.length} items)
          </span>
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
          <MultiSelect
            label="Eng PIC"
            options={filterOptions.engPics}
            selected={engPicFilter}
            onChange={setEngPicFilter}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <SortHeader field="key" label="Key" current={sortField} dir={sortDir} onClick={handleSort} />
                <SortHeader field="type" label="Type" current={sortField} dir={sortDir} onClick={handleSort} />
                <SortHeader field="summary" label="Summary" current={sortField} dir={sortDir} onClick={handleSort} />
                <SortHeader field="status" label="Status" current={sortField} dir={sortDir} onClick={handleSort} />
                {showPriority && (
                  <SortHeader field="priority" label="Priority" current={sortField} dir={sortDir} onClick={handleSort} />
                )}
                <SortHeader field="assignee" label="Assignee" current={sortField} dir={sortDir} onClick={handleSort} />
                <SortHeader field="devTeam" label="Dev Team" current={sortField} dir={sortDir} onClick={handleSort} />
                {showFixVersion && (
                  <SortHeader field="fixVersion" label="Fix Version" current={sortField} dir={sortDir} onClick={handleSort} />
                )}
                {showCreated && (
                  <SortHeader field="created" label="Created" current={sortField} dir={sortDir} onClick={handleSort} />
                )}
                {showNvbugs && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">NVBugs</th>
                )}
                <SortHeader field="startDate" label="Start" current={sortField} dir={sortDir} onClick={handleSort} />
                <SortHeader field="dueDate" label="Due" current={sortField} dir={sortDir} onClick={handleSort} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading...
                  </td>
                </tr>
              ) : sortedIssues.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-500">
                    No issues found. Try adjusting your JQL or filters.
                  </td>
                </tr>
              ) : (
                sortedIssues.map(issue => (
                  <tr key={issue.key} className="hover:bg-gray-50 border-b border-gray-100 transition">
                    <td className="px-4 py-3">
                      <a
                        href={`https://jirasw.nvidia.com/browse/${issue.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#76B900] font-medium hover:underline flex items-center gap-1 text-sm"
                      >
                        {issue.key}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{issue.type || '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-md truncate">{issue.summary}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={issue.status} category={issue.statusCategory} />
                    </td>
                    {showPriority && (
                      <td className="px-4 py-3">
                        <PriorityBadge priority={issue.priority} />
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-600">{issue.assignee}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{issue.devTeam || '—'}</td>
                    {showFixVersion && (
                      <td className="px-4 py-3 text-sm text-gray-500">{issue.fixVersion || '—'}</td>
                    )}
                    {showCreated && (
                      <td className="px-4 py-3 text-sm text-gray-500">{issue.created || '—'}</td>
                    )}
                    {showNvbugs && (
                      <td className="px-4 py-3 text-sm">
                        {getNvbugsLink(issue.links)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-500">{issue.startDate || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{issue.dueDate || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="mt-4 text-sm text-gray-500">
          Showing {sortedIssues.length} of {issues.length} issues
          {sortField && <span className="ml-2 text-gray-400">• Sorted by {sortField} ({sortDir})</span>}
        </div>
      )}
    </div>
  )
}
