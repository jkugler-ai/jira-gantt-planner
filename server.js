import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PROXY_PORT || 4201;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];

app.use(cors());
app.use(express.json());

// Proxy all /api/* requests to Jira
app.all('/api/*', async (req, res) => {
  const jiraUrl = req.headers['x-jira-url'];
  const jiraToken = req.headers['x-jira-token'];

  if (!jiraUrl || !jiraToken) {
    return res.status(400).json({ error: 'Missing x-jira-url or x-jira-token headers' });
  }

  const path = req.params[0];
  const url = `${jiraUrl}/rest/api/2/${path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${jiraToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: JSON.stringify(req.body) } : {}),
    });

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'Failed to connect to Jira', details: error.message });
  }
});

// Also serve the built React app
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Jira Gantt Planner running on port ${PORT}`);
});
