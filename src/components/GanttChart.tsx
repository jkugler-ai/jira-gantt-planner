import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { JiraIssue, ZoomLevel } from '../types';

interface GanttChartProps {
  data: JiraIssue;
  zoom: ZoomLevel;
  onSelectIssue: (issue: JiraIssue) => void;
  selectedIssue: JiraIssue | null;
  expandedKeys: Set<string>;
  onToggleExpand: (key: string) => void;
  filters: { status: string[]; assignee: string[]; issueType: string[] };
}

const STATUS_COLORS: Record<string, string> = {
  'To Do': '#9ca3af',
  'In Progress': '#3b82f6',
  'Closed': '#22c55e',
  'Done': '#22c55e',
  'Needs Review': '#eab308',
  'In Review': '#eab308',
  'Unknown': '#9ca3af',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || '#9ca3af';
}

function flattenTree(
  node: JiraIssue,
  expandedKeys: Set<string>,
  filters: { status: string[]; assignee: string[]; issueType: string[] },
  result: JiraIssue[] = [],
  depth: number = 0
): JiraIssue[] {
  const passesFilter = (
    (filters.status.length === 0 || filters.status.includes(node.status)) &&
    (filters.assignee.length === 0 || (node.assignee && filters.assignee.includes(node.assignee))) &&
    (filters.issueType.length === 0 || filters.issueType.includes(node.issueType))
  );
  
  if (passesFilter || depth === 0) {
    result.push({ ...node, depth });
    if (expandedKeys.has(node.key)) {
      for (const child of node.children) {
        flattenTree(child, expandedKeys, filters, result, depth + 1);
      }
    }
  }
  
  return result;
}

function getAllBlockerPairs(node: JiraIssue, result: { from: string; to: string }[] = []): { from: string; to: string }[] {
  for (const blockerKey of node.blockedBy) {
    result.push({ from: blockerKey, to: node.key });
  }
  for (const child of node.children) {
    getAllBlockerPairs(child, result);
  }
  return result;
}

