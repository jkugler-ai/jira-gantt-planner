import { useState, useEffect, useCallback } from 'react'
import { Rocket, ChevronDown, ChevronRight, RefreshCw, Shield, FileText, TestTube, AlertTriangle, Table, Layers, X, ClipboardList, User, Clock } from 'lucide-react'
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
  resolution?: string | null
  assignee: string
  priority: string
  dueDate: string | null
  fixVersion: string | null
  links?: any[]
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

const DEFAULT_JQL = 'project = OMPE AND issuetype = Release AND statusCategory != Done AND created >= -60d ORDER BY duedate ASC'

const ACTION_ITEMS_JQL = '(project = ompe AND "Development Team" in ("Storage Infrastructure APIs", "USD Storage API", "Caching Services", Portal, ovstorage, ovpackage, "Legacy Nucleus") AND type = release AND (text ~ storage OR text ~ ovstorage OR text ~ ovpackage OR text ~ Hub OR text ~ "Client Library" OR text ~ "Web Portal" OR text ~ "Caches" OR text ~ "Cache" OR text ~ ovcontentcache OR text ~ ovderivedcache OR text ~ "Nucleus Migration" OR text ~ "connect sample" OR text ~ Nucleus) AND (statusCategory in ("To Do", "In Progress") OR (statusCategory = Done AND updated >= -3d))) OR (project = ompe and text ~ "OKAS 1." and "development team" = "kit app streaming" and type = release and statusCategory in ("To Do", "In Progress")) ORDER BY due ASC'

interface ActionItem {
  key: string
  summary: string
  status: string
  statusCategory: string
  assignee: string
  dueDate: string | null
  type: string
  parentRelease: string
  parentReleaseDue: string | null
  plcParentKey: string
}

interface ReleaseActionGroup {
  releaseKey: string
  releaseSummary: string
  releaseDue: string | null
  releaseStatus: string
  releaseStatusCategory: string
  assigneeGroups: { assignee: string; items: ActionItem[] }[]
}

