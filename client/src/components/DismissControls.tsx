import { useState } from 'react'
import { X, Eye, RotateCcw } from 'lucide-react'

interface DismissButtonProps {
  ticketKey: string
  onDismiss: (key: string) => void
}

export function DismissButton({ ticketKey, onDismiss }: DismissButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (window.confirm(`Hide ${ticketKey} from this view? (This won't change anything in Jira)`)) {
      onDismiss(ticketKey)
    }
  }

  return (
    <button
      onClick={handleClick}
      className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-opacity"
      title={`Hide ${ticketKey} from this view`}
    >
      <X className="w-3.5 h-3.5" />
    </button>
  )
}

interface DismissedPanelProps {
  dismissed: string[]
  onRestore: (key: string) => void
  onRestoreAll: () => void
}

export function DismissedPanel({ dismissed, onRestore, onRestoreAll }: DismissedPanelProps) {
  const [showPanel, setShowPanel] = useState(false)

  if (dismissed.length === 0) return null

  return (
    <div className="mt-3">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition"
      >
        <Eye className="w-3 h-3" />
        {dismissed.length} hidden
      </button>

      {showPanel && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Hidden tickets</span>
            <button
              onClick={onRestoreAll}
              className="text-[10px] text-[#76B900] hover:underline flex items-center gap-0.5"
            >
              <RotateCcw className="w-3 h-3" />
              Restore all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dismissed.map(key => (
              <div
                key={key}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600"
              >
                <span>{key}</span>
                <button
                  onClick={() => onRestore(key)}
                  className="text-[#76B900] hover:text-[#5a8f00]"
                  title="Restore"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
