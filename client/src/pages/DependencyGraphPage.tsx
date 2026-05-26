import { useState, useEffect, useCallback } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow'
import type { Node, Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import { AlertTriangle } from 'lucide-react'
import { useFilterContext } from '../context/FilterContext'
import type { FilteredIssue } from '../context/FilterContext'

const statusColors: Record<string, string> = {
  done: '#10b981',
  indeterminate: '#f59e0b',
  new: '#94a3b8',
}

export default function DependencyGraphPage() {
  const { activeDataset } = useFilterContext()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<FilteredIssue | null>(null)

  useEffect(() => {
    if (activeDataset.length > 0) {
      buildGraph(activeDataset)
    } else {
      setNodes([])
      setEdges([])
    }
  }, [activeDataset])

  function buildGraph(data: FilteredIssue[]) {
    const keySet = new Set(data.map(i => i.key))

    // Create nodes in a grid layout
    const cols = Math.ceil(Math.sqrt(data.length))
    const flowNodes: Node[] = data.map((item, idx) => ({
      id: item.key,
      position: {
        x: (idx % cols) * 280 + Math.random() * 40,
        y: Math.floor(idx / cols) * 120 + Math.random() * 20
      },
      data: {
        label: (
          <div className="text-left">
            <div className="text-xs font-bold text-[#76B900]">{item.key}</div>
            <div className="text-[10px] text-gray-700 truncate max-w-[180px]">{item.summary}</div>
            <div className="text-[9px] text-gray-500 mt-0.5">{item.assignee}</div>
          </div>
        ),
      },
      style: {
        border: `2px solid ${statusColors[item.statusCategory] || '#76B900'}`,
        borderRadius: '8px',
        padding: '8px 12px',
        background: 'white',
        fontSize: '11px',
        width: 200,
      },
    }))

    // Create edges from issue links
    const flowEdges: Edge[] = []
    const edgeSet = new Set<string>()

    for (const item of data) {
      for (const link of item.links) {
        const target = link.outwardIssue?.key || link.inwardIssue?.key
        if (target && keySet.has(target)) {
          const edgeId = `${item.key}-${target}`
          const reverseId = `${target}-${item.key}`
          if (!edgeSet.has(edgeId) && !edgeSet.has(reverseId)) {
            edgeSet.add(edgeId)
            const direction = link.outwardIssue ? 'outward' : 'inward'
            flowEdges.push({
              id: edgeId,
              source: direction === 'outward' ? item.key : target,
              target: direction === 'outward' ? target : item.key,
              markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
              style: { stroke: '#94a3b8', strokeWidth: 1.5 },
              label: link.type?.name || '',
              labelStyle: { fontSize: 9, fill: '#6b7280' },
              animated: (link.type?.name || '').toLowerCase().includes('block'),
            })
          }
        }
      }
    }

    setNodes(flowNodes)
    setEdges(flowEdges)
  }

  const onNodeClick = useCallback((_: any, node: Node) => {
    const item = activeDataset.find(i => i.key === node.id)
    setSelectedNode(item || null)
  }, [activeDataset])

  if (activeDataset.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Dependency Graph</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium">No active dataset</p>
            <p className="text-amber-600 text-sm mt-1">
              Navigate to any data page (Stories, Releases, Sprint Goals, Bugs) and run a query.
              All results will appear here automatically.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dependency Graph</h1>
          <p className="text-gray-500 text-sm mt-1">
            Showing {activeDataset.length} stories • Click nodes for details
          </p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm relative" style={{ minHeight: 500 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const item = activeDataset.find(i => i.key === n.id)
              return statusColors[item?.statusCategory || ''] || '#76B900'
            }}
            maskColor="rgba(255,255,255,0.8)"
          />
        </ReactFlow>

        {/* Detail panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-72 bg-white rounded-xl border border-gray-200 shadow-lg p-4 z-10">
            <div className="flex items-center justify-between mb-2">
              <a
                href={`https://jirasw.nvidia.com/browse/${selectedNode.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#76B900] font-bold hover:underline"
              >
                {selectedNode.key}
              </a>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >×</button>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">{selectedNode.summary}</h3>
            <div className="space-y-1 text-xs text-gray-600">
              <div><span className="font-medium">Status:</span> {selectedNode.status}</div>
              <div><span className="font-medium">Assignee:</span> {selectedNode.assignee}</div>
              <div><span className="font-medium">Dev Team:</span> {selectedNode.devTeam || '—'}</div>
              <div><span className="font-medium">Links:</span> {selectedNode.links.length} connections</div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-emerald-500"></div> Done
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-amber-500"></div> In Progress
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-slate-400"></div> To Do
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-400">- - →</span> Blocks (animated)
        </div>
      </div>
    </div>
  )
}