export default function ReleasesPage() {
  const [releases, setReleases] = useState<ReleaseGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set())
  const [expandedPLC, setExpandedPLC] = useState<Set<string>>(new Set())
  const [jql, setJql] = useState(() => getDefaultQuery('releases', DEFAULT_JQL))
  const { queries, save: saveQuery, remove: removeQuery } = useSavedQueries('releases')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveQueryName, setSaveQueryName] = useState('')
  const [viewMode, setViewMode] = useState<'grouped' | 'table' | 'action-items'>('table')
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
        <button
          onClick={() => setViewMode('action-items')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'action-items' ? 'bg-[#76B900] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <ClipboardList className="w-4 h-4" />
          PLC Action Items
        </button>
        <div className="ml-auto">
          <button
            onClick={viewMode === 'action-items' ? () => {} : fetchReleases}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition disabled:opacity-50"
            title="Refresh data from Jira"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            🔄
          </button>
        </div>
      </div>

      {viewMode === 'action-items' ? (
        <PLCActionItemsView />
      ) : viewMode === 'table' ? (
        <JqlDataPage
          pageId="releases-table"
          title=""
          defaultJql={DEFAULT_JQL}
          extraColumns={['statusUpdate', 'fixVersion', 'staleness']}
          showFixVersionSummary={true}
          showStatusFilter={true}
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
        <button onClick={() => setShowSaveDialog(true)} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition" title="Save query">
          💾
        </button>
      </div>

      {/* Save Query Dialog */}
      {showSaveDialog && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={saveQueryName}
              onChange={e => setSaveQueryName(e.target.value)}
              placeholder="Query name..."
              className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#76B900]/30"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && saveQueryName.trim()) { saveQuery({ name: saveQueryName.trim(), jql, isDefault: false }); setShowSaveDialog(false); setSaveQueryName('') } if (e.key === 'Escape') setShowSaveDialog(false) }}
            />
            <button onClick={() => { if (saveQueryName.trim()) { saveQuery({ name: saveQueryName.trim(), jql, isDefault: false }); setShowSaveDialog(false); setSaveQueryName('') } }} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition">Save</button>
            <button onClick={() => { if (saveQueryName.trim()) { saveQuery({ name: saveQueryName.trim(), jql, isDefault: true }); setShowSaveDialog(false); setSaveQueryName('') } }} className="px-3 py-1.5 bg-[#76B900] text-white rounded text-sm hover:bg-[#5a8f00] transition">Save as Default</button>
            <button onClick={() => setShowSaveDialog(false)} className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-sm">✕</button>
          </div>
        </div>
      )}

      {/* Saved Queries */}
      {queries.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {queries.map(q => (
            <span key={q.name} className="inline-flex items-center gap-1">
              <button onClick={() => { setJql(q.jql); }} className={`text-xs px-2 py-1 rounded-l border transition ${q.isDefault ? 'bg-[#76B900]/10 border-[#76B900] text-[#76B900]' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                {q.isDefault && '⭐ '}{q.name}
              </button>
              <button onClick={() => removeQuery(q.name)} className={`text-xs px-1.5 py-1 rounded-r border-l-0 border transition text-gray-400 hover:text-red-500 hover:bg-red-50 ${q.isDefault ? 'border-[#76B900]' : 'border-gray-200'}`} title="Delete query">
                ✕
              </button>
            </span>
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
                const openCount = allItems.filter(i => i.statusCategory !== 'done' && !i.resolution).length
                const totalCount = allItems.length
                const colorClass = openCount === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                return totalCount > 0 ? (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
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

function PLCActionItemsView() {
  const [releaseGroups, setReleaseGroups] = useState<ReleaseActionGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set())

  const fetchActionItems = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Step 1: Fetch release tickets
      const res = await fetch(`/api/jira/query?jql=${encodeURIComponent(ACTION_ITEMS_JQL)}&maxResults=50`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch releases')
      }
      const data = await res.json()
      const releaseIssues: JiraIssue[] = data.issues

      // Step 2: For each release, traverse links to find PLC/MVSB tickets and their children
      const groups: ReleaseActionGroup[] = []

      for (const release of releaseIssues) {
        const actionItems: ActionItem[] = []

        try {
          // Get ALL links for this release
          const relLinkRes = await fetch(`/api/jira/issue/${release.key}/all-links`, { credentials: 'include' })
          if (!relLinkRes.ok) continue
          const relLinkData = await relLinkRes.json()

          // Find PLC initiatives that approve this release
          const plcInitiatives = relLinkData.approvedBy || []
          // Also include direct blockedBy items that look like PLC/MVSB
          const directMVSBs = (relLinkData.blockedBy || []).filter((l: any) =>
            l.summary?.includes('MVSB') || l.summary?.includes('L1') || l.type === 'PLC Pillar'
          )

          // Collect MVSB keys and direct action items
          const mvsbKeys: string[] = directMVSBs.map((m: any) => m.key)
          const plcInitKeys: string[] = plcInitiatives.map((p: any) => p.key)

          // For each PLC initiative, get its links to find MVSB L1 tickets AND direct children
          for (const plcKey of plcInitKeys) {
            try {
              const plcRes = await fetch(`/api/jira/issue/${plcKey}/all-links`, { credentials: 'include' })
              if (!plcRes.ok) continue
              const plcData = await plcRes.json()

              // MVSB tickets that approve this PLC initiative
              const mvsbTickets = plcData.approvedBy || []
              for (const mvsb of mvsbTickets) {
                if (!mvsbKeys.includes(mvsb.key)) mvsbKeys.push(mvsb.key)
              }

              // Also get direct 'contains' and 'tests' items (docs, QA tickets)
              const directChildren = [...(plcData.contains || []), ...(plcData.tests || [])]
              for (const child of directChildren) {
                if (!actionItems.find(ai => ai.key === child.key)) {
                  actionItems.push({
                    key: child.key,
                    summary: child.summary,
                    status: child.status,
                    statusCategory: child.statusCategory || 'indeterminate',
                    assignee: child.assignee || 'Unassigned',
                    dueDate: child.dueDate || null,
                    type: child.type || 'Task',
                    parentRelease: release.key,
                    parentReleaseDue: release.dueDate,
                    plcParentKey: plcKey,
                  })
                }
              }
            } catch (e) {
              console.warn(`Failed to fetch PLC initiative ${plcKey}:`, e)
            }
          }

          // For each MVSB ticket, get its blockers (the actual PLC action items)
          for (const mvsbKey of mvsbKeys) {
            try {
              const mvsbRes = await fetch(`/api/jira/issue/${mvsbKey}/all-links`, { credentials: 'include' })
              if (!mvsbRes.ok) continue
              const mvsbData = await mvsbRes.json()

              const blockers = mvsbData.blockedBy || []
              for (const child of blockers) {
                if (!actionItems.find(ai => ai.key === child.key)) {
                  actionItems.push({
                    key: child.key,
                    summary: child.summary,
                    status: child.status,
                    statusCategory: child.statusCategory || 'indeterminate',
                    assignee: child.assignee || 'Unassigned',
                    dueDate: child.dueDate || null,
                    type: child.type || 'Task',
                    parentRelease: release.key,
                    parentReleaseDue: release.dueDate,
                    plcParentKey: mvsbKey,
                  })
                }
              }
            } catch (e) {
              console.warn(`Failed to fetch MVSB ${mvsbKey}:`, e)
            }
          }

          // Also include 'has to be finished together with' links from the release itself
          const finishWith = relLinkData.finishedWith || []
          for (const item of finishWith) {
            if (!actionItems.find(ai => ai.key === item.key)) {
              actionItems.push({
                key: item.key,
                summary: item.summary,
                status: item.status,
                statusCategory: item.statusCategory || 'indeterminate',
                assignee: item.assignee || 'Unassigned',
                dueDate: item.dueDate || null,
                type: item.type || 'Task',
                parentRelease: release.key,
                parentReleaseDue: release.dueDate,
                plcParentKey: release.key,
              })
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch links for release ${release.key}:`, e)
        }

        // Deduplicate by key
        const uniqueItems = Array.from(new Map(actionItems.map(i => [i.key, i])).values())

        // Group by assignee
        const assigneeMap = new Map<string, ActionItem[]>()
        for (const item of uniqueItems) {
          const existing = assigneeMap.get(item.assignee) || []
          existing.push(item)
          assigneeMap.set(item.assignee, existing)
        }

        // Sort assignees alphabetically, but put 'Unassigned' last
        const assigneeGroups = Array.from(assigneeMap.entries())
          .sort(([a], [b]) => {
            if (a === 'Unassigned') return 1
            if (b === 'Unassigned') return -1
            return a.localeCompare(b)
          })
          .map(([assignee, items]) => ({ assignee, items }))

        if (uniqueItems.length > 0) {
          groups.push({
            releaseKey: release.key,
            releaseSummary: release.summary,
            releaseDue: release.dueDate,
            releaseStatus: release.status,
            releaseStatusCategory: release.statusCategory,
            assigneeGroups,
          })
        }
      }

      setReleaseGroups(groups)
      // Auto-expand all releases
      setExpandedReleases(new Set(groups.map(g => g.releaseKey)))
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchActionItems()
  }, [])

  const toggleRelease = (key: string) => {
    setExpandedReleases(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // Calculate summary stats
  const allItems = releaseGroups.flatMap(rg => rg.assigneeGroups.flatMap(ag => ag.items))
  const today = new Date().toISOString().split('T')[0]
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const openItems = allItems.filter(i => i.statusCategory !== 'done' && i.status !== 'Security Signed-off')
  const overdueItems = openItems.filter(i => {
    const due = i.dueDate || i.parentReleaseDue
    return due && due <= today
  })
  const dueSoonItems = openItems.filter(i => {
    const due = i.dueDate || i.parentReleaseDue
    return due && due > today && due <= threeDaysFromNow
  })

  function getReleaseBorderColor(dueDate: string | null): string {
    if (!dueDate) return 'border-gray-200'
    if (dueDate <= today) return 'border-red-300 bg-red-50/30'
    if (dueDate <= threeDaysFromNow) return 'border-amber-300 bg-amber-50/30'
    return 'border-gray-200'
  }

  function isDone(item: ActionItem): boolean {
    return item.statusCategory === 'done' || item.status === 'Security Signed-off' || item.status === 'Closed' || item.status === 'Done' || item.status === 'Exception Granted'
  }

  return (
    <div>
      {/* Summary Banner */}
      {!loading && releaseGroups.length > 0 && (
        <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#76B900]" />
            <span className="text-sm font-semibold text-gray-900">{openItems.length} items need attention</span>
          </div>
          {overdueItems.length > 0 && (
            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
              {overdueItems.length} overdue
            </span>
          )}
          {dueSoonItems.length > 0 && (
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
              {dueSoonItems.length} due within 3 days
            </span>
          )}
          <button
            onClick={fetchActionItems}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
          <span>Loading PLC action items across releases...</span>
        </div>
      )}

      {!loading && releaseGroups.length === 0 && !error && (
        <div className="text-gray-400 text-sm py-8 text-center">No PLC action items found.</div>
      )}

      {/* Release Groups */}
      <div className="space-y-4">
        {releaseGroups.map(rg => (
          <div key={rg.releaseKey} className={`bg-white border rounded-xl overflow-hidden ${getReleaseBorderColor(rg.releaseDue)}`}>
            {/* Release Header */}
            <div
              className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition"
              onClick={() => toggleRelease(rg.releaseKey)}
            >
              {expandedReleases.has(rg.releaseKey) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              <Rocket className="w-4 h-4 text-[#76B900]" />
              <a href={`https://jirasw.nvidia.com/browse/${rg.releaseKey}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] font-medium hover:underline text-sm" onClick={e => e.stopPropagation()}>
                {rg.releaseKey}
              </a>
              <span className="font-semibold text-gray-900">{rg.releaseSummary}</span>
              <StatusBadge status={rg.releaseStatus} category={rg.releaseStatusCategory} />
              {rg.releaseDue && (
                <span className={`text-xs ml-auto flex items-center gap-1 ${rg.releaseDue <= today ? 'text-red-600 font-bold' : rg.releaseDue <= threeDaysFromNow ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                  <Clock className="w-3 h-3" />
                  Due: {rg.releaseDue}
                </span>
              )}
              {/* Count badge */}
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                {rg.assigneeGroups.reduce((sum, ag) => sum + ag.items.filter(i => !isDone(i)).length, 0)} open
              </span>
            </div>

            {/* Expanded: Assignee groups */}
            {expandedReleases.has(rg.releaseKey) && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                {rg.assigneeGroups.map(ag => {
                  const openCount = ag.items.filter(i => !isDone(i)).length
                  const doneCount = ag.items.filter(i => isDone(i)).length
                  return (
                    <div key={ag.assignee} className="">
                      {/* Assignee Header */}
                      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm font-bold text-gray-800">{ag.assignee}</span>
                        {openCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                            {openCount} open
                          </span>
                        )}
                        {doneCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                            {doneCount} done
                          </span>
                        )}
                      </div>
                      {/* Items */}
                      <div className="space-y-1 ml-5">
                        {ag.items.map(item => (
                          <div key={item.key} className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded transition ${isDone(item) ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                            {isDone(item) && <span className="text-green-500 text-xs">✓</span>}
                            <a href={`https://jirasw.nvidia.com/browse/${item.key}`} target="_blank" rel="noopener noreferrer" className="text-[#76B900] font-medium hover:underline text-xs whitespace-nowrap">
                              {item.key}
                            </a>
                            <span className={`text-gray-700 truncate ${isDone(item) ? 'line-through' : ''}`}>{item.summary}</span>
                            <StatusBadge status={item.status} category={item.statusCategory} small />
                            {item.dueDate && (
                              <span className={`text-[10px] whitespace-nowrap ${item.dueDate <= today ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                                {item.dueDate}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
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
