import React, { useState, useCallback, useMemo } from 'react';
import { JiraConfig, JiraIssue, ZoomLevel } from './types';
import { ConfigPanel } from './components/ConfigPanel';
import { GanttChart } from './components/GanttChart';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { fetchHierarchy } from './hooks/jiraApi';

function collectMetadata(node: JiraIssue, statuses: Set<string>, assignees: Set<string>, types: Set<string>) {
  statuses.add(node.status);
  if (node.assignee) assignees.add(node.assignee);
  types.add(node.issueType);
  for (const child of node.children) {
    collectMetadata(child, statuses, assignees, types);
  }
}

function collectAllKeys(node: JiraIssue, keys: Set<string>) {
  keys.add(node.key);
  for (const child of node.children) {
    collectAllKeys(child, keys);
  }
}

export const App: React.FC = () => {
  const [config, setConfig] = useState<JiraConfig | null>(() => {
    const saved = localStorage.getItem('jira-gantt-config');
    return saved ? JSON.parse(saved) : null;
  });
  const [data, setData] = useState<JiraIssue | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ status: [] as string[], assignee: [] as string[], issueType: [] as string[] });
  const [showFilters, setShowFilters] = useState(false);
  
  const handleConnect = useCallback(async (newConfig: JiraConfig) => {
    setConfig(newConfig);
    setLoading(true);
    setError(null);
    setProgress('Starting...');
    
    try {
      const hierarchy = await fetchHierarchy(newConfig, newConfig.rootIssueKey, 0, new Set(), setProgress);
      setData(hierarchy);
      
      // Auto-expand first two levels
      const expanded = new Set<string>();
      expanded.add(hierarchy.key);
      for (const child of hierarchy.children) {
        expanded.add(child.key);
      }
      setExpandedKeys(expanded);
      setProgress('');
    } catch (e: any) {
      setError(e.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);
  
  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);
  
  const { allStatuses, allAssignees, allTypes } = useMemo(() => {
    if (!data) return { allStatuses: [], allAssignees: [], allTypes: [] };
    const statuses = new Set<string>();
    const assignees = new Set<string>();
    const types = new Set<string>();
    collectMetadata(data, statuses, assignees, types);
    return {
      allStatuses: Array.from(statuses).sort(),
      allAssignees: Array.from(assignees).sort(),
      allTypes: Array.from(types).sort(),
    };
  }, [data]);
  
  return (
    <div className="h-screen flex flex-col">
      <ConfigPanel config={config} onConnect={handleConnect} loading={loading} progress={progress} />
      
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-700 text-red-300 text-sm">
          Error: {error}
        </div>
      )}
      
      {data && (
        <>
          <Toolbar
            zoom={zoom}
            onZoomChange={setZoom}
            allStatuses={allStatuses}
            allAssignees={allAssignees}
            allTypes={allTypes}
            filters={filters}
            onFiltersChange={setFilters}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
          />
          
          <div className="flex flex-1 overflow-hidden">
            <GanttChart
              data={data}
              zoom={zoom}
              onSelectIssue={setSelectedIssue}
              selectedIssue={selectedIssue}
              expandedKeys={expandedKeys}
              onToggleExpand={toggleExpand}
              filters={filters}
            />
            
            <Sidebar
              issue={selectedIssue}
              jiraBaseUrl={config?.baseUrl || ''}
              onClose={() => setSelectedIssue(null)}
            />
          </div>
        </>
      )}
      
      {!data && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-lg">Connect to your Jira instance to visualize your project plan</p>
          </div>
        </div>
      )}
    </div>
  );
};
