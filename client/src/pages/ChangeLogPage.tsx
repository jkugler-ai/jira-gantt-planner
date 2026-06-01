import { useState, useEffect } from 'react'
import { History, RefreshCw, ArrowRight, Calendar, AlertTriangle } from 'lucide-react'
import axios from 'axios'

interface ChangeItem {
  key: string
  summary: string
  field: string
  from: string | null
  to: string | null
  date: string
  author: string
}

interface NewItem {
  key: string
  summary: string
  type: string
  created: string
  assignee: string
}

export default function ChangeLogPage() {
  const [changes, setChanges] = useState<ChangeItem[]>([])
  const [newItems, setNewItems] = useState<NewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(1)
  const [error, setError] = useState('')

  async function fetchChanges() {
    setLoading(true)
    setError('')
    try {
      // Fetch recently updated items
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      // Get items updated in the timeframe
      const updatedJql = `project = OMPE AND updated >= "${sinceDate}" AND status != Done ORDER BY updated DESC`
      const updatedRes = await axios.get('/api/jira/query', { params: { jql: updatedJql } })
      const updatedIssues = updatedRes.data.issues || []

      // Get newly created items
      const createdJql = `project = OMPE AND created >= "${sinceDate}" ORDER BY created DESC`
      const createdRes = await axios.get('/api/jira/query', { params: { jql: createdJql } })
      const createdIssues = (createdRes.data.issues || []).map((i: any) => ({
        key: i.key,
        summary: i.summary,
        type: i.type || 'Unknown',
        created: i.created,
        assignee: i.assignee || 'Unassigned'
      }))
      setNewItems(createdIssues)

      // Fetch changelogs for updated items (batch of first 30 to avoid overload)
      const keysToCheck = updatedIssues.slice(0, 30).map((i: any) => i.key)
      if (keysToCheck.length > 0) {
        const detailsRes = await axios.get('/api/jira/issue-details', {
          params: { keys: keysToCheck.join(',') }
        })
        const details = detailsRes.data.details || {}

        const allChanges: ChangeItem[] = []
        for (const key of Object.keys(details)) {
          const d = details[key]
          const issue = updatedIssues.find((i: any) => i.key === key)
          
          // Date shifts
          if (d.dateShifts) {
            for (const shift of d.dateShifts) {
              allChanges.push({
                key,
                summary: issue?.summary || '',
                field: shift.field,
                from: shift.from,
                to: shift.to,
                date: shift.date?.split('T')[0] || '',
                author: ''
              })
            }
          }

          // Status transitions from recent changes
          if (d.recentChanges) {
            for (const ch of d.recentChanges) {
              allChanges.push({
                key,
                summary: issue?.summary || '',
                field: ch.field || 'Link',
                from: ch.from,
                to: ch.to,
                date: ch.date?.split('T')[0] || '',
                author: ch.author || ''
              })
            }
          }
        }

        setChanges(allChanges.sort((a, b) => (b.date || '').localeCompare(a.date || '')))
      } else {
        setChanges([])
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch change log')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchChanges()
  }, [days])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="w-6 h-6 text-[#76B900]" />
            Change Log
          </h1>
          <p className="text-gray-500 text-sm mt-1">What changed recently across your program</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#76B900] outline-none"
          >
            <option value={1}>Last 24 hours</option>
            <option value={2}>Last 2 days</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
          </select>
          <button
            onClick={fetchChanges}
            disabled={loading}
            className="px-4 py-2 bg-[#76B900] text-white rounded-lg text-sm font-medium hover:bg-[#5a8f00] disabled:opacity-50 transition flex items-center gap-1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Scanning for changes...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* New Items */}
          {newItems.length > 0 && (
            <div className="bg-green-50 rounded-xl border border-green-200 p-5">
              <h2 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                New Items ({newItems.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-green-200">
                      <th className="text-left text-xs font-medium text-green-600 uppercase py-1.5 pr-3">Key</th>
                      <th className="text-left text-xs font-medium text-green-600 uppercase py-1.5 pr-3">Type</th>
                      <th className="text-left text-xs font-medium text-green-600 uppercase py-1.5 pr-3">Summary</th>
                      <th className="text-left text-xs font-medium text-green-600 uppercase py-1.5 pr-3">Assignee</th>
                      <th className="text-left text-xs font-medium text-green-600 uppercase py-1.5">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newItems.map(item => (
                      <tr key={item.key} className="border-b border-green-100 last:border-0">
                        <td className="py-1.5 pr-3">
                          <a
                            href={`https://jirasw.nvidia.com/browse/${item.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#76B900] font-medium hover:underline whitespace-nowrap"
                          >
                            {item.key}
                          </a>
                        </td>
                        <td className="py-1.5 pr-3 text-xs text-gray-500">{item.type}</td>
                        <td className="py-1.5 pr-3 text-gray-700">{item.summary}</td>
                        <td className="py-1.5 pr-3 text-gray-600">{item.assignee}</td>
                        <td className="py-1.5 text-gray-500">{item.created}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Date Shifts */}
          {changes.filter(c => c.field === 'Due Date' || c.field === 'Start Date').length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
              <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Date Shifts ({changes.filter(c => c.field === 'Due Date' || c.field === 'Start Date').length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-200">
                      <th className="text-left text-xs font-medium text-amber-600 uppercase py-1.5 pr-3">Key</th>
                      <th className="text-left text-xs font-medium text-amber-600 uppercase py-1.5 pr-3">Summary</th>
                      <th className="text-left text-xs font-medium text-amber-600 uppercase py-1.5 pr-3">Field</th>
                      <th className="text-left text-xs font-medium text-amber-600 uppercase py-1.5 pr-3">Change</th>
                      <th className="text-left text-xs font-medium text-amber-600 uppercase py-1.5">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes
                      .filter(c => c.field === 'Due Date' || c.field === 'Start Date')
                      .map((c, i) => (
                        <tr key={`${c.key}-${i}`} className="border-b border-amber-100 last:border-0">
                          <td className="py-1.5 pr-3">
                            <a
                              href={`https://jirasw.nvidia.com/browse/${c.key}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#76B900] font-medium hover:underline whitespace-nowrap"
                            >
                              {c.key}
                            </a>
                          </td>
                          <td className="py-1.5 pr-3 text-gray-700 truncate max-w-[250px]">{c.summary}</td>
                          <td className="py-1.5 pr-3 text-xs text-amber-600 font-medium">{c.field}</td>
                          <td className="py-1.5 pr-3">
                            <span className="inline-flex items-center gap-1 text-xs">
                              <span className="text-gray-500 line-through">{c.from || 'none'}</span>
                              <ArrowRight className="w-3 h-3 text-gray-400" />
                              <span className="text-amber-700 font-medium">{c.to || 'none'}</span>
                            </span>
                          </td>
                          <td className="py-1.5 text-gray-500 text-xs">{c.date}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Link Changes */}
          {changes.filter(c => c.field === 'Link' || c.field === 'RemoteIssueLink').length > 0 && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
              <h2 className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                Link Changes ({changes.filter(c => c.field === 'Link' || c.field === 'RemoteIssueLink').length})
              </h2>
              <div className="space-y-2">
                {changes
                  .filter(c => c.field === 'Link' || c.field === 'RemoteIssueLink')
                  .slice(0, 20)
                  .map((c, i) => (
                    <div key={`${c.key}-link-${i}`} className="flex items-center gap-2 text-sm border-b border-blue-100 last:border-0 py-1.5">
                      <a
                        href={`https://jirasw.nvidia.com/browse/${c.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#76B900] font-medium hover:underline whitespace-nowrap"
                      >
                        {c.key}
                      </a>
                      <span className="text-gray-500 text-xs">
                        {c.to ? `+ ${c.to}` : c.from ? `- ${c.from}` : 'link changed'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* No changes */}
          {changes.length === 0 && newItems.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No changes detected in the last {days} day{days > 1 ? 's' : ''}.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
