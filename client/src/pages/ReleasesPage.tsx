import { useState, useEffect, useCallback } from 'react'
import { Rocket, ChevronDown, ChevronRight, RefreshCw, Shield, FileText, TestTube, AlertTriangle, Table, Layers, X } from 'lucide-react'
import { getDefaultQuery } from '../lib/savedQueries'
import { useSavedQueries } from '../lib/savedQueries'
import JqlDataPage from '../components/JqlDataPage'
import { useDismissed } from '../lib/useDismissed'
import { DismissedPanel } from '../components/DismissControls'

interface JiraIssue {
  key: string
  summary: string
  type: string
  status: string
  statusCategory: string
  assignee: string
  priority: string
  dueDate: string | null
  fixVersion: string | null
}

interface PLCChild {
  key: string
  summary: string
  status: string
  statusCategory: string
  type: string
}

interface PLCGroup {
  parent: JiraIssue
  children: PLCChild[]
}

interface ReleaseGroup {
  release: JiraIssue
  fixVersionName: string
  plcGroups: PLCGroup[]
  qaTickets: JiraIssue[]
  docsTickets: JiraIssue[]
  otherTickets: JiraIssue[]
}

const DEFAULT_JQL = 'project = OMPE AND issuetype = Release AND status != Done AND created >= -60d ORDER BY duedate ASC'

