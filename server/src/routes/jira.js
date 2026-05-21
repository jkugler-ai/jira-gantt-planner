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
    const { devTeam, assignee } = req.query;

    // Build JQL for sprint goals
    let jql = 'project = OMPE AND issuetype = "Sprint Goal" AND status != Closed';
    if (devTeam) {
      jql += ` AND "Development Team" = "${devTeam}"`;
    }
    if (assignee) {
      jql += ` AND assignee = "${assignee}"`;
    }
    jql += ' ORDER BY priority ASC, created DESC';

    const response = await jiraRequest(req, 'GET',
      `/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary,status,assignee,priority,duedate,created,customfield_14311,customfield_37300,issuelinks&expand=names`
    );

    const goals = response.data.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      statusCategory: issue.fields.status?.statusCategory?.key,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      assigneeKey: issue.fields.assignee?.key,
      priority: issue.fields.priority?.name,
      dueDate: issue.fields.duedate,
      startDate: issue.fields.customfield_10015, // typical start date field
      statusUpdate: issue.fields.customfield_14311,
      devTeam: issue.fields.customfield_37300?.value,
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
    const jql = `project = OMPE AND "Parent Link" = ${parentKey} ORDER BY priority ASC, created ASC`;

    const response = await jiraRequest(req, 'GET',
      `/search?jql=${encodeURIComponent(jql)}&maxResults=200&fields=summary,status,assignee,priority,duedate,created,customfield_14311,customfield_37300,issuetype,issuelinks,customfield_10015`
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
      dueDate: issue.fields.duedate,
      startDate: issue.fields.customfield_10015,
      statusUpdate: issue.fields.customfield_14311,
      devTeam: issue.fields.customfield_37300?.value,
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

module.exports = router;
