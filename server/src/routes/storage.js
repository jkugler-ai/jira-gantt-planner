const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../../data');
const ALLOWED_KEYS = ['nspect-entries', 'saved-queries', 'saved-views'];

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(key) {
  return path.join(DATA_DIR, `${key}.json`);
}

// GET /api/storage/:key - returns stored JSON for a given key
router.get('/:key', (req, res) => {
  const { key } = req.params;
  
  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: `Invalid key. Allowed: ${ALLOWED_KEYS.join(', ')}` });
  }

  const filePath = getFilePath(key);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    res.json(parsed);
  } catch (err) {
    console.error(`Error reading ${key}:`, err.message);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// PUT /api/storage/:key - saves JSON data for a given key
router.put('/:key', (req, res) => {
  const { key } = req.params;
  
  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: `Invalid key. Allowed: ${ALLOWED_KEYS.join(', ')}` });
  }

  try {
    const filePath = getFilePath(key);
    const data = JSON.stringify(req.body, null, 2);
    fs.writeFileSync(filePath, data, 'utf-8');
    res.json({ ok: true, key });
  } catch (err) {
    console.error(`Error writing ${key}:`, err.message);
    res.status(500).json({ error: 'Failed to write data' });
  }
});

module.exports = router;
