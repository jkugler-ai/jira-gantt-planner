import React from 'react';
import { ZoomLevel } from '../types';
import { Filter } from 'lucide-react';

interface ToolbarProps {
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  allStatuses: string[];
  allAssignees: string[];
  allTypes: string[];
  filters: { status: string[]; assignee: string[]; issueType: string[] };
  onFiltersChange: (filters: { status: string[]; assignee: string[]; issueType: string[] }) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  zoom,
  onZoomChange,
  allStatuses,
  allAssignees,
  allTypes,
  filters,
  onFiltersChange,
  showFilters,
  onToggleFilters,
}) => {
  const toggleFilter = (category: 'status' | 'assignee' | 'issueType', value: string) => {
    const current = filters[category];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [category]: updated });
  };
  
  return (
    <div className="border-b border-nvidia-border">
      <div className="flex items-center gap-4 px-4 py-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-nvidia-surface rounded px-1 py-0.5">
          {(['day', 'week', 'month'] as ZoomLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => onZoomChange(level)}
              className={`px-3 py-1 rounded text-sm capitalize ${
                zoom === level
                  ? 'bg-nvidia-green text-white font-bold shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        
        {/* Filter toggle */}
        <button
          onClick={onToggleFilters}
          className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${
            showFilters ? 'bg-nvidia-green text-white' : 'text-gray-600 hover:text-gray-900 border border-nvidia-border'
          }`}
        >
          <Filter size={14} />
          Filters
          {(filters.status.length + filters.assignee.length + filters.issueType.length > 0) && (
            <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">
              {filters.status.length + filters.assignee.length + filters.issueType.length}
            </span>
          )}
        </button>
        
        {/* Clear filters */}
        {(filters.status.length + filters.assignee.length + filters.issueType.length > 0) && (
          <button
            onClick={() => onFiltersChange({ status: [], assignee: [], issueType: [] })}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Clear all
          </button>
        )}
      </div>
      
      {/* Filter panel */}
      {showFilters && (
        <div className="px-4 py-3 bg-nvidia-surface border-t border-nvidia-border grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Status</label>
            <div className="flex flex-wrap gap-1">
              {allStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleFilter('status', s)}
                  className={`px-2 py-0.5 rounded text-xs ${
                    filters.status.includes(s)
                      ? 'bg-nvidia-green text-white font-bold'
                      : 'bg-white border border-nvidia-border text-gray-700 hover:border-nvidia-green'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Assignee</label>
            <div className="flex flex-wrap gap-1">
              {allAssignees.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleFilter('assignee', a)}
                  className={`px-2 py-0.5 rounded text-xs ${
                    filters.assignee.includes(a)
                      ? 'bg-nvidia-green text-white font-bold'
                      : 'bg-white border border-nvidia-border text-gray-700 hover:border-nvidia-green'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Issue Type</label>
            <div className="flex flex-wrap gap-1">
              {allTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleFilter('issueType', t)}
                  className={`px-2 py-0.5 rounded text-xs ${
                    filters.issueType.includes(t)
                      ? 'bg-nvidia-green text-white font-bold'
                      : 'bg-white border border-nvidia-border text-gray-700 hover:border-nvidia-green'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
