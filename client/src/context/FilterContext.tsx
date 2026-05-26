import { createContext, useContext, useState } from 'react'
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
  statusUpdate: string | null
  devTeam: string | null
  programManager: string | null
  productManager: string | null
  links: any[]
}

interface FilterContextType {
  activeDataset: FilteredIssue[]
  setActiveDataset: (issues: FilteredIssue[]) => void
  addToDataset: (issues: FilteredIssue[]) => void
  removeFromDataset: (keys: string[]) => void
  clearDataset: () => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [activeDataset, setActiveDatasetState] = useState<FilteredIssue[]>([])

  const setActiveDataset = (issues: FilteredIssue[]) => {
    setActiveDatasetState(issues)
  }

  const addToDataset = (issues: FilteredIssue[]) => {
    setActiveDatasetState(prev => {
      const existingKeys = new Set(prev.map(i => i.key))
      const newIssues = issues.filter(i => !existingKeys.has(i.key))
      return [...prev, ...newIssues]
    })
  }

  const removeFromDataset = (keys: string[]) => {
    const keySet = new Set(keys)
    setActiveDatasetState(prev => prev.filter(i => !keySet.has(i.key)))
  }

  const clearDataset = () => {
    setActiveDatasetState([])
  }

  return (
    <FilterContext.Provider value={{ activeDataset, setActiveDataset, addToDataset, removeFromDataset, clearDataset }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilterContext() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilterContext must be used within FilterProvider')
  return ctx
}
