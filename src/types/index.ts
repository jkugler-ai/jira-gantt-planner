export interface JiraConfig {
  baseUrl: string;
  token: string;
  rootIssueKey: string;
  proxyUrl: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  issueType: string;
  assignee: string | null;
  startDate: string | null;
  dueDate: string | null;
  children: JiraIssue[];
  blockedBy: string[];
  blocks: string[];
  depth: number;
  expanded: boolean;
}

export interface GanttRow {
  issue: JiraIssue;
  visible: boolean;
}

export type ZoomLevel = 'day' | 'week' | 'month';

export interface Filters {
  status: string[];
  assignee: string[];
  issueType: string[];
}