export default function ReleasesPage() {
  const [releases, setReleases] = useState<ReleaseGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set())
  const [expandedPLC, setExpandedPLC] = useState<Set<string>>(new Set())
  const [jql, setJql] = useState(() => getDefaultQuery('releases', DEFAULT_JQL))
  const { queries } = useSavedQueries('releases')
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('table')
  const { dismissed, dismiss, restore, restoreAll } = useDismissed('releases')

  const fetchReleases = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Step 1: Fetch release tickets
      const res = await fetch(`/api/jira/query?jql=${encodeURIComponent(jql)}&maxResults=50`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch releases')
      }
      const data = await res.json()
      const releaseIssues: JiraIssue[] = data.issues

      // Step 2: For each release, fetch its fixVersion contents
      const releaseGroups: ReleaseGroup[] = await Promise.all(
        releaseIssues.map(async (release) => {
          // Try to get the actual fixVersion name from the release ticket
          const versionName = release.fixVersion || release.summary

          // Fetch all items in this fixVersion
          const fvJql = `project = OMPE AND fixVersion = "${versionName}" ORDER BY issuetype ASC`
          let fvItems: JiraIssue[] = []
          try {
            const fvRes = await fetch(`/api/jira/query?jql=${encodeURIComponent(fvJql)}&maxResults=100`, { credentials: 'include' })
            if (fvRes.ok) {
              const fvData = await fvRes.json()
              fvItems = fvData.issues || []
            }
          } catch (e) {
            // If fixVersion query fails, try with release summary
            console.warn(`Failed to fetch fixVersion for ${release.key}:`, e)
          }

          // Separate into categories
          const plcParents = fvItems.filter(i => i.type === 'PLC Pillar' && (i.summary.includes('L1') || i.summary.includes('Parent Task') || i.summary.includes('L0')))
          const qaTickets = fvItems.filter(i => i.summary.toLowerCase().includes('qa') || i.summary.toLowerCase().includes('test request'))
          const docsTickets = fvItems.filter(i => i.summary.toLowerCase().includes('doc'))
          const categorizedKeys = new Set([
            release.key,
            ...plcParents.map(p => p.key),
            ...qaTickets.map(q => q.key),
            ...docsTickets.map(d => d.key),
          ])
          const otherTickets = fvItems.filter(i => !categorizedKeys.has(i.key))

          // Fetch blockers for each PLC parent
          const plcGroups: PLCGroup[] = await Promise.all(
            plcParents.map(async (parent) => {
              try {
                const linkRes = await fetch(`/api/jira/issue/${parent.key}/links`, { credentials: 'include' })
                if (linkRes.ok) {
                  const linkData = await linkRes.json()
                  return { parent, children: linkData.blockers || [] }
                }
              } catch (e) {
                console.warn(`Failed to fetch links for ${parent.key}:`, e)
              }
              return { parent, children: [] }
            })
          )

          return {
            release,
            fixVersionName: versionName,
            plcGroups,
            qaTickets,
            docsTickets,
            otherTickets,
          }
        })
      )

      setReleases(releaseGroups)
      // Start with all releases collapsed by default
      setExpandedReleases(new Set())
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    }
    setLoading(false)
  }, [jql])

  useEffect(() => {
    fetchReleases()
  }, [])

  const toggleRelease = (key: string) => {
    setExpandedReleases(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const togglePLC = (key: string) => {
    setExpandedPLC(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Rocket className="w-6 h-6 text-[#76B900]" />
          Releases
        </h1>
        <p className="text-gray-500 text-sm mt-1">Release milestones with PLC pillars, QA, and documentation tracking</p>
      </div>

      {/* View Toggle */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setViewMode('grouped')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'grouped' ? 'bg-[#76B900] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <Layers className="w-4 h-4" />
          Grouped View
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'table' ? 'bg-[#76B900] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <Table className="w-4 h-4" />
          Table View
        </button>
        <div className="ml-auto">
          <button
            onClick={fetchReleases}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition disabled:opacity-50"
            title="Refresh data from Jira"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            🔄
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <JqlDataPage
          pageId="releases-table"
          title=""
          defaultJql={DEFAULT_JQL}
          extraColumns={['statusUpdate', 'fixVersion', 'staleness']}
          showFixVersionSummary={true}
        />
      ) : (
      <>

      {/* JQL Bar */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          value={jql}
          onChange={e => setJql(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchReleases()}
          className="flex-1 font-mono text-sm border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#76B900]/30 focus:border-[#76B900]"
          placeholder="JQL for releases..."
        />
        <button onClick={fetchReleases} disabled={loading} className="px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] disabled:opacity-50 transition">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Run'}
        </button>
      </div>

      {/* Saved Queries */}
      {queries.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {queries.map(q => (
            <button key={q.name} onClick={() => { setJql(q.jql); }} className={`text-xs px-2 py-1 rounded border transition ${q.isDefault ? 'bg-[#76B900]/10 border-[#76B900] text-[#76B900]' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              {q.name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading releases and PLC data...</span>
        </div>
      )}

      {/* Release Groups */}
      {!loading && releases.length === 0 && !error && (
        <div className="text-gray-400 text-sm py-8 text-center">No releases found. Run a query above.</div>
      )}

      <div className="space-y-4">
        {releases.filter(rg => !dismissed.includes(rg.release.key)).map(rg => (
          <div key={rg.release.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Release Header */}
            <div
              className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition group"
              onClick={() => toggleRelease(rg.release.key)}
            >
              {expandedReleases.has(rg.release.key) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              <Rocket className="w-4 h-4 text-[#76B900]" />
              <a href={`https://jirasw.nvidia.com/browse/${rg.release.key}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] font-medium hover:underline text-sm" onClick={e => e.stopPropagation()}>
                {rg.release.key}
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (window.confirm(`Hide ${rg.release.key} from this view? (This won't change anything in Jira)`)) {
                    dismiss(rg.release.key)
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-opacity"
                title={`Hide ${rg.release.key}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <span className="font-semibold text-gray-900">{rg.release.summary}</span>
              <StatusBadge status={rg.release.status} category={rg.release.statusCategory} />
              {/* Open/total summary when collapsed */}
              {!expandedReleases.has(rg.release.key) && (() => {
                const allItems = [...rg.plcGroups.map(p => p.parent), ...rg.qaTickets, ...rg.docsTickets, ...rg.otherTickets]
                const openCount = allItems.filter(i => i.statusCategory !== 'done' && i.status !== 'Closed' && i.status !== 'Done').length
                const totalCount = allItems.length
                return totalCount > 0 ? (
                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    {openCount} of {totalCount} open
                  </span>
                ) : null
              })()}
              {rg.release.dueDate && <span className="text-xs text-gray-500 ml-auto">Due: {rg.release.dueDate}</span>}
            </div>

            {/* Expanded Content */}
            {expandedReleases.has(rg.release.key) && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                {/* PLC Pillars */}
                {rg.plcGroups.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      PLC Pillars ({rg.plcGroups.length})
                    </h3>
                    <div className="space-y-2">
                      {rg.plcGroups.map(plc => (
                        <div key={plc.parent.key} className="border border-gray-100 rounded-lg">
                          {/* PLC Parent */}
                          <div
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition"
                            onClick={() => togglePLC(plc.parent.key)}
                          >
                            {plc.children.length > 0 ? (
                              expandedPLC.has(plc.parent.key) ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                            ) : <div className="w-3.5" />}
                            <a href={`https://jirasw.nvidia.com/browse/${plc.parent.key}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] text-xs font-medium hover:underline" onClick={e => e.stopPropagation()}>
                              {plc.parent.key}
                            </a>
                            <span className="text-sm text-gray-800 truncate">{plc.parent.summary}</span>
                            <StatusBadge status={plc.parent.status} category={plc.parent.statusCategory} />
                            {plc.children.length > 0 && (
                              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium ml-auto">
                                {plc.children.filter(c => c.statusCategory === 'done').length}/{plc.children.length} done
                              </span>
                            )}
                          </div>
                          {/* PLC Children */}
                          {expandedPLC.has(plc.parent.key) && plc.children.length > 0 && (
                            <div className="border-t border-gray-50 bg-gray-50/50 px-3 py-2">
                              <div className="space-y-1 ml-6">
                                {plc.children.map(child => (
                                  <div key={child.key} className="flex items-center gap-2 text-xs">
                                    <a href={`https://jirasw.nvidia.com/browse/${child.key}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] hover:underline font-medium">
                                      {child.key}
                                    </a>
                                    <span className="text-gray-700 truncate">{child.summary}</span>
                                    <StatusBadge status={child.status} category={child.statusCategory} small />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* QA Tickets */}
                {rg.qaTickets.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <TestTube className="w-3.5 h-3.5 text-orange-500" />
                      QA ({rg.qaTickets.length})
                    </h3>
                    <div className="space-y-1">
                      {rg.qaTickets.map(t => (
                        <div key={t.key} className="flex items-center gap-2 text-sm px-3 py-1">
                          <a href={`https://jirasw.nvidia.com/browse/${t.key}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] font-medium hover:underline text-xs">{t.key}</a>
                          <span className="text-gray-700 truncate">{t.summary}</span>
                          <StatusBadge status={t.status} category={t.statusCategory} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Docs Tickets */}
                {rg.docsTickets.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      Documentation ({rg.docsTickets.length})
                    </h3>
                    <div className="space-y-1">
                      {rg.docsTickets.map(t => (
                        <div key={t.key} className="flex items-center gap-2 text-sm px-3 py-1">
                          <a href={`https://jirasw.nvidia.com/browse/${t.key}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] font-medium hover:underline text-xs">{t.key}</a>
                          <span className="text-gray-700 truncate">{t.summary}</span>
                          <StatusBadge status={t.status} category={t.statusCategory} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Tickets */}
                {rg.otherTickets.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                      Other ({rg.otherTickets.length})
                    </h3>
                    <div className="space-y-1">
                      {rg.otherTickets.map(t => (
                        <div key={t.key} className="flex items-center gap-2 text-sm px-3 py-1">
                          <a href={`https://jirasw.nvidia.com/browse/${t.key}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] font-medium hover:underline text-xs">{t.key}</a>
                          <span className="text-xs text-gray-400">[{t.type}]</span>
                          <span className="text-gray-700 truncate">{t.summary}</span>
                          <StatusBadge status={t.status} category={t.statusCategory} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rg.plcGroups.length === 0 && rg.qaTickets.length === 0 && rg.docsTickets.length === 0 && rg.otherTickets.length === 0 && (
                  <div className="text-sm text-gray-400 py-2">No items found for fixVersion "{rg.fixVersionName}"</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <DismissedPanel dismissed={dismissed} onRestore={restore} onRestoreAll={restoreAll} />
      </>
      )}
    </div>
  )
}

function StatusBadge({ status, category, small }: { status: string; category: string; small?: boolean }) {
  let bg = 'bg-gray-100 text-gray-600'
  if (category === 'done') bg = 'bg-green-100 text-green-700'
  else if (category === 'indeterminate') bg = 'bg-blue-100 text-blue-700'
  else if (status === 'Not Applicable') bg = 'bg-gray-100 text-gray-400'
  else if (status === 'Canceled' || status === 'Cancelled') bg = 'bg-gray-100 text-gray-400 line-through'

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${bg} ${small ? 'text-[9px]' : 'text-[10px]'}`}>
      {status}
    </span>
  )
}
