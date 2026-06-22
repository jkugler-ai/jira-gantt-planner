require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const path = require('path');
const jiraRoutes = require('./routes/jira');
const authRoutes = require('./routes/auth');
const dailyTasksRoutes = require('./routes/daily-tasks');
const storageRoutes = require('./routes/storage');

const app = express();
const PORT = process.env.PORT || 4201;

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Session management (stores PAT server-side)
app.use(session({
  secret: process.env.SESSION_SECRET || 'mission-control-nvidia-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set true if behind HTTPS
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/jira', jiraRoutes);
app.use('/api/daily-tasks', dailyTasksRoutes);
app.use('/api/storage', storageRoutes);

// Serve static frontend
const clientDist = path.join(__dirname, '../../client/dist');
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    etag: false,
    setHeaders: (res, filePath) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mission Control server running on port ${PORT}`);
  console.log(`   Access: http://localhost:${PORT}`);
});
