import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'

export interface FilteredIssue {
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
  updated?: string | null
  statusUpdate: string | null
  devTeam: string | null
  programManager: string | null
  productManager: string | null
  engPic?: string | null
  links: any[]
}

interface FilterContextType {
  // Combined dataset from all pages
  activeDataset: FilteredIssue[]
  // Per-page datasets
  pageDatasets: Record<string, FilteredIssue[]>
  // Set data for a specific page
  setPageDataset: (pageId: string, issues: FilteredIssue[]) => void
  // Clear a page's data
  clearPageDataset: (pageId: string) => void
  // Legacy: set the whole dataset directly
  setActiveDataset: (issues: FilteredIssue[]) => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [pageDatasets, setPageDatasets] = useState<Record<string, FilteredIssue[]>>({})

  const setPageDataset = useCallback((pageId: string, issues: FilteredIssue[]) => {
    setPageDatasets(prev => ({ ...prev, [pageId]: issues }))
  }, [])

  const clearPageDataset = useCallback((pageId: string) => {
    setPageDatasets(prev => {
      const next = { ...prev }
      delete next[pageId]
      return next
    })
  }, [])

  // Merge all page datasets, deduplicating by key
  const activeDataset = useMemo(() => {
    const seen = new Set<string>()
    const merged: FilteredIssue[] = []
    Object.values(pageDatasets).forEach(issues => {
      issues.forEach(issue => {
        if (!seen.has(issue.key)) {
          seen.add(issue.key)
          merged.push(issue)
        }
      })
    })
    return merged
  }, [pageDatasets])

  // Legacy support
  const setActiveDataset = useCallback((issues: FilteredIssue[]) => {
    setPageDatasets(prev => ({ ...prev, _legacy: issues }))
  }, [])

  return (
    <FilterContext.Provider value={{ activeDataset, pageDatasets, setPageDataset, clearPageDataset, setActiveDataset }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilterContext() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilterContext must be used within FilterProvider')
  return ctx
}
