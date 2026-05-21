const express = require('express');
const router = express.Router();

// POST /api/auth/login - Store PAT in session
router.post('/login', (req, res) => {
  const { pat, username } = req.body;
  if (!pat) {
    return res.status(400).json({ error: 'PAT is required' });
  }
  req.session.jiraPat = pat;
  req.session.jiraUsername = username || 'unknown';
  req.session.save((err) => {
    if (err) return res.status(500).json({ error: 'Session save failed' });
    res.json({ success: true, username: req.session.jiraUsername });
  });
});

// GET /api/auth/status - Check if authenticated
router.get('/status', (req, res) => {
  if (req.session.jiraPat) {
    res.json({ authenticated: true, username: req.session.jiraUsername });
  } else {
    res.json({ authenticated: false });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

module.exports = router;
