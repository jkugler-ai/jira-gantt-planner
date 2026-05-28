const express = require('express');
const axios = require('axios');
const router = express.Router();

const JIRA_BASE = 'https://jirasw.nvidia.com';

// Middleware: require auth
function requireAuth(req, res, next) {
  if (!req.session.jiraPat) {
    return res.status(401).json({ error: 'Not authenticated. Please log in with your Jira PAT.' });
  }
  next();
}

// Helper: make Jira API request
async function jiraRequest(req, method, path, data = null) {
  const config = {
    method,
    url: `${JIRA_BASE}/rest/api/2${path}`,
    headers: {
      'Authorization': `Bearer ${req.session.jiraPat}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  if (data) config.data = data;
  return axios(config);
}

// GET /api/jira/sprint-goals - Fetch sprint goals with children
router.get('/sprint-goals', requireAuth, async (req, res) => {
  try {
    // Support multi-select arrays: ?devTeam[]=X&devTeam[]=Y or single values
    const toArray = (v) => v ? (Array.isArray(v) ? v : [v]) : [];
    const devTeams = toArray(req.query.devTeam || req.query['devTeam[]']);
    const assignees = toArray(req.query.assignee || req.query['assignee[]']);
    const programManagers = toArray(req.query.programManager || req.query['programManager[]']);
    const productManagers = toArray(req.query.productManager || req.query['productManager[]']);
    const limit = parseInt(req.query.limit) || 0;

    // Build JQL for sprint goals
    let jql = 'project = OMPE AND issuetype = "Sprint Goal" AND status != Done';
    if (devTeams.length > 0) {
      const vals = devTeams.map(t => `"${t}"`).join(', ');
      jql += ` AND "Development Team" in (${vals})`;
    }
    if (assignees.length > 0) {
      const vals = assignees.map(a => `"${a}"`).join(', ');
      jql += ` AND assignee in (${vals})`;
    }
    if (programManagers.length > 0) {
      const vals = programManagers.map(p => `"${p}"`).join(', ');
      jql += ` AND cf[12712] in (${vals})`;
    }
    if (productManagers.length > 0) {
      const vals = productManagers.map(p => `"${p}"`).join(', ');
      jql += ` AND cf[12711] in (${vals})`;
    }
    jql += ' ORDER BY cf[13210] ASC, priority ASC, created DESC';

    const maxResults = limit > 0 ? limit : 200;
    const response = await jiraRequest(req, 'GET',
      `/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,assignee,priority,duedate,created,customfield_14311,customfield_37300,customfield_12711,customfield_12712,customfield_13210,issuelinks,customfield_10015&expand=names`
    );

    const goals = response.data.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      statusCategory: issue.fields.status?.statusCategory?.key,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      assigneeKey: issue.fields.assignee?.key,
      priority: issue.fields.priority?.name,
      priorityRank: issue.fields.customfield_13210,
      dueDate: issue.fields.duedate,
      startDate: issue.fields.customfield_10015,
      statusUpdate: issue.fields.customfield_14311,
      devTeam: issue.fields.customfield_37300?.value,
      programManager: issue.fields.customfield_12712?.displayName || issue.fields.customfield_12712?.value || null,
      productManager: issue.fields.customfield_12711?.displayName || issue.fields.customfield_12711?.value || null,
      links: issue.fields.issuelinks || []
    }));

    res.json({ goals, total: response.data.total });
  } catch (err) {
    console.error('Sprint goals fetch error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.errorMessages?.[0] || 'Failed to fetch sprint goals'
    });
  }
});

// GET /api/jira/children/:key - Get children of a sprint goal
router.get('/children/:key', requireAuth, async (req, res) => {
  try {
    const parentKey = req.params.key;
    // Search for issues with Parent Link = this key
    const jql = `project = OMPE AND "Parent Link" = ${parentKey} ORDER BY cf[13210] ASC, priority ASC, created ASC`;

    const response = await jiraRequest(req, 'GET',
      `/search?jql=${encodeURIComponent(jql)}&maxResults=200&fields=summary,status,assignee,priority,duedate,created,customfield_14311,customfield_37300,customfield_12711,customfield_12712,customfield_13210,issuetype,issuelinks,customfield_10015`
    );

    const children = response.data.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      type: issue.fields.issuetype?.name,
      status: issue.fields.status?.name,
      statusCategory: issue.fields.status?.statusCategory?.key,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      assigneeKey: issue.fields.assignee?.key,
      priority: issue.fields.priority?.name,
      priorityRank: issue.fields.customfield_13210,
      dueDate: issue.fields.duedate,
      startDate: issue.fields.customfield_10015,
      statusUpdate: issue.fields.customfield_14311,
      devTeam: issue.fields.customfield_37300?.value,
      programManager: issue.fields.customfield_12712?.displayName || issue.fields.customfield_12712?.value || null,
      productManager: issue.fields.customfield_12711?.displayName || issue.fields.customfield_12711?.value || null,
      links: issue.fields.issuelinks || []
    }));

    res.json({ children, total: response.data.total });
  } catch (err) {
    console.error('Children fetch error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.errorMessages?.[0] || 'Failed to fetch children'
    });
  }
});

// PUT /api/jira/issue/:key - Update issue fields
router.put('/issue/:key', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;
    await jiraRequest(req, 'PUT', `/issue/${req.params.key}`, { fields });
    res.json({ success: true });
  } catch (err) {
    console.error('Update error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.errorMessages?.[0] || 'Failed to update issue'
    });
  }
});

// POST /api/jira/issue/:key/comment - Add comment
router.post('/issue/:key/comment', requireAuth, async (req, res) => {
  try {
    const { body } = req.body;
    const response = await jiraRequest(req, 'POST', `/issue/${req.params.key}/comment`, { body });
    res.json(response.data);
  } catch (err) {
    console.error('Comment error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.errorMessages?.[0] || 'Failed to add comment'
    });
  }
});

// GET /api/jira/issue/:key/comments - Get comments
router.get('/issue/:key/comments', requireAuth, async (req, res) => {
  try {
    const response = await jiraRequest(req, 'GET', `/issue/${req.params.key}/comment`);
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: 'Failed to fetch comments'
    });
  }
});

// GET /api/jira/gantt-data - Get all issues with dates for Gantt view
router.get('/gantt-data', requireAuth, async (req, res) => {
  try {
    const jql = 'project = OMPE AND status != Closed AND (duedate is not EMPTY OR "Start date" is not EMPTY) ORDER BY priority ASC';

    const response = await jiraRequest(req, 'GET',
      `/search?jql=${encodeURIComponent(jql)}&maxResults=500&fields=summary,status,assignee,priority,duedate,issuetype,issuelinks,customfield_10015,customfield_14311,customfield_37300`
    );

    const items = response.data.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      type: issue.fields.issuetype?.name,
      status: issue.fields.status?.name,
      statusCategory: issue.fields.status?.statusCategory?.key,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      assigneeKey: issue.fields.assignee?.key,
      startDate: issue.fields.customfield_10015,
      dueDate: issue.fields.duedate,
      devTeam: issue.fields.customfield_37300?.value,
      links: (issue.fields.issuelinks || []).map(link => ({
        type: link.type?.name,
        inward: link.inwardIssue?.key,
        outward: link.outwardIssue?.key,
        direction: link.inwardIssue ? 'inward' : 'outward'
      }))
    }));

    res.json({ items, total: response.data.total });
  } catch (err) {
    console.error('Gantt data error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: 'Failed to fetch gantt data'
    });
  }
});

// GET /api/jira/user-search - Search for Jira users
router.get('/user-search', requireAuth, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) {
      return res.json({ users: [] });
    }
    const response = await jiraRequest(req, 'GET',
      `/user/search?username=${encodeURIComponent(query)}&maxResults=20`
    );
    const users = response.data.map(u => ({
      key: u.key,
      name: u.name,
      displayName: u.displayName
    }));
    res.json({ users });
  } catch (err) {
    console.error('User search error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: 'Failed to search users' });
  }
});

// GET /api/jira/dev-teams - Get available dev teams
router.get('/dev-teams', requireAuth, async (req, res) => {
  // Return known dev teams for OMPE
  res.json({
    teams: [
      { id: '46714', name: 'Storage Infrastructure APIs' },
      { name: 'USD Storage' },
      { name: 'Caching Services' },
      { name: 'Portal' }
    ]
  });
});

// GET /api/jira/filter-options - Get distinct filter values from current sprint goals
router.get('/filter-options', requireAuth, async (req, res) => {
  try {
    const jql = 'project = OMPE AND status != Done';
    const response = await jiraRequest(req, 'GET',
      `/search?jql=${encodeURIComponent(jql)}&maxResults=200&fields=assignee,customfield_37300,customfield_12711,customfield_12712,customfield_23812,customfield_31509`
    );

    const assignees = new Set();
    const devTeams = new Set();
    const programManagers = new Set();
    const productManagers = new Set();
    const engPics = new Set();

    response.data.issues.forEach(issue => {
      const f = issue.fields;
      if (f.assignee?.displayName) assignees.add(f.assignee.displayName);
      if (f.customfield_37300?.value) devTeams.add(f.customfield_37300.value);
      const pgm = f.customfield_12712?.displayName || f.customfield_12712?.value;
      if (pgm) programManagers.add(pgm);
      const pdm = f.customfield_12711?.displayName || f.customfield_12711?.value;
      if (pdm) productManagers.add(pdm);
      const ep1 = f.customfield_23812?.displayName || f.customfield_23812?.value;
      if (ep1) engPics.add(ep1);
      const ep2 = f.customfield_31509?.displayName || f.customfield_31509?.value;
      if (ep2) engPics.add(ep2);
    });

    res.json({
      assignees: [...assignees].sort(),
      devTeams: [...devTeams].sort(),
      programManagers: [...programManagers].sort(),
      productManagers: [...productManagers].sort(),
      engPics: [...engPics].sort()
    });
  } catch (err) {
    console.error('Filter options error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: 'Failed to fetch filter options'
    });
  }
});

// GET /api/jira/issue/:key/links - Get issue links (blockers, relates-to, etc.)
router.get('/issue/:key/links', requireAuth, async (req, res) => {
  try {
    const response = await jiraRequest(req, 'GET', `/issue/${req.params.key}?fields=issuelinks,subtasks`);
    const links = response.data.fields.issuelinks || [];
    const subtasks = response.data.fields.subtasks || [];

    // Extract blockers ("is blocked by" links)
    const blockers = links
      .filter(l => l.type.name === 'Blocks' && l.inwardIssue)
      .map(l => ({
        key: l.inwardIssue.key,
        summary: l.inwardIssue.fields.summary,
        status: l.inwardIssue.fields.status?.name,
        statusCategory: l.inwardIssue.fields.status?.statusCategory?.key,
        type: l.inwardIssue.fields.issuetype?.name,
      }));

    // Also include subtasks
    const subs = subtasks.map(s => ({
      key: s.key,
      summary: s.fields.summary,
      status: s.fields.status?.name,
      statusCategory: s.fields.status?.statusCategory?.key,
      type: s.fields.issuetype?.name,
    }));

    res.json({ blockers, subtasks: subs, allLinks: links.length });
  } catch (err) {
    console.error('Issue links error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: 'Failed to fetch issue links' });
  }
});

// GET /api/jira/query - Generic JQL query endpoint
router.get('/query', requireAuth, async (req, res) => {
  try {
    const { jql } = req.query;
    if (!jql) {
      return res.status(400).json({ error: 'JQL query is required' });
    }

    const response = await jiraRequest(req, 'GET',
      `/search?jql=${encodeURIComponent(jql)}&maxResults=200&fields=summary,status,assignee,reporter,priority,duedate,created,issuetype,fixVersions,customfield_14311,customfield_37300,customfield_12711,customfield_12712,customfield_13210,customfield_23812,customfield_31509,customfield_35415,issuelinks,customfield_10015`
    );

    const issues = response.data.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      type: issue.fields.issuetype?.name,
      status: issue.fields.status?.name,
      statusCategory: issue.fields.status?.statusCategory?.key,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      assigneeKey: issue.fields.assignee?.key,
      priority: issue.fields.priority?.name,
      priorityRank: issue.fields.customfield_13210,
      dueDate: issue.fields.duedate,
      startDate: issue.fields.customfield_10015,
      statusUpdate: issue.fields.customfield_14311,
      devTeam: issue.fields.customfield_37300?.value,
      programManager: issue.fields.customfield_12712?.displayName || issue.fields.customfield_12712?.value || null,
      productManager: issue.fields.customfield_12711?.displayName || issue.fields.customfield_12711?.value || null,
      engPic: issue.fields.customfield_23812?.displayName || issue.fields.customfield_23812?.value || issue.fields.customfield_31509?.displayName || issue.fields.customfield_31509?.value || null,
      fixVersion: (issue.fields.fixVersions && issue.fields.fixVersions.length > 0) ? issue.fields.fixVersions.map(v => v.name).join(', ') : null,
      created: issue.fields.created ? issue.fields.created.split('T')[0] : null,
      nvbugsId: issue.fields.customfield_35415 || null,
      reporter: issue.fields.reporter?.displayName || null,
      links: issue.fields.issuelinks || []
    }));

    res.json({ issues, total: response.data.total });
  } catch (err) {
    console.error('Query error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.errorMessages?.[0] || 'Failed to execute query'
    });
  }
});

// GET /api/jira/issue-details - Get recent comments, links, and changelog for multiple issues
router.get('/issue-details', requireAuth, async (req, res) => {
  try {
    const keys = req.query.keys;
    if (!keys) return res.status(400).json({ error: 'keys param required' });
    const keyList = Array.isArray(keys) ? keys : keys.split(',');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const details = {};
    // Process in batches of 10 to avoid overwhelming Jira
    for (let i = 0; i < keyList.length; i += 10) {
      const batch = keyList.slice(i, i + 10);
      const results = await Promise.all(batch.map(async (key) => {
        try {
          // Get comments
          const commentsRes = await jiraRequest(req, 'GET', `/issue/${key}/comment`);
          const recentComments = (commentsRes.data.comments || []).filter(c => 
            c.created && c.created >= sevenDaysAgo
          ).map(c => ({
            author: c.author?.displayName || 'Unknown',
            body: c.body || '',
            created: c.created
          }));

          // Get changelog for link changes and date shifts
          const changelogRes = await jiraRequest(req, 'GET', `/issue/${key}?expand=changelog&fields=none`);
          const recentChanges = (changelogRes.data.changelog?.histories || []).filter(h =>
            h.created && h.created >= sevenDaysAgo
          ).flatMap(h => 
            (h.items || []).filter(item => 
              item.field === 'Link' || item.field === 'RemoteIssueLink'
            ).map(item => ({
              author: h.author?.displayName || 'Unknown',
              date: h.created,
              field: item.field,
              from: item.fromString || null,
              to: item.toString || null
            }))
          );

          // Track date shifts (due date or start date changes)
          const dateShifts = (changelogRes.data.changelog?.histories || []).filter(h =>
            h.created && h.created >= sevenDaysAgo
          ).flatMap(h => 
            (h.items || []).filter(item => 
              item.field === 'duedate' || item.field === 'Start date' || item.field === 'Due Date'
            ).map(item => ({
              field: item.field === 'duedate' || item.field === 'Due Date' ? 'Due Date' : 'Start Date',
              from: item.fromString || null,
              to: item.toString || null,
              date: h.created
            }))
          );

          // Extract linked issue keys from changelog to fetch their titles
          const linkedKeys = new Set();
          recentChanges.forEach(ch => {
            const text = ch.to || ch.from || '';
            const match = text.match(/([A-Z]+-\d+)/);
            if (match) linkedKeys.add(match[1]);
          });

          // Fetch titles for linked issues
          const linkedTitles = {};
          if (linkedKeys.size > 0) {
            try {
              const keysJql = [...linkedKeys].map(k => `key = ${k}`).join(' OR ');
              const titlesRes = await jiraRequest(req, 'GET',
                `/search?jql=${encodeURIComponent(keysJql)}&maxResults=${linkedKeys.size}&fields=summary`
              );
              titlesRes.data.issues.forEach(i => {
                linkedTitles[i.key] = i.fields.summary;
              });
            } catch (e) {
              // silently continue without titles
            }
          }

          return { key, recentComments, recentChanges, linkedTitles, dateShifts };
        } catch (err) {
          return { key, recentComments: [], recentChanges: [], error: true };
        }
      }));
      results.forEach(r => { details[r.key] = r; });
    }

    res.json({ details });
  } catch (err) {
    console.error('Issue details error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: 'Failed to fetch issue details' });
  }
});

// GET /api/jira/transitions/:key - Get available transitions
router.get('/transitions/:key', requireAuth, async (req, res) => {
  try {
    const response = await jiraRequest(req, 'GET', `/issue/${req.params.key}/transitions`);
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to fetch transitions' });
  }
});

// POST /api/jira/transitions/:key - Transition issue
router.post('/transitions/:key', requireAuth, async (req, res) => {
  try {
    const { transitionId } = req.body;
    await jiraRequest(req, 'POST', `/issue/${req.params.key}/transitions`, {
      transition: { id: transitionId }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: 'Failed to transition issue' });
  }
});

// GET /api/jira/nspect/lookup - Look up PLC parent by nSpect ID and pull categorized child data
router.get('/nspect/lookup', requireAuth, async (req, res) => {
  try {
    const { nspectId } = req.query;
    if (!nspectId) return res.status(400).json({ error: 'nspectId is required' });

    // Search for PLC Parent tickets containing the nSpect ID
    const jql = `project = OMPE AND summary ~ "PLC Parent Task" AND summary ~ "${nspectId}" ORDER BY created DESC`;
    const fields = 'summary,status,assignee,subtasks,issuelinks,description,fixVersions';
    const searchRes = await jiraRequest(req, 'GET',
      `/search?jql=${encodeURIComponent(jql)}&maxResults=10&fields=${fields}`
    );

    let parents = searchRes.data.issues || [];
    if (parents.length === 0) {
      // Also try text search in case nSpect ID is in description or custom field
      const altJql = `project = OMPE AND text ~ "${nspectId}" AND summary ~ "PLC Parent" ORDER BY created DESC`;
      const altRes = await jiraRequest(req, 'GET',
        `/search?jql=${encodeURIComponent(altJql)}&maxResults=10&fields=${fields}`
      );
      if ((altRes.data.issues || []).length === 0) {
        return res.json({ found: false, nspectId, message: 'No PLC Parent ticket found for this nSpect ID' });
      }
      parents = altRes.data.issues;
    }

    // Most recent parent first
    const parent = parents[0];
    const fixVersions = (parent.fields.fixVersions || []).map(fv => fv.name);
    const parentData = {
      key: parent.key,
      summary: parent.fields.summary,
      status: parent.fields.status?.name,
      assignee: parent.fields.assignee?.displayName || 'Unassigned',
      fixVersions,
    };

    // All parent versions for history
    const allParents = parents.map(p => ({
      key: p.key,
      summary: p.fields.summary,
      status: p.fields.status?.name,
      fixVersions: (p.fields.fixVersions || []).map(fv => fv.name),
    }));

    // Get children: subtasks + blocked-by links
    const subtasks = parent.fields.subtasks || [];
    const links = parent.fields.issuelinks || [];
    const blockerKeys = links
      .filter(l => l.type.name === 'Blocks' && l.inwardIssue)
      .map(l => l.inwardIssue.key);
    const childKeys = [...subtasks.map(s => s.key), ...blockerKeys];

    // Fetch full details of each child to get their links and descriptions
    const children = [];
    for (const childKey of childKeys) {
      try {
        const childRes = await jiraRequest(req, 'GET',
          `/issue/${childKey}?fields=summary,status,assignee,description,issuelinks,comment`
        );
        const cf = childRes.data.fields;
        // Extract external links from description and comments
        const allText = (cf.description || '') + ' ' + 
          (cf.comment?.comments || []).map(c => c.body || '').join(' ');
        
        // Find nvbugs links
        const nvbugsMatches = allText.match(/https?:\/\/nvbugs(?:pro)?\.nvidia\.com\/bug\/\d+/g) || [];
        // Find nspect links  
        const nspectMatches = allText.match(/https?:\/\/nspect\.nvidia\.com\/[^\s|\])}"<>]+/g) || [];
        // Find jirasw links from issue links
        const jiraLinks = (cf.issuelinks || [])
          .map(l => l.outwardIssue?.key || l.inwardIssue?.key)
          .filter(Boolean);

        children.push({
          key: childRes.data.key,
          summary: cf.summary,
          status: cf.status?.name,
          assignee: cf.assignee?.displayName || 'Unassigned',
          nvbugsLinks: [...new Set(nvbugsMatches)],
          nspectLinks: [...new Set(nspectMatches)],
          jiraLinks,
        });
      } catch (childErr) {
        children.push({ key: childKey, summary: '(failed to load)', status: 'unknown', assignee: '', nvbugsLinks: [], nspectLinks: [], jiraLinks: [] });
      }
    }

    // Categorize children by summary keywords
    const result = {
      found: true,
      nspectId,
      parent: parentData,
      allParents,
      osrb: null,
      exportCompliance: null,
      legal: null,
      children,
    };

    for (const child of children) {
      const s = child.summary.toLowerCase();
      if (s.includes('oss license') || s.includes('osrb') || s.includes('oss vuln')) {
        result.osrb = { ...child, link: child.nvbugsLinks[0] || child.nspectLinks[0] || '' };
      } else if (s.includes('export compliance') || s.includes('eccn') || s.includes('export')) {
        result.exportCompliance = { ...child, link: child.nvbugsLinks[0] || child.nspectLinks[0] || '' };
      } else if (s.includes('legal') && (s.includes('product') || s.includes('terms') || s.includes('user acceptance'))) {
        result.legal = { ...child, link: child.nspectLinks[0] || child.nvbugsLinks[0] || '' };
      }
    }

    res.json(result);
  } catch (err) {
    console.error('NSpect lookup error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: 'Failed to look up nSpect data' });
  }
});

module.exports = router;
