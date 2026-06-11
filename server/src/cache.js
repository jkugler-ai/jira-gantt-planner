const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '../../data/cache');

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// Generate a safe filename from a cache key
function getCacheFilePath(key) {
  // Replace special chars with underscores, limit length
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
  return path.join(CACHE_DIR, `${safeKey}.json`);
}

// Get cached data if it exists (no TTL - always serve stale, user refreshes manually)
function getCache(key) {
  ensureCacheDir();
  const filePath = getCacheFilePath(key);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, timestamp } = JSON.parse(raw);
      return { data, timestamp, hit: true };
    }
  } catch (err) {
    console.error('Cache read error:', err.message);
  }
  return { data: null, timestamp: null, hit: false };
}

// Write data to cache
function setCache(key, data) {
  ensureCacheDir();
  const filePath = getCacheFilePath(key);
  try {
    const payload = {
      data,
      timestamp: new Date().toISOString(),
      key
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf-8');
  } catch (err) {
    console.error('Cache write error:', err.message);
  }
}

module.exports = { getCache, setCache };