export const GanttChart: React.FC<GanttChartProps> = ({
  data,
  zoom,
  onSelectIssue,
  selectedIssue,
  expandedKeys,
  onToggleExpand,
  filters,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const rows = useMemo(() => flattenTree(data, expandedKeys, filters), [data, expandedKeys, filters]);
  const blockerPairs = useMemo(() => getAllBlockerPairs(data), [data]);
  
  useEffect(() => {
    if (!svgRef.current || rows.length === 0) return;
    
    const ROW_HEIGHT = 36;
    const LABEL_WIDTH = 400;
    const PADDING = 16;
    
    // Calculate date range
    const dates: Date[] = [];
    for (const row of rows) {
      if (row.startDate) dates.push(new Date(row.startDate));
      if (row.dueDate) dates.push(new Date(row.dueDate));
    }
    
    if (dates.length === 0) {
      dates.push(new Date());
      dates.push(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    }
    
    const minDate = d3.min(dates) || new Date();
    const maxDate = d3.max(dates) || new Date();
    
    const startDate = new Date(minDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    const endDate = new Date(maxDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const containerWidth = containerRef.current?.clientWidth || 1200;
    const chartWidth = Math.max(containerWidth - LABEL_WIDTH - PADDING * 2, 600);
    const totalWidth = LABEL_WIDTH + chartWidth + PADDING * 2;
    const totalHeight = rows.length * ROW_HEIGHT + 60;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', totalHeight);
    
    // Time scale
    const timeScale = d3.scaleTime()
      .domain([startDate, endDate])
      .range([LABEL_WIDTH + PADDING, totalWidth - PADDING]);
    
    // Background
    svg.append('rect')
      .attr('width', totalWidth)
      .attr('height', totalHeight)
      .attr('fill', '#ffffff');
    
    // Grid lines based on zoom
    const tickInterval = zoom === 'day' ? d3.timeDay : zoom === 'week' ? d3.timeWeek : d3.timeMonth;
    const ticks = timeScale.ticks(tickInterval as any);
    
    // Header area
    svg.append('rect')
      .attr('x', 0).attr('y', 0)
      .attr('width', totalWidth).attr('height', 40)
      .attr('fill', '#f8f9fa');
    
    // Time axis labels
    const timeFormat = zoom === 'day' ? d3.timeFormat('%b %d') : zoom === 'week' ? d3.timeFormat('%b %d') : d3.timeFormat('%B %Y');
    
    for (const tick of ticks) {
      const x = timeScale(tick);
      svg.append('line')
        .attr('x1', x).attr('y1', 40)
        .attr('x2', x).attr('y2', totalHeight)
        .attr('stroke', '#e5e7eb').attr('stroke-width', 0.5);
      
      svg.append('text')
        .attr('x', x).attr('y', 28)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280').attr('font-size', 11)
        .text(timeFormat(tick));
    }
    
    // Today marker
    const today = new Date();
    if (today >= startDate && today <= endDate) {
      const todayX = timeScale(today);
      svg.append('line')
        .attr('x1', todayX).attr('y1', 40)
        .attr('x2', todayX).attr('y2', totalHeight)
        .attr('stroke', '#76B900').attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,4');
      
      svg.append('text')
        .attr('x', todayX).attr('y', 14)
        .attr('text-anchor', 'middle')
        .attr('fill', '#76B900').attr('font-size', 10).attr('font-weight', 'bold')
        .text('TODAY');
    }
    
    // Rows
    const rowGroup = svg.append('g').attr('transform', 'translate(0, 40)');
    
    rows.forEach((row, i) => {
      const y = i * ROW_HEIGHT;
      const isSelected = selectedIssue?.key === row.key;
      
      // Row background
      rowGroup.append('rect')
        .attr('x', 0).attr('y', y)
        .attr('width', totalWidth).attr('height', ROW_HEIGHT)
        .attr('fill', isSelected ? '#76B90015' : i % 2 === 0 ? '#ffffff' : '#f8f9fa')
        .attr('cursor', 'pointer')
        .on('click', () => onSelectIssue(row));
      
      // Row bottom border
      rowGroup.append('line')
        .attr('x1', 0).attr('y1', y + ROW_HEIGHT)
        .attr('x2', totalWidth).attr('y2', y + ROW_HEIGHT)
        .attr('stroke', '#f1f3f5').attr('stroke-width', 0.5);
      
      // Expand/collapse indicator
      if (row.children.length > 0) {
        const expandX = 8 + row.depth * 16;
        const arrow = expandedKeys.has(row.key) ? '▼' : '▶';
        rowGroup.append('text')
          .attr('x', expandX).attr('y', y + ROW_HEIGHT / 2 + 4)
          .attr('fill', '#76B900').attr('font-size', 10)
          .attr('cursor', 'pointer')
          .text(arrow)
          .on('click', (e) => { e.stopPropagation(); onToggleExpand(row.key); });
      }
      
      // Status dot
      rowGroup.append('circle')
        .attr('cx', 24 + row.depth * 16).attr('cy', y + ROW_HEIGHT / 2)
        .attr('r', 4)
        .attr('fill', getStatusColor(row.status));
      
      // Label
      const labelText = `${row.key} ${row.summary}`;
      const maxLabelLen = Math.floor((LABEL_WIDTH - 40 - row.depth * 16) / 6);
      rowGroup.append('text')
        .attr('x', 34 + row.depth * 16).attr('y', y + ROW_HEIGHT / 2 + 4)
        .attr('fill', '#1f2937').attr('font-size', 12)
        .attr('cursor', 'pointer')
        .text(labelText.length > maxLabelLen ? labelText.slice(0, maxLabelLen) + '…' : labelText)
        .on('click', () => onSelectIssue(row));
      
      // Gantt bar
      if (row.startDate && row.dueDate) {
        const barStart = timeScale(new Date(row.startDate));
        const barEnd = timeScale(new Date(row.dueDate));
        const barWidth = Math.max(barEnd - barStart, 4);
        
        rowGroup.append('rect')
          .attr('x', barStart).attr('y', y + 8)
          .attr('width', barWidth).attr('height', ROW_HEIGHT - 16)
          .attr('rx', 4).attr('ry', 4)
          .attr('fill', getStatusColor(row.status))
          .attr('opacity', 0.85)
          .attr('cursor', 'pointer')
          .on('click', () => onSelectIssue(row));
        
        // Bar label
        if (barWidth > 60) {
          rowGroup.append('text')
            .attr('x', barStart + 6).attr('y', y + ROW_HEIGHT / 2 + 4)
            .attr('fill', '#fff').attr('font-size', 10).attr('font-weight', 'bold')
            .text(row.key);
        }
      } else if (row.startDate || row.dueDate) {
        // Milestone diamond
        const milestoneDate = new Date((row.startDate || row.dueDate)!);
        const mx = timeScale(milestoneDate);
        rowGroup.append('polygon')
          .attr('points', `${mx},${y + 8} ${mx + 8},${y + ROW_HEIGHT / 2} ${mx},${y + ROW_HEIGHT - 8} ${mx - 8},${y + ROW_HEIGHT / 2}`)
          .attr('fill', getStatusColor(row.status));
      }
    });
    
    // Dependency arrows
    const rowKeyToIndex = new Map(rows.map((r, i) => [r.key, i]));
    
    for (const pair of blockerPairs) {
      const fromIdx = rowKeyToIndex.get(pair.from);
      const toIdx = rowKeyToIndex.get(pair.to);
      if (fromIdx === undefined || toIdx === undefined) continue;
      
      const fromRow = rows[fromIdx];
      const toRow = rows[toIdx];
      
      const fromDate = fromRow.dueDate ? new Date(fromRow.dueDate) : null;
      const toDate = toRow.startDate ? new Date(toRow.startDate) : null;
      
      if (!fromDate || !toDate) continue;
      
      const x1 = timeScale(fromDate);
      const y1 = 40 + fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const x2 = timeScale(toDate);
      const y2 = 40 + toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      
      // Draw arrow
      svg.append('path')
        .attr('d', `M${x1},${y1} C${x1 + 20},${y1} ${x2 - 20},${y2} ${x2},${y2}`)
        .attr('fill', 'none')
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,2')
        .attr('marker-end', 'url(#arrowhead)');
    }
    
    // Arrow marker definition
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('markerWidth', 8).attr('markerHeight', 6)
      .attr('refX', 8).attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 8 3, 0 6')
      .attr('fill', '#ef4444');
      
  }, [rows, zoom, selectedIssue, expandedKeys, blockerPairs]);
  
  return (
    <div ref={containerRef} className="overflow-auto flex-1 border border-nvidia-border rounded-lg">
      <svg ref={svgRef} className="min-w-full" />
    </div>
  );
};
