const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const JIRA_BASE = 'https://jirasw.nvidia.com';
const DATA_DIR = path.join(__dirname, '../../data/daily-tasks');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware: require auth
function requireAuth(req, res, next) {
  if (!req.session.jiraPat) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Helper: Jira API request
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

// Helper: get file path for a date
function getFilePath(date) {
  return path.join(DATA_DIR, `${date}.json`);
}

// Helper: read daily tasks
function readDailyTasks(date) {
  const filePath = getFilePath(date);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return {
    date,
    jiraTasks: [],
    manualTasks: [],
    followUps: [],
    overnightSummary: ''
  };
}

// Helper: write daily tasks
function writeDailyTasks(date, data) {
  const filePath = getFilePath(date);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/daily-tasks/:date - Get daily tasks for a date
router.get('/:date', requireAuth, (req, res) => {
  try {
    const data = readDailyTasks(req.params.date);
    res.json(data);
  } catch (err) {
    console.error('Read daily tasks error:', err.message);
    res.status(500).json({ error: 'Failed to read daily tasks' });
  }
});

// POST /api/daily-tasks/:date - Save daily tasks for a date
router.post('/:date', requireAuth, (req, res) => {
  try {
    const { jiraTasks, manualTasks, followUps, overnightSummary, jql } = req.body;
    const data = {
      date: req.params.date,
      jiraTasks: jiraTasks || [],
      manualTasks: manualTasks || [],
      followUps: followUps || [],
      overnightSummary: overnightSummary || '',
      jql: jql || ''
    };
    writeDailyTasks(req.params.date, data);
    res.json({ success: true });
  } catch (err) {
    console.error('Save daily tasks error:', err.message);
    res.status(500).json({ error: 'Failed to save daily tasks' });
  }
});

// GET /api/daily-tasks/:date/jira - Fetch Jira tasks with custom JQL
router.get('/:date/jira', requireAuth, async (req, res) => {
  try {
    const defaultJql = '(assignee = currentUser() OR cf[12712] = currentUser()) AND status != Done AND status != Closed ORDER BY priority ASC, duedate ASC';
    const jql = req.query.jql || defaultJql;
    const response = await jiraRequest(req, 'GET',
      `/search?jql=${encodeURIComponent(jql)}&maxResults=200&fields=summary,status,assignee,priority,duedate,updated,issuetype,customfield_10015,customfield_37300,customfield_12712,customfield_14311`
    );

    const tasks = response.data.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      statusCategory: issue.fields.status?.statusCategory?.key,
      priority: issue.fields.priority?.name,
      type: issue.fields.issuetype?.name,
      dueDate: issue.fields.duedate,
      updated: issue.fields.updated,
      startDate: issue.fields.customfield_10015,
      devTeam: issue.fields.customfield_37300?.value,
      programManager: issue.fields.customfield_12712?.displayName || issue.fields.customfield_12712?.value || null,
      statusUpdate: issue.fields.customfield_14311,
      notes: '',
      completed: false
    }));

    res.json({ tasks, total: response.data.total });
  } catch (err) {
    console.error('Jira tasks fetch error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.errorMessages?.[0] || 'Failed to fetch Jira tasks'
    });
  }
});

module.exports = router;
