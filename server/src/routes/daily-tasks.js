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

// GET /api/daily-tasks/calendar/manual - Get all follow-ups and manual tasks with due dates (for calendar)
router.get('/calendar/manual', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    const tasks = [];
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
      // Legacy manual tasks
      if (data.manualTasks) {
        for (const task of data.manualTasks) {
          if (task.dueDate && !task.completed) {
            tasks.push({ ...task, type: 'manual', sourceDate: data.date });
          }
        }
      }
      // Follow-ups with due dates
      if (data.followUps) {
        for (const fu of data.followUps) {
          if (fu.dueDate && !fu.completed) {
            tasks.push({ ...fu, type: 'followup', sourceDate: data.date });
          }
        }
      }
    }
    res.json({ tasks });
  } catch (err) {
    console.error('Calendar manual tasks error:', err.message);
    res.status(500).json({ error: 'Failed to fetch manual tasks' });
  }
});

// GET /api/daily-tasks/:date - Get daily tasks for a date
router.get('/:date', requireAuth, (req, res) => {
  try {
    let data = readDailyTasks(req.params.date);
    
    // If no data for today and carry-over is requested, pull from previous day
    if (data.jiraTasks.length === 0 && data.manualTasks.length === 0 && data.followUps.length === 0) {
      // Find the most recent previous day with data
      const files = fs.readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.json') && f < `${req.params.date}.json`)
        .sort()
        .reverse();
      
      if (files.length > 0) {
        const prevData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, files[0]), 'utf-8'));
        // Carry over incomplete manual tasks and follow-ups
        const carriedManual = (prevData.manualTasks || []).filter(t => !t.completed);
        const carriedFollowUps = (prevData.followUps || []).filter(f => !f.completed);
        if (carriedManual.length > 0 || carriedFollowUps.length > 0) {
          data.manualTasks = carriedManual;
          data.followUps = carriedFollowUps;
          data.jql = prevData.jql || '';
          data._carriedFrom = files[0].replace('.json', '');
        }
      }
    }
    
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
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
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

// GET /api/daily-tasks/transitions/:key - Get available transitions for an issue
router.get('/transitions/:key', requireAuth, async (req, res) => {
  try {
    const response = await jiraRequest(req, 'GET', `/issue/${req.params.key}/transitions`);
    res.json(response.data);
  } catch (err) {
    console.error('Transitions fetch error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: 'Failed to fetch transitions' });
  }
});

// POST /api/daily-tasks/transitions/:key - Transition an issue
router.post('/transitions/:key', requireAuth, async (req, res) => {
  try {
    const { transitionId } = req.body;
    await jiraRequest(req, 'POST', `/issue/${req.params.key}/transitions`, {
      transition: { id: transitionId }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Transition error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: 'Failed to transition issue' });
  }
});

module.exports = router;
