import { useState, useEffect } from 'react'

interface SavedQuery {
  name: string
  jql: string
  isDefault: boolean
}

interface PageQueries {
  [pageId: string]: SavedQuery[]
}

const STORAGE_KEY = 'mission-control-saved-queries'

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
  } catch {
    // silently fail
  }
}

export function getDefaultQuery(pageId: string, fallback: string): string {
  const queries = getSavedQueries(pageId)
  const defaultQ = queries.find(q => q.isDefault)
  return defaultQ ? defaultQ.jql : fallback
}

export function useSavedQueries(pageId: string) {
  const [queries, setQueries] = useState<SavedQuery[]>([])

  useEffect(() => {
    setQueries(getSavedQueries(pageId))
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
