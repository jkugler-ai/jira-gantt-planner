import { useState, useEffect, useCallback } from 'react'

/**
 * Hook to manage dismissed (hidden) ticket keys per page.
 * Data is persisted server-side via /api/storage/dismissed-{pageId}
 */
export function useDismissed(pageId: string) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  const storageKey = `dismissed-${pageId}`

  // Load dismissed list from server on mount
  useEffect(() => {
    let cancelled = false
    fetch(`/api/storage/${storageKey}`)
      .then(res => {
        if (res.ok) return res.json()
        return []
      })
      .then(data => {
        if (!cancelled) {
          setDismissed(Array.isArray(data) ? data : [])
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDismissed([])
          setLoaded(true)
        }
      })
    return () => { cancelled = true }
  }, [storageKey])

  // Persist to server
  const persist = useCallback((keys: string[]) => {
    fetch(`/api/storage/${storageKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keys),
    }).catch(() => {})
  }, [storageKey])

  const dismiss = useCallback((ticketKey: string) => {
    setDismissed(prev => {
      if (prev.includes(ticketKey)) return prev
      const next = [...prev, ticketKey]
      persist(next)
      return next
    })
  }, [persist])

  const restore = useCallback((ticketKey: string) => {
    setDismissed(prev => {
      const next = prev.filter(k => k !== ticketKey)
      persist(next)
      return next
    })
  }, [persist])

  const restoreAll = useCallback(() => {
    setDismissed([])
    persist([])
  }, [persist])

  const isDismissed = useCallback((ticketKey: string) => {
    return dismissed.includes(ticketKey)
  }, [dismissed])

  return { dismissed, loaded, dismiss, restore, restoreAll, isDismissed }
}
