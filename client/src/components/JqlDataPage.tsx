import { useState, useEffect } from 'react'
import axios from 'axios'
import { ExternalLink, Filter, RefreshCw, Save, Star, Trash2, Search } from 'lucide-react'
import MultiSelect from './MultiSelect'
import { useFilterContext } from '../context/FilterContext'
import type { FilteredIssue } from '../context/FilterContext'
import { useSavedQueries, getDefaultQuery } from '../lib/savedQueries'

interface JqlDataPageProps {
  pageId: string
  title: string
  subtitle?: string
  defaultJql: string
  feedsDownstream?: boolean
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
  statusUpdate: string | null
  devTeam: string | null
  programManager: string | null
  productManager: string | null
  engPic: string | null
  links: any[]
}

interface FilterOptions {
  assignees: string[]
  devTeams: string[]
  programManagers: string[]
  productManagers: string[]
  engPics: string[]
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

export default function JqlDataPage({ pageId, title, subtitle, defaultJql, feedsDownstream = false }: JqlDataPageProps) {
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

  // Filters
  const [devTeamFilter, setDevTeamFilter] = useState<string[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([])
  const [programManagerFilter, setProgramManagerFilter] = useState<string[]>([])
  const [productManagerFilter, setProductManagerFilter] = useState<string[]>([])
  const [engPicFilter, setEngPicFilter] = useState<string[]>([])
  const [topNLimit, setTopNLimit] = useState<number>(0)

  const { setActiveDataset } = useFilterContext()
  const { queries, save, remove } = useSavedQueries(pageId)

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

  // Update downstream when issues or filters change
  useEffect(() => {
    if (feedsDownstream) {
      const filtered = applyClientFilters(issues)
      setActiveDataset(filtered as FilteredIssue[])
    }
  }, [issues, devTeamFilter, assigneeFilter, programManagerFilter, productManagerFilter, engPicFilter, topNLimit, feedsDownstream])

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
    if (topNLimit > 0) {
      filtered = filtered.slice(0, topNLimit)
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

  const filteredIssues = applyClientFilters(issues)

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
          {feedsDownstream && (
            <span className="ml-auto text-xs text-[#76B900] font-medium">
              ● Feeds Gantt / Calendar / Dependencies / Email ({filteredIssues.length} items)
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
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
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Top N (Priority)</label>
            <input
              type="number"
              min={0}
              max={500}
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Key</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Summary</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignee</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Dev Team</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Start</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Due</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading...
                </td>
              </tr>
            ) : filteredIssues.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  No issues found. Try adjusting your JQL or filters.
                </td>
              </tr>
            ) : (
              filteredIssues.map(issue => (
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
                  <td className="px-4 py-3 text-sm text-gray-600">{issue.assignee}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{issue.devTeam || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{issue.startDate || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{issue.dueDate || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="mt-4 text-sm text-gray-500">
          Showing {filteredIssues.length} of {issues.length} issues
        </div>
      )}
    </div>
  )
}
