import { JiraConfig, JiraIssue } from '../types';

export async function fetchIssue(config: JiraConfig, key: string): Promise<any> {
  const fields = 'key,summary,status,issuetype,duedate,customfield_30001,issuelinks,assignee,customfield_10005';
  const url = `/api/issue/${key}?fields=${fields}`;
  
  const res = await fetch(url, {
    headers: {
      'x-jira-url': config.baseUrl,
      'x-jira-token': config.token,
    },
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch ${key}: ${res.status}`);
  }
  
  return res.json();
}

export async function fetchHierarchy(
  config: JiraConfig,
  rootKey: string,
  depth: number = 0,
  visited: Set<string> = new Set(),
  onProgress?: (msg: string) => void
): Promise<JiraIssue> {
  if (visited.has(rootKey)) {
    return {
      key: rootKey,
      summary: '(circular reference)',
      status: 'Unknown',
      issueType: 'Unknown',
      assignee: null,
      startDate: null,
      dueDate: null,
      children: [],
      blockedBy: [],
      blocks: [],
      depth,
      expanded: depth < 2,
    };
  }
  
  visited.add(rootKey);
  onProgress?.(`Fetching ${rootKey}...`);
  
  const data = await fetchIssue(config, rootKey);
  const fields = data.fields;
  
  const childKeys: string[] = [];
  const blockedBy: string[] = [];
  const blocks: string[] = [];
  
  if (fields.issuelinks) {
    for (const link of fields.issuelinks) {
      if (link.type.outward === 'is parent of' && link.outwardIssue) {
        childKeys.push(link.outwardIssue.key);
      }
      if (link.type.name === 'Blocks') {
        if (link.inwardIssue) {
          blockedBy.push(link.inwardIssue.key);
        }
        if (link.outwardIssue) {
          blocks.push(link.outwardIssue.key);
        }
      }
    }
  }
  
  // Also fetch Epic Link children
  if (fields.issuetype?.name === 'Epic') {
    try {
      const jql = encodeURIComponent(`"Epic Link" = ${rootKey} ORDER BY rank`);
      const searchUrl = `/api/search?jql=${jql}&fields=key&maxResults=50`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'x-jira-url': config.baseUrl,
          'x-jira-token': config.token,
        },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        for (const issue of searchData.issues || []) {
          if (!childKeys.includes(issue.key) && !visited.has(issue.key)) {
            childKeys.push(issue.key);
          }
        }
      }
    } catch (e) {
      // Ignore epic link search failures
    }
  }
  
  // Recursively fetch children (limit depth to prevent runaway)
  const children: JiraIssue[] = [];
  if (depth < 4) {
    for (const childKey of childKeys) {
      try {
        const child = await fetchHierarchy(config, childKey, depth + 1, visited, onProgress);
        children.push(child);
      } catch (e) {
        // Skip failed children
      }
    }
  }
  
  return {
    key: data.key,
    summary: fields.summary || '',
    status: fields.status?.name || 'Unknown',
    issueType: fields.issuetype?.name || 'Unknown',
    assignee: fields.assignee?.displayName || null,
    startDate: fields.customfield_30001 || null,
    dueDate: fields.duedate || null,
    children,
    blockedBy,
    blocks,
    depth,
    expanded: depth < 2,
  };
}
