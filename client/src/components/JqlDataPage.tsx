import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { ExternalLink, Filter, RefreshCw, Save, Star, Trash2, Search, ChevronUp, ChevronDown, Pencil, X, Check, Bookmark } from 'lucide-react'
import MultiSelect from './MultiSelect'
import { useFilterContext } from '../context/FilterContext'
import type { FilteredIssue } from '../context/FilterContext'
import { useSavedQueries, getDefaultQuery, useSavedViews } from '../lib/savedQueries'
import type { SavedView } from '../lib/savedQueries'

interface JqlDataPageProps {
  pageId: string
  title: string
  subtitle?: string
  defaultJql: string
  extraColumns?: string[]
  showStatusFilter?: boolean
  hideProductManagerFilter?: boolean
  highlightUntriaged?: boolean
  flagStaleMonths?: number
  hideStartDate?: boolean
  hideType?: boolean
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
  updated: string | null
  statusUpdate: string | null
  devTeam: string | null
  programManager: string | null
  productManager: string | null
  engPic: string | null
  fixVersion: string | null
  nvbugsId: string | null
  reporter: string | null
  links: any[]
}

interface FilterOptions {
  assignees: string[]
  devTeams: string[]
  programManagers: string[]
  productManagers: string[]
  engPics: string[]
  statuses: string[]
}

type SortField = 'key' | 'type' | 'summary' | 'status' | 'assignee' | 'devTeam' | 'startDate' | 'dueDate' | 'priority' | 'fixVersion' | 'created' | 'reporter' | 'statusUpdate' | 'staleness'
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
    Unprioritized: 'text-red-600 font-bold',
  }
  const isUnprioritized = !priority || priority === 'Unprioritized'
  return (
    <span className={`text-xs font-medium ${isUnprioritized ? 'text-red-600 font-bold' : (colorMap[priority] || 'text-gray-500')}`}>
      {priority || 'Unprioritized'}
    </span>
  )
}

