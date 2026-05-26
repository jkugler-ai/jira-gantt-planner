import { useState, useRef } from 'react'
import axios from 'axios'
import { Copy, Check, Mail, AlertTriangle, RefreshCw } from 'lucide-react'
import { useFilterContext } from '../context/FilterContext'

interface IssueDetail {
  key: string
  recentComments: { author: string; body: string; created: string }[]
  recentChanges: { author: string; date: string; field: string; from: string | null; to: string | null }[]
  linkedTitles: Record<string, string>
  dateShifts: { field: string; from: string | null; to: string | null; date: string }[]
}

export default function EmailGeneratorPage() {
  const { activeDataset } = useFilterContext()
  const [generating, setGenerating] = useState(false)
  const [emailHtml, setEmailHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const emailRef = useRef<HTMLDivElement>(null)

  if (activeDataset.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Executive Email Generator</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium">No active dataset</p>
            <p className="text-amber-600 text-sm mt-1">
              Navigate to any data page (Stories, Releases, Sprint Goals, Bugs) and run a query.
              All results will feed into this email generator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  async function generateEmail() {
    setGenerating(true)

    try {
      // Fetch detailed info (comments + link changes from last 7 days)
      const keys = activeDataset.map(i => i.key).join(',')
      const detailsRes = await axios.get('/api/jira/issue-details', { params: { keys } })
      const details: Record<string, IssueDetail> = detailsRes.data.details

      const items = activeDataset
      const today = new Date()
      const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

      // Categorize
      const done = items.filter(i => i.statusCategory === 'done')
      const inProgress = items.filter(i => i.statusCategory === 'indeterminate')
      const toDo = items.filter(i => i.statusCategory === 'new')
      const overdue = items.filter(i => i.dueDate && new Date(i.dueDate) < today && i.statusCategory !== 'done')
      const upcomingDue = items.filter(i => i.dueDate && new Date(i.dueDate) >= today && new Date(i.dueDate) <= twoWeeksOut && i.statusCategory !== 'done')

      // Overall health
      const totalActive = inProgress.length + toDo.length
      const overdueRatio = totalActive > 0 ? overdue.length / totalActive : 0
      let healthStatus = 'On Track'
      let healthColor = '#166534'
      if (overdueRatio > 0.3) { healthStatus = 'At Risk'; healthColor = '#991b1b'; }
      else if (overdueRatio > 0.1 || overdue.length > 2) { healthStatus = 'Needs Attention'; healthColor = '#92400e'; }

      // Overbooked detection
      const assigneeCounts: Record<string, number> = {}
      inProgress.forEach(i => {
        if (i.assignee && i.assignee !== 'Unassigned') {
          assigneeCounts[i.assignee] = (assigneeCounts[i.assignee] || 0) + 1
        }
      })
      const overbooked = Object.entries(assigneeCounts).filter(([_, count]) => count > 3)

      // Collect status updates
      const statusUpdates = items
        .filter(i => i.statusUpdate)
        .map(i => ({ key: i.key, summary: i.summary, update: i.statusUpdate!, assignee: i.assignee }))

      // Collect recent comments across all issues
      const allComments: { key: string; summary: string; author: string; body: string }[] = []
      const allLinkChanges: { key: string; summary: string; to: string | null; from: string | null; linkedTitles: Record<string, string> }[] = []
      const allDateShifts: { key: string; summary: string; field: string; from: string | null; to: string | null }[] = []

      items.forEach(item => {
        const detail = details[item.key]
        if (detail) {
          detail.recentComments.forEach(c => {
            allComments.push({ key: item.key, summary: item.summary, author: c.author, body: c.body })
          })
          detail.recentChanges.forEach(ch => {
            allLinkChanges.push({ key: item.key, summary: item.summary, to: ch.to, from: ch.from, linkedTitles: detail.linkedTitles || {} })
          })
          if (detail.dateShifts) {
            detail.dateShifts.forEach(ds => {
              allDateShifts.push({ key: item.key, summary: item.summary, field: ds.field, from: ds.from, to: ds.to })
            })
          }
        }
      })

      const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

      const jiraLink = (key: string, text?: string) => `<a href="https://jirasw.nvidia.com/browse/${key}" target="_blank" style="color: #76B900; text-decoration: none; font-weight: 600;">${text || key}</a>`

      // Convert Jira wiki markup to HTML
      const jiraMarkupToHtml = (text: string): string => {
        if (!text) return ''
        let html = text
        // {color:#hex}text{color} → colored span
        html = html.replace(/\{color:([^}]+)\}(.*?)\{color\}/g, '<span style="color:$1; font-weight: 600;">$2</span>')
        // {*}text{*} → bold
        html = html.replace(/\{\*\}(.*?)\{\*\}/g, '<strong>$1</strong>')
        // *text* → bold (but not inside URLs)
        html = html.replace(/(?<![\w\/])\*([^*\n]+)\*(?![\w])/g, '<strong>$1</strong>')
        // [text|url] → link
        html = html.replace(/\[([^|\]]+)\|([^\]]+)\]/g, '<a href="$2" target="_blank" style="color: #76B900;">$1</a>')
        // [url] → link
        html = html.replace(/\[([^\]]+)\]/g, '<a href="$1" target="_blank" style="color: #76B900;">$1</a>')
        // {noformat} blocks
        html = html.replace(/\{noformat\}(.*?)\{noformat\}/gs, '<code>$1</code>')
        // Remove remaining {markup} tags
        html = html.replace(/\{[^}]+\}/g, '')
        // Convert OMPE-XXXXX references to links
        html = html.replace(/\b(OMPE-\d+)\b/g, '<a href="https://jirasw.nvidia.com/browse/$1" target="_blank" style="color: #76B900; font-weight: 600;">$1</a>')
        return html
      }

      const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: white; padding: 32px;">
  <!-- Header -->
  <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 3px solid #76B900;">
    <img src="https://www.nvidia.com/content/dam/en-zz/Solutions/about-nvidia/logo-and-brand/02-nvidia-logo-color-grn-500x200-4c25-p@2x.png" alt="NVIDIA" style="height: 40px; margin-bottom: 8px;" />
    <h1 style="margin: 0; color: #1a1a2e; font-size: 22px; font-weight: 700;">OMPE Program Status Update</h1>
    <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">${todayStr}</p>
  </div>

  <!-- Overall Health -->
  <div style="margin-bottom: 20px; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid ${healthColor};">
    <h2 style="margin: 0 0 4px; font-size: 16px; font-weight: 700; color: ${healthColor};">${healthStatus}</h2>
    <p style="margin: 0; font-size: 13px; color: #374151;">
      ${done.length} completed &bull; ${inProgress.length} in progress &bull; ${toDo.length} to do &bull; ${overdue.length} overdue
    </p>
  </div>

  <!-- Summary Stats -->
  <div style="display: flex; gap: 12px; margin-bottom: 24px;">
    <div style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 12px 16px; text-align: center;">
      <div style="font-size: 24px; font-weight: 700; color: #166534;">${done.length}</div>
      <div style="font-size: 11px; color: #166534; text-transform: uppercase; font-weight: 600;">Completed</div>
    </div>
    <div style="flex: 1; background: #fffbeb; border-radius: 8px; padding: 12px 16px; text-align: center;">
      <div style="font-size: 24px; font-weight: 700; color: #92400e;">${inProgress.length}</div>
      <div style="font-size: 11px; color: #92400e; text-transform: uppercase; font-weight: 600;">In Progress</div>
    </div>
    <div style="flex: 1; background: #fef2f2; border-radius: 8px; padding: 12px 16px; text-align: center;">
      <div style="font-size: 24px; font-weight: 700; color: #991b1b;">${overdue.length}</div>
      <div style="font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 600;">At Risk</div>
    </div>
  </div>

  <!-- Status Updates -->
  ${statusUpdates.length > 0 ? `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #1e40af; margin: 0 0 8px;">Status Updates</h2>
    ${statusUpdates.slice(0, 10).map(s => `
    <div style="margin-bottom: 12px; padding-left: 12px; border-left: 3px solid #1e40af20;">
      <div style="font-size: 13px; font-weight: 600;">${jiraLink(s.key)} &mdash; ${s.summary} <span style="color: #6b7280; font-weight: 400;">(${s.assignee})</span></div>
      <div style="font-size: 13px; color: #374151; margin-top: 4px; line-height: 1.6;">${jiraMarkupToHtml(s.update)}</div>
    </div>`).join('')}
  </div>` : ''}

  <!-- Important Upcoming Dates -->
  ${upcomingDue.length > 0 ? `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #7c3aed; margin: 0 0 8px;">Important Dates (Next 2 Weeks)</h2>
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
      ${upcomingDue.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 10).map(i => `<li>${jiraLink(i.key)}: ${i.summary} &mdash; <span style="color: #7c3aed; font-weight: 600;">Due ${i.dueDate}</span> <span style="color: #6b7280;">(${i.assignee})</span></li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- Date Shifts -->
  ${allDateShifts.length > 0 ? `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #b45309; margin: 0 0 8px;">Date Shifts (Last 7 Days)</h2>
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
      ${allDateShifts.slice(0, 10).map(ds => `<li>${jiraLink(ds.key)} &mdash; ${ds.summary}: <span style="color: #6b7280;">${ds.field}</span> <span style="color: #991b1b; text-decoration: line-through;">${ds.from || 'none'}</span> &rarr; <span style="color: #166534; font-weight: 600;">${ds.to || 'removed'}</span></li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- Risks & Overdue -->
  ${overdue.length > 0 ? `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #991b1b; margin: 0 0 8px;">Overdue / At Risk</h2>
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
      ${overdue.slice(0, 8).map(i => `<li>${jiraLink(i.key)}: ${i.summary} &mdash; <span style="color: #991b1b; font-weight: 600;">Due ${i.dueDate}</span> <span style="color: #6b7280;">(${i.assignee})</span></li>`).join('')}
    </ul>
  </div>` : `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #166534; margin: 0 0 8px;">No Overdue Items</h2>
    <p style="color: #6b7280; font-size: 13px; margin: 0;">All tracked items are on schedule.</p>
  </div>`}

  <!-- Resource Concerns -->
  ${overbooked.length > 0 ? `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #92400e; margin: 0 0 8px;">Resource Concerns</h2>
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
      ${overbooked.map(([name, count]) => `<li><strong>${name}</strong> &mdash; ${count} active items (potential overallocation)</li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- Recent Activity (Comments) -->
  ${allComments.length > 0 ? `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #0369a1; margin: 0 0 8px;">Recent Comments (Last 7 Days)</h2>
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
      ${allComments.slice(0, 8).map(c => `<li>${jiraLink(c.key)} &mdash; <strong>${c.summary}</strong>: ${jiraMarkupToHtml(c.body)} <span style="color: #6b7280;">&mdash; ${c.author}</span></li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- New Links/MRs -->
  ${allLinkChanges.length > 0 ? (() => {
    // Group link changes by parent key
    const grouped: Record<string, { summary: string; linkedTitles: Record<string, string>; changes: { to: string | null; from: string | null }[] }> = {};
    allLinkChanges.forEach(l => {
      if (!grouped[l.key]) grouped[l.key] = { summary: l.summary, linkedTitles: l.linkedTitles, changes: [] };
      grouped[l.key].changes.push({ to: l.to, from: l.from });
    });

    // Helper to format a link change with the linked issue's title
    const formatChange = (text: string | null, titles: Record<string, string>, isRemoved: boolean): string => {
      if (!text) return '';
      const keyMatch = text.match(/([A-Z]+-\d+)/);
      const linkedKey = keyMatch ? keyMatch[1] : null;
      const linkedTitle = linkedKey && titles[linkedKey] ? titles[linkedKey] : '';
      // Clean up relationship text (e.g., "This issue is contained in OMPE-94280")
      let relationship = text.replace(/([A-Z]+-\d+)/, '').trim();
      // Remove "This issue" prefix
      relationship = relationship.replace(/^This issue\s*/i, '').trim();
      const action = isRemoved ? 'Removed' : 'Linked';
      if (linkedKey) {
        return `${action}: ${relationship} ${jiraLink(linkedKey)}${linkedTitle ? ` &mdash; ${linkedTitle}` : ''}`;
      }
      return `${action}: ${text}`;
    };

    return `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #065f46; margin: 0 0 8px;">New Links &amp; MRs (Last 7 Days)</h2>
    ${Object.entries(grouped).slice(0, 10).map(([key, data]) => `
    <div style="margin-bottom: 12px; padding-left: 12px; border-left: 3px solid #065f4620;">
      <div style="font-size: 13px; font-weight: 600;">${jiraLink(key)} &mdash; ${data.summary}</div>
      <ol style="margin: 4px 0 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
        ${data.changes.map(ch => 
          `<li>${formatChange(ch.to || ch.from, data.linkedTitles, !ch.to)}</li>`
        ).join('')}
      </ol>
    </div>`).join('')}
  </div>`;
  })() : ''}

  <!-- Wins -->
  ${done.length > 0 ? `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #166534; margin: 0 0 8px;">Completed</h2>
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
      ${done.slice(0, 8).map(i => `<li>${jiraLink(i.key)}: ${i.summary} <span style="color: #6b7280;">(${i.assignee})</span></li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- Footer -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
    <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
      Generated by Mission Control &bull; OMPE Program Management Dashboard<br/>
      Program Manager: Jen Kugler | Data sourced from Jira (OMPE)
    </p>
  </div>
</div>`.trim()

      setEmailHtml(html)
    } catch (err) {
      console.error('Email generation error:', err)
      setEmailHtml('<div style="color: red; padding: 20px;">Failed to generate email. Check console for details.</div>')
    } finally {
      setGenerating(false)
    }
  }

  async function copyToClipboard() {
    if (emailRef.current) {
      try {
        const blob = new Blob([emailHtml], { type: 'text/html' })
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': blob })
        ])
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        const range = document.createRange()
        range.selectNodeContents(emailRef.current)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Email Generator</h1>
          <p className="text-gray-500 text-sm mt-1">
            Generates from {activeDataset.length} stories • Includes status updates, comments & link changes from last 7 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateEmail}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-[#76B900] hover:bg-[#5a8f00] text-white font-medium rounded-lg transition disabled:opacity-50"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Generate Summary'}
          </button>
          {emailHtml && (
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          )}
        </div>
      </div>

      {emailHtml ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className="ml-4 text-xs text-gray-500">Email Preview — Edit below then copy/paste into your email client</span>
          </div>
          <div
            ref={emailRef}
            className="p-8"
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: emailHtml }}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Ready to generate</h3>
          <p className="text-gray-500 text-sm">
            Click "Generate Summary" to create an executive status email from your {activeDataset.length} active stories.<br/>
            Includes status updates, recent comments, new MRs/links, health assessment, and key dates.
          </p>
        </div>
      )}

      <div className="mt-4 bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
        <strong>Tip:</strong> The preview is editable — tweak text before copying. "Copy to Clipboard" copies rich HTML that pastes into Outlook/Gmail with formatting intact.
      </div>
    </div>
  )
}
