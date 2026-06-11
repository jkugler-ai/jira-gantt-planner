import { useState, useEffect } from 'react'

interface SavedQuery {
  name: string
  jql: string
  isDefault: boolean
}

export interface SavedView {
  name: string
  jql: string
  filters: {
    devTeam: string[]
    assignee: string[]
    programManager: string[]
    productManager: string[]
    engPic: string[]
    status: string[]
  }
  isDefault: boolean
}

interface PageQueries {
  [pageId: string]: SavedQuery[]
}

interface PageViews {
  [pageId: string]: SavedView[]
}

const STORAGE_KEY = 'mission-control-saved-queries'
const VIEWS_STORAGE_KEY = 'mission-control-saved-views'

// --- Server helpers (fire-and-forget writes, best-effort reads) ---

async function fetchFromServer<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/storage/${key}`)
    if (res.ok) {
      return await res.json()
    }
  } catch {}
  return null
}

function writeToServer(key: string, data: unknown): void {
  fetch(`/api/storage/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {})
}

// --- Queries ---

export function getSavedQueries(pageId: string): SavedQuery[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    const all: PageQueries = JSON.parse(data)
    return all[pageId] || []
  } catch {
    return []
  }
}

export function saveQuery(pageId: string, query: SavedQuery): void {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    const all: PageQueries = data ? JSON.parse(data) : {}
    if (!all[pageId]) all[pageId] = []
    
    // If setting as default, unset others
    if (query.isDefault) {
      all[pageId] = all[pageId].map(q => ({ ...q, isDefault: false }))
    }
    
    // Check if query with same name exists
    const idx = all[pageId].findIndex(q => q.name === query.name)
    if (idx >= 0) {
      all[pageId][idx] = query
    } else {
      all[pageId].push(query)
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    writeToServer('saved-queries', all)
  } catch {
    // silently fail
  }
}

export function deleteQuery(pageId: string, name: string): void {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return
    const all: PageQueries = JSON.parse(data)
    if (!all[pageId]) return
    all[pageId] = all[pageId].filter(q => q.name !== name)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    writeToServer('saved-queries', all)
  } catch {
    // silently fail
  }
}

export function getDefaultQuery(pageId: string, fallback: string): string {
  const queries = getSavedQueries(pageId)
  const defaultQ = queries.find(q => q.isDefault)
  return defaultQ ? defaultQ.jql : fallback
}

// --- Saved Views (JQL + filters) ---

export function getSavedViews(pageId: string): SavedView[] {
  try {
    const data = localStorage.getItem(VIEWS_STORAGE_KEY)
    if (!data) return []
    const all: PageViews = JSON.parse(data)
    return all[pageId] || []
  } catch {
    return []
  }
}

export function saveView(pageId: string, view: SavedView): void {
  try {
    const data = localStorage.getItem(VIEWS_STORAGE_KEY)
    const all: PageViews = data ? JSON.parse(data) : {}
    if (!all[pageId]) all[pageId] = []
    
    if (view.isDefault) {
      all[pageId] = all[pageId].map(v => ({ ...v, isDefault: false }))
    }
    
    const idx = all[pageId].findIndex(v => v.name === view.name)
    if (idx >= 0) {
      all[pageId][idx] = view
    } else {
      all[pageId].push(view)
    }
    
    localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(all))
    writeToServer('saved-views', all)
  } catch {
    // silently fail
  }
}

export function deleteView(pageId: string, name: string): void {
  try {
    const data = localStorage.getItem(VIEWS_STORAGE_KEY)
    if (!data) return
    const all: PageViews = JSON.parse(data)
    if (!all[pageId]) return
    all[pageId] = all[pageId].filter(v => v.name !== name)
    localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(all))
    writeToServer('saved-views', all)
  } catch {
    // silently fail
  }
}

// --- Hooks with server hydration ---

export function useSavedQueries(pageId: string) {
  const [queries, setQueries] = useState<SavedQuery[]>([])

  useEffect(() => {
    // Load from localStorage immediately
    setQueries(getSavedQueries(pageId))

    // Then try to hydrate from server
    fetchFromServer<PageQueries>('saved-queries').then(serverData => {
      if (serverData) {
        const localData = localStorage.getItem(STORAGE_KEY)
        const local: PageQueries = localData ? JSON.parse(localData) : {}
        // If server has data but localStorage doesn't (or is empty for this page)
        if (serverData[pageId]?.length && !(local[pageId]?.length)) {
          // Merge server into local
          const merged = { ...local, ...serverData }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
          setQueries(merged[pageId] || [])
        } else if (local[pageId]?.length && !serverData[pageId]?.length) {
          // Backfill server with localStorage data
          writeToServer('saved-queries', local)
        }
      }
    })
  }, [pageId])

  const refresh = () => setQueries(getSavedQueries(pageId))

  const save = (query: SavedQuery) => {
    saveQuery(pageId, query)
    refresh()
  }

  const remove = (name: string) => {
    deleteQuery(pageId, name)
    refresh()
  }

  return { queries, save, remove, refresh }
}

export function useSavedViews(pageId: string) {
  const [views, setViews] = useState<SavedView[]>([])

  useEffect(() => {
    // Load from localStorage immediately
    setViews(getSavedViews(pageId))

    // Then try to hydrate from server
    fetchFromServer<PageViews>('saved-views').then(serverData => {
      if (serverData) {
        const localData = localStorage.getItem(VIEWS_STORAGE_KEY)
        const local: PageViews = localData ? JSON.parse(localData) : {}
        if (serverData[pageId]?.length && !(local[pageId]?.length)) {
          const merged = { ...local, ...serverData }
          localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(merged))
          setViews(merged[pageId] || [])
        } else if (local[pageId]?.length && !serverData[pageId]?.length) {
          writeToServer('saved-views', local)
        }
      }
    })
  }, [pageId])

  const refresh = () => setViews(getSavedViews(pageId))

  const save = (view: SavedView) => {
    saveView(pageId, view)
    refresh()
  }

  const remove = (name: string) => {
    deleteView(pageId, name)
    refresh()
  }

  return { views, save, remove, refresh }
}