function getNvbugsLink(issue: JiraIssue): React.ReactNode {
  const id = issue.nvbugsId
  if (!id) return <span className="text-gray-400">—</span>
  // Extract just the numeric ID if it's a full URL (handles nvbugs and nvbugspro)
  const numericId = String(id).replace(/^https?:\/\/nvbugs(?:pro)?\.nvidia\.com\/(?:bug\/)?\//, '').replace(/\D/g, '') || String(id).replace(/\D/g, '') || id
  return (
    <a
      href={`https://nvbugs.nvidia.com/bug/${numericId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#76B900] hover:underline text-xs font-medium"
    >
      {numericId}
    </a>
  )
}

function getStalenessLevel(updated: string | null): { label: string; color: string; days: number } {
  if (!updated) return { label: '—', color: 'text-gray-400', days: 0 }
  const days = Math.floor((Date.now() - new Date(updated).getTime()) / (1000 * 60 * 60 * 24))
  if (days < 7) return { label: 'Active', color: 'text-green-600', days }
  if (days < 14) return { label: 'Cooling', color: 'text-yellow-600', days }
  if (days < 30) return { label: 'Stale', color: 'text-orange-600', days }
  return { label: 'Very Stale', color: 'text-red-600 font-bold', days }
}

function EditableStatusUpdate({ issueKey, value, onSaved }: { issueKey: string; value: string | null; onSaved: (newVal: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const [saving, setSaving] = useState(false)

  function startEdit() {
    setDraft(value || '')
    setEditing(true)
  }

  // Clean up Jira wiki markup for display
  function cleanMarkup(text: string): string {
    if (!text) return ''
    return text
      .replace(/\{\*\}/g, '')  // Remove {*} bold markers
      .replace(/\{\_\}/g, '')  // Remove {_} italic markers
      .replace(/\{\+\}/g, '')  // Remove {+} underline markers
      .replace(/\{~\}/g, '')   // Remove {~} strikethrough markers
      .replace(/\\n/g, '\n')  // Convert literal \n to newlines
      .trim()
  }

  async function handleSave() {
    setSaving(true)
    try {
      const oldValue = value || ''
      // Save new status update
      await axios.put(`/api/jira/issue/${issueKey}`, {
        fields: { customfield_14311: draft }
      })
      // Archive previous value as comment (only if there was a previous value)
      if (oldValue.trim()) {
        await axios.post(`/api/jira/issue/${issueKey}/comment`, {
          body: `Previous Status Update:\n${oldValue}`
        })
      }
      onSaved(draft)
      setEditing(false)
    } catch (e) {
      console.error('Failed to save status update:', e)
      alert('Failed to save status update. Check console for details.')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="relative min-w-[200px]">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="w-full text-xs border border-[#76B900] rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-[#76B900] resize-y min-h-[60px]"
          autoFocus
        />
        <div className="flex gap-1 mt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-2 py-0.5 bg-[#76B900] text-white rounded text-[10px] font-medium hover:bg-[#5a8f00] disabled:opacity-50 flex items-center gap-0.5"
          >
            <Check className="w-3 h-3" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium hover:bg-gray-200 flex items-center gap-0.5"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const cleaned = cleanMarkup(value || '')
  const lines = cleaned.split('\n').filter(l => l.trim())
  const firstLine = lines[0] || '—'
  const hasMore = lines.length > 1

  return (
    <div className="max-w-[250px]">
      <div className="group flex items-start gap-1">
        <div className="flex-1 min-w-0">
          {expanded ? (
            <span className="text-xs text-gray-700 whitespace-pre-wrap break-words">{cleaned}</span>
          ) : (
            <span className="text-xs text-gray-700 truncate block">{firstLine}</span>
          )}
        </div>
        <Pencil
          className="w-3 h-3 text-gray-300 group-hover:text-[#76B900] flex-shrink-0 mt-0.5 cursor-pointer"
          onClick={startEdit}
        />
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-[#76B900] hover:underline mt-0.5"
        >
          {expanded ? 'Show less' : `+${lines.length - 1} more`}
        </button>
      )}
    </div>
  )
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

export default function JqlDataPage({ pageId, title, subtitle, defaultJql, extraColumns = [], showStatusFilter = false, hideProductManagerFilter = false, highlightUntriaged = false, flagStaleMonths = 0, hideStartDate = false, hideType = false }: JqlDataPageProps) {
  const [jql, setJql] = useState('')
  const [jqlInput, setJqlInput] = useState('')
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    assignees: [], devTeams: [], programManagers: [], productManagers: [], engPics: [], statuses: []
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
  const [statusFilter, setStatusFilter] = useState<string[]>([])

  const { setPageDataset } = useFilterContext()
  const { queries, save, remove } = useSavedQueries(pageId)
  const { views, save: saveViewFn, remove: removeViewFn } = useSavedViews(pageId)
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false)
  const [saveViewName, setSaveViewName] = useState('')

  // Which extra columns to show
  const showPriority = extraColumns.includes('priority')
  const showFixVersion = extraColumns.includes('fixVersion')
  const showCreated = extraColumns.includes('created')
  const showNvbugs = extraColumns.includes('nvbugs')
  const showReporter = extraColumns.includes('reporter')
  const showStatusUpdate = extraColumns.includes('statusUpdate')
  const showStaleness = extraColumns.includes('staleness')

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
    const statuses = new Set<string>()

    issues.forEach(issue => {
      if (issue.assignee && issue.assignee !== 'Unassigned') assignees.add(issue.assignee)
      if (issue.devTeam) devTeams.add(issue.devTeam)
      if (issue.programManager) programManagers.add(issue.programManager)
      if (issue.productManager) productManagers.add(issue.productManager)
      if (issue.engPic) engPics.add(issue.engPic)
      if (issue.status) statuses.add(issue.status)
    })

    setFilterOptions({
      assignees: [...assignees].sort(),
      devTeams: [...devTeams].sort(),
      programManagers: [...programManagers].sort(),
      productManagers: [...productManagers].sort(),
      engPics: [...engPics].sort(),
      statuses: [...statuses].sort()
    })
  }, [issues])

  // Update downstream dataset for this page whenever issues or filters change
  useEffect(() => {
    const filtered = applyClientFilters(issues)
    setPageDataset(pageId, filtered as FilteredIssue[])
  }, [issues, devTeamFilter, assigneeFilter, programManagerFilter, productManagerFilter, engPicFilter, statusFilter])

  // Filter options are derived from current page results above — no separate fetch needed

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
    if (statusFilter.length > 0) {
      filtered = filtered.filter(i => statusFilter.includes(i.status))
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

  function handleSaveView(asDefault: boolean) {
    if (!saveViewName.trim()) return
    saveViewFn({
      name: saveViewName.trim(),
      jql: jqlInput,
      filters: {
        devTeam: devTeamFilter,
        assignee: assigneeFilter,
        programManager: programManagerFilter,
        productManager: productManagerFilter,
        engPic: engPicFilter,
        status: statusFilter,
      },
      isDefault: asDefault
    })
    setShowSaveViewDialog(false)
    setSaveViewName('')
  }

  function handleLoadView(view: SavedView) {
    setJqlInput(view.jql)
    setJql(view.jql)
    setDevTeamFilter(view.filters.devTeam || [])
    setAssigneeFilter(view.filters.assignee || [])
    setProgramManagerFilter(view.filters.programManager || [])
    setProductManagerFilter(view.filters.productManager || [])
    setEngPicFilter(view.filters.engPic || [])
    setStatusFilter(view.filters.status || [])
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
        case 'reporter': {
          cmp = (a.reporter || '').localeCompare(b.reporter || '')
          break
        }
        case 'statusUpdate': {
          cmp = (a.statusUpdate || '').localeCompare(b.statusUpdate || '')
          break
        }
        case 'staleness': {
          const da = a.updated ? new Date(a.updated).getTime() : 0
          const db = b.updated ? new Date(b.updated).getTime() : 0
          cmp = da - db
          break
        }
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return sorted
  }, [filteredIssues, sortField, sortDir])

  const colSpan = 8 + (showPriority ? 1 : 0) + (showFixVersion ? 1 : 0) + (showCreated ? 1 : 0) + (showNvbugs ? 1 : 0) + (showReporter ? 1 : 0) + (showStatusUpdate ? 1 : 0) + (showStaleness ? 1 : 0) - (hideStartDate ? 1 : 0) - (hideType ? 1 : 0)

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
          {showStatusFilter && (
            <MultiSelect
              label="Status"
              options={filterOptions.statuses}
              selected={statusFilter}
              onChange={setStatusFilter}
            />
          )}
          <MultiSelect
            label="Program Manager"
            options={filterOptions.programManagers}
            selected={programManagerFilter}
            onChange={setProgramManagerFilter}
          />
          {!hideProductManagerFilter && (
            <MultiSelect
              label="Product Manager"
              options={filterOptions.productManagers}
              selected={productManagerFilter}
              onChange={setProductManagerFilter}
            />
          )}
          <MultiSelect
            label="Eng PIC"
            options={filterOptions.engPics}
            selected={engPicFilter}
            onChange={setEngPicFilter}
          />
        </div>
      </div>

      {/* Saved Views */}
      {(views.length > 0 || true) && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <Bookmark className="w-4 h-4 text-gray-400" />
          {views.map(v => (
            <div key={v.name} className="inline-flex items-center gap-0.5 group">
              <button
                onClick={() => handleLoadView(v)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  v.isDefault
                    ? 'bg-[#76B900]/15 text-[#76B900] border border-[#76B900]/30'
                    : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                }`}
                title={`JQL: ${v.jql}\nFilters: ${Object.entries(v.filters).filter(([,val]) => val.length > 0).map(([k,val]) => `${k}: ${val.join(', ')}`).join('; ') || 'none'}`}
              >
                {v.isDefault && <Star className="w-3 h-3 inline mr-0.5" />}
                {v.name}
              </button>
              <button
                onClick={() => removeViewFn(v.name)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setShowSaveViewDialog(true)}
            className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition"
          >
            + Save View
          </button>
        </div>
      )}

      {/* Save View Dialog */}
      {showSaveViewDialog && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-xs text-purple-700 mb-2">Save current JQL + filters as a named view:</p>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={saveViewName}
              onChange={e => setSaveViewName(e.target.value)}
              placeholder="View name (e.g. 'Standup', 'Triage')..."
              className="flex-1 px-3 py-1.5 border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-[#76B900] outline-none"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveView(false)}
            />
            <button
              onClick={() => handleSaveView(false)}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700"
            >
              Save
            </button>
            <button
              onClick={() => handleSaveView(true)}
              className="px-3 py-1.5 bg-[#76B900] text-white rounded-lg text-xs font-medium hover:bg-[#5a8f00]"
              title="Save as default view for this page"
            >
              Save as Default
            </button>
            <button
              onClick={() => setShowSaveViewDialog(false)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
                {showNvbugs && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">NVBugs</th>
                )}
                {showStaleness && (
                  <SortHeader field="staleness" label="Staleness" current={sortField} dir={sortDir} onClick={handleSort} />
                )}
                {showCreated && (
                  <SortHeader field="created" label="Created" current={sortField} dir={sortDir} onClick={handleSort} />
                )}
                {!hideType && <SortHeader field="type" label="Type" current={sortField} dir={sortDir} onClick={handleSort} />}
                <SortHeader field="summary" label="Summary" current={sortField} dir={sortDir} onClick={handleSort} />
                <SortHeader field="status" label="Status" current={sortField} dir={sortDir} onClick={handleSort} />
                {showPriority && (
                  <SortHeader field="priority" label="Priority" current={sortField} dir={sortDir} onClick={handleSort} />
                )}
                <SortHeader field="assignee" label="Assignee" current={sortField} dir={sortDir} onClick={handleSort} />
                {showReporter && (
                  <SortHeader field="reporter" label="Reporter" current={sortField} dir={sortDir} onClick={handleSort} />
                )}
                <SortHeader field="devTeam" label="Dev Team" current={sortField} dir={sortDir} onClick={handleSort} />
                {showFixVersion && (
                  <SortHeader field="fixVersion" label="Fix Version" current={sortField} dir={sortDir} onClick={handleSort} />
                )}
                {showStatusUpdate && (
                  <SortHeader field="statusUpdate" label="Status Update" current={sortField} dir={sortDir} onClick={handleSort} />
                )}
                {!hideStartDate && <SortHeader field="startDate" label="Start" current={sortField} dir={sortDir} onClick={handleSort} />}
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
                sortedIssues.map(issue => {
                  // Highlight: no priority AND no fix version = needs triage
                  const needsTriage = highlightUntriaged && (!issue.priority || issue.priority === 'Medium') && !issue.fixVersion
                  // Flag: open longer than N months
                  const isStale = flagStaleMonths > 0 && issue.created && 
                    (Date.now() - new Date(issue.created).getTime()) > (flagStaleMonths * 30 * 24 * 60 * 60 * 1000)
                  const rowClass = needsTriage 
                    ? 'bg-orange-50 border-b border-orange-100 hover:bg-orange-100 transition'
                    : 'hover:bg-gray-50 border-b border-gray-100 transition'
                  return (
                  <tr key={issue.key} className={rowClass}>
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
                    {showNvbugs && (
                      <td className="px-4 py-3 text-sm">
                        {getNvbugsLink(issue)}
                      </td>
                    )}
                    {showStaleness && (
                      <td className="px-4 py-3">
                        {(() => {
                          const staleness = getStalenessLevel(issue.updated)
                          return (
                            <span className={`text-xs font-medium ${staleness.color}`} title={`Last updated: ${issue.updated || 'unknown'}`}>
                              {staleness.label}{staleness.days > 0 ? ` (${staleness.days}d)` : ''}
                            </span>
                          )
                        })()}
                      </td>
                    )}
                    {showCreated && (
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {issue.created || '—'}
                        {isStale && <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium" title="Open > 1 month — review?">⚠️ stale</span>}
                      </td>
                    )}
                    {!hideType && <td className="px-4 py-3 text-xs text-gray-500">{issue.type || '—'}</td>}
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
                    {showReporter && (
                      <td className="px-4 py-3 text-sm text-gray-500">{issue.reporter || '—'}</td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-500">{issue.devTeam || '—'}</td>
                    {showFixVersion && (
                      <td className="px-4 py-3 text-sm text-gray-500">{issue.fixVersion || '—'}</td>
                    )}
                    {showStatusUpdate && (
                      <td className="px-4 py-3">
                        <EditableStatusUpdate
                          issueKey={issue.key}
                          value={issue.statusUpdate}
                          onSaved={(newVal) => {
                            setIssues(prev => prev.map(i => i.key === issue.key ? { ...i, statusUpdate: newVal } : i))
                          }}
                        />
                      </td>
                    )}
                    {!hideStartDate && <td className="px-4 py-3 text-sm text-gray-500">{issue.startDate || '—'}</td>}
                    <td className="px-4 py-3 text-sm text-gray-500">{issue.dueDate || '—'}</td>
                  </tr>
                  )
                })
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
