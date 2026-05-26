import { useState, useRef } from 'react'
import { Copy, Check, Mail, AlertTriangle } from 'lucide-react'
import { useFilterContext } from '../context/FilterContext'

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
              Expand sprint goals on the Sprint Goals page to populate data for this view.
              The Email Generator will create a status update based on the user stories you've expanded there.
            </p>
          </div>
        </div>
      </div>
    )
  }

  function generateEmail() {
    setGenerating(true)

    const items = activeDataset

    // Categorize items
    const done = items.filter(i => i.statusCategory === 'done')
    const inProgress = items.filter(i => i.statusCategory === 'indeterminate')
    const overdue = items.filter(i => i.dueDate && new Date(i.dueDate) < new Date() && i.statusCategory !== 'done')

    // Detect overbooked people
    const assigneeCounts: Record<string, number> = {}
    inProgress.forEach(i => {
      if (i.assignee && i.assignee !== 'Unassigned') {
        assigneeCounts[i.assignee] = (assigneeCounts[i.assignee] || 0) + 1
      }
    })
    const overbooked = Object.entries(assigneeCounts).filter(([_, count]) => count > 3)

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: white; padding: 32px;">
  <!-- Header with NVIDIA logo -->
  <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 3px solid #76B900;">
    <img src="https://www.nvidia.com/content/dam/en-zz/Solutions/about-nvidia/logo-and-brand/02-nvidia-logo-color-grn-500x200-4c25-p@2x.png" alt="NVIDIA" style="height: 40px; margin-bottom: 8px;" />
    <h1 style="margin: 0; color: #1a1a2e; font-size: 22px; font-weight: 700;">OMPE Program Status Update</h1>
    <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">${today}</p>
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

  <!-- Wins -->
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #166534; margin: 0 0 8px; display: flex; align-items: center;">
      🟢 Wins & Completions
    </h2>
    ${done.length > 0 ? `
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
      ${done.slice(0, 8).map(i => `<li><strong>${i.key}</strong>: ${i.summary} <span style="color: #6b7280;">(${i.assignee})</span></li>`).join('')}
    </ul>` : '<p style="color: #6b7280; font-size: 13px; margin: 0;">No completions this period.</p>'}
  </div>

  <!-- Risks -->
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #991b1b; margin: 0 0 8px;">
      🔴 Risks & Misses
    </h2>
    ${overdue.length > 0 ? `
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
      ${overdue.slice(0, 8).map(i => `<li><strong>${i.key}</strong>: ${i.summary} — <span style="color: #991b1b;">Due ${i.dueDate}</span> <span style="color: #6b7280;">(${i.assignee})</span></li>`).join('')}
    </ul>` : '<p style="color: #6b7280; font-size: 13px; margin: 0;">No overdue items. 🎉</p>'}
  </div>

  <!-- Overbooked -->
  ${overbooked.length > 0 ? `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #92400e; margin: 0 0 8px;">
      🟡 Resource Concerns
    </h2>
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
      ${overbooked.map(([name, count]) => `<li><strong>${name}</strong> — ${count} active items (potential overallocation)</li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- In Progress Highlights -->
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 15px; font-weight: 700; color: #1e40af; margin: 0 0 8px;">
      🔵 Key Work In Progress
    </h2>
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 13px; line-height: 1.8;">
      ${inProgress.slice(0, 8).map(i => `<li><strong>${i.key}</strong>: ${i.summary} <span style="color: #6b7280;">(${i.assignee}${i.dueDate ? `, due ${i.dueDate}` : ''})</span></li>`).join('')}
    </ul>
  </div>

  <!-- Footer -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
    <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
      Generated by Mission Control • OMPE Program Management Dashboard<br/>
      Program Manager: Jen Kugler | Data sourced from Jira (OMPE)
    </p>
  </div>
</div>
    `.trim()

    setEmailHtml(html)
    setGenerating(false)
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
            Generate from {activeDataset.length} stories in active dataset
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateEmail}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-[#76B900] hover:bg-[#5a8f00] text-white font-medium rounded-lg transition disabled:opacity-50"
          >
            <Mail className="w-4 h-4" />
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
          <p className="text-gray-500 text-sm">Click "Generate Summary" to create an executive status email from your {activeDataset.length} active stories.</p>
        </div>
      )}

      {/* Tips */}
      <div className="mt-4 bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
        <strong>Tip:</strong> The preview above is editable — modify the text directly before copying. The "Copy to Clipboard" button copies rich HTML that pastes beautifully into Outlook and Gmail.
      </div>
    </div>
  )
}
