require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const path = require('path');
const jiraRoutes = require('./routes/jira');
const authRoutes = require('./routes/auth');
const dailyTasksRoutes = require('./routes/daily-tasks');

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

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mission Control server running on port ${PORT}`);
  console.log(`   Access: http://localhost:${PORT}`);
});
