import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PosterProcessor, type ProcessResult } from './processor.js';
import { getConfig, saveConfig, isConfigured, type Config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

let processor: PosterProcessor | null = null;
let isProcessing = false;
let processResults: ProcessResult[] = [];
let processProgress = { current: 0, total: 0 };

// Initialize processor if configured
function initProcessor() {
  if (isConfigured()) {
    const config = getConfig();
    processor = new PosterProcessor({
      tmdbApiKey: config.tmdbApiKey,
      omdbApiKey: config.omdbApiKey,
      mediaFolders: config.mediaFolders,
      style: config.posterStyle,
      ratings: config.ratings,
      overwrite: config.overwrite,
    });
    return true;
  }
  return false;
}

initProcessor();

// API: Get config
app.get('/api/config', (req, res) => {
  const config = getConfig();
  res.json({
    configured: isConfigured(),
    tmdbApiKey: config.tmdbApiKey ? '***' + config.tmdbApiKey.slice(-4) : '',
    omdbApiKey: config.omdbApiKey ? '***' + config.omdbApiKey.slice(-4) : '',
    mediaFolders: config.mediaFolders,
    posterStyle: config.posterStyle,
    ratings: config.ratings,
    overwrite: config.overwrite,
  });
});

// API: Save config
app.post('/api/config', (req, res) => {
  const { tmdbApiKey, omdbApiKey, mediaFolders, posterStyle, ratings, overwrite } = req.body;
  
  const updates: Partial<Config> = {};
  if (tmdbApiKey) updates.tmdbApiKey = tmdbApiKey;
  if (omdbApiKey) updates.omdbApiKey = omdbApiKey;
  if (mediaFolders) updates.mediaFolders = Array.isArray(mediaFolders) ? mediaFolders : mediaFolders.split(',');
  if (posterStyle) updates.posterStyle = posterStyle;
  if (ratings) updates.ratings = Array.isArray(ratings) ? ratings : ratings.split(',');
  if (overwrite !== undefined) updates.overwrite = overwrite;
  
  saveConfig(updates);
  initProcessor();
  
  res.json({ success: true, configured: isConfigured() });
});

// API: Get status
app.get('/api/status', (req, res) => {
  res.json({
    configured: isConfigured(),
    processing: isProcessing,
    progress: processProgress,
    lastResults: processResults.length,
  });
});

// API: Scan folders
app.get('/api/scan', (req, res) => {
  if (!processor) {
    return res.status(500).json({ error: 'Not configured. Add API keys first.' });
  }

  const items = processor.scan();
  res.json({
    items,
    summary: {
      total: items.length,
      movies: items.filter(i => i.type === 'movie').length,
      shows: items.filter(i => i.type === 'show').length,
      hasPoster: items.filter(i => i.hasPoster).length,
      needsProcessing: items.filter(i => !i.hasPoster).length,
    },
  });
});

// API: Start processing
app.post('/api/process', async (req, res) => {
  if (!processor) {
    return res.status(500).json({ error: 'Not configured' });
  }

  if (isProcessing) {
    return res.status(409).json({ error: 'Already processing' });
  }

  isProcessing = true;
  processResults = [];
  processProgress = { current: 0, total: 0 };

  res.json({ message: 'Processing started' });

  try {
    processResults = await processor.processAll((result, current, total) => {
      processProgress = { current, total };
    });
  } finally {
    isProcessing = false;
  }
});

// API: Get results
app.get('/api/results', (req, res) => {
  res.json({
    processing: isProcessing,
    progress: processProgress,
    results: processResults,
    summary: {
      total: processResults.length,
      success: processResults.filter(r => r.success).length,
      failed: processResults.filter(r => !r.success).length,
    },
  });
});

// Serve UI
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>PosterForge</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { max-width: 1000px; margin: 0 auto; padding: 20px; background: #0f172a; color: #e2e8f0; }
    h1 { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    h1 span { font-size: 2rem; }
    .subtitle { color: #94a3b8; margin-bottom: 24px; }
    .card { background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 16px; }
    .card h3 { margin-top: 0; display: flex; align-items: center; gap: 8px; }
    .btn { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem; margin-right: 8px; margin-bottom: 8px; }
    .btn:hover { background: #2563eb; }
    .btn:disabled { background: #64748b; cursor: not-allowed; }
    .btn-success { background: #22c55e; }
    .btn-success:hover { background: #16a34a; }
    .btn-secondary { background: #475569; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; color: #94a3b8; font-size: 0.875rem; }
    .form-group input, .form-group select { width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 1rem; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #3b82f6; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .stat { background: #334155; padding: 16px; border-radius: 8px; min-width: 100px; text-align: center; flex: 1; }
    .stat-value { font-size: 1.75rem; font-weight: bold; color: #3b82f6; }
    .stat-label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; }
    .progress { background: #334155; border-radius: 8px; height: 32px; overflow: hidden; margin: 16px 0; }
    .progress-bar { background: linear-gradient(90deg, #22c55e, #16a34a); height: 100%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; font-weight: bold; }
    .items { max-height: 300px; overflow-y: auto; font-size: 0.875rem; }
    .item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #334155; }
    .item:last-child { border-bottom: none; }
    .item-icon { font-size: 1.1rem; }
    .item-status { width: 20px; }
    .item-title { flex: 1; }
    .item-year { color: #64748b; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
    .alert-warning { background: #854d0e; color: #fef3c7; }
    .alert-success { background: #166534; color: #bbf7d0; }
    .hidden { display: none; }
    @media (max-width: 600px) {
      .form-row { grid-template-columns: 1fr; }
      .stats { flex-direction: column; }
    }
  </style>
</head>
<body>
  <h1><span>🎬</span> PosterForge</h1>
  <p class="subtitle">Free alternative to RPDB - Rating overlays for your Plex/Jellyfin posters</p>

  <!-- Config Section -->
  <div class="card" id="configCard">
    <h3>⚙️ Configuration</h3>
    <div id="configAlert" class="alert alert-warning hidden">
      Please configure your API keys to get started.
    </div>
    <form id="configForm">
      <div class="form-row">
        <div class="form-group">
          <label>TMDB API Key</label>
          <input type="password" id="tmdbKey" placeholder="Get from themoviedb.org">
        </div>
        <div class="form-group">
          <label>OMDB API Key</label>
          <input type="password" id="omdbKey" placeholder="Get from omdbapi.com">
        </div>
      </div>
      <div class="form-group">
        <label>Media Folders (comma-separated)</label>
        <input type="text" id="mediaFolders" placeholder="/posterforge/media/movies,/posterforge/media/tvshows">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Poster Style</label>
          <select id="posterStyle">
            <option value="badges">Badges (corner)</option>
            <option value="bar">Bar (bottom)</option>
            <option value="minimal">Minimal (small)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Ratings to Show</label>
          <input type="text" id="ratings" placeholder="imdb,rt,metacritic">
        </div>
      </div>
      <button type="submit" class="btn btn-success">💾 Save Configuration</button>
    </form>
  </div>

  <!-- Actions -->
  <div class="card">
    <button class="btn" onclick="scan()" id="scanBtn">🔍 Scan Folders</button>
    <button class="btn btn-success" onclick="process()" id="processBtn" disabled>🎨 Generate Posters</button>
    <button class="btn btn-secondary" onclick="refresh()">🔄 Refresh</button>
  </div>

  <!-- Stats -->
  <div class="card" id="statsCard" style="display:none;">
    <h3>📊 Library Status</h3>
    <div class="stats">
      <div class="stat"><div class="stat-value" id="total">0</div><div class="stat-label">Total</div></div>
      <div class="stat"><div class="stat-value" id="movies">0</div><div class="stat-label">Movies</div></div>
      <div class="stat"><div class="stat-value" id="shows">0</div><div class="stat-label">TV Shows</div></div>
      <div class="stat"><div class="stat-value" id="done">0</div><div class="stat-label">Done</div></div>
      <div class="stat"><div class="stat-value" id="pending">0</div><div class="stat-label">Pending</div></div>
    </div>
    <div class="progress" id="progressContainer" style="display:none;">
      <div class="progress-bar" id="progressBar" style="width:0%">0%</div>
    </div>
  </div>

  <!-- Items -->
  <div class="card" id="itemsCard" style="display:none;">
    <h3>📁 Media Items</h3>
    <div class="items" id="items"></div>
  </div>

  <script>
    let polling = null;
    let configured = false;

    async function loadConfig() {
      const res = await fetch('/api/config');
      const data = await res.json();
      configured = data.configured;
      
      if (data.mediaFolders?.length) document.getElementById('mediaFolders').value = data.mediaFolders.join(',');
      if (data.posterStyle) document.getElementById('posterStyle').value = data.posterStyle;
      if (data.ratings?.length) document.getElementById('ratings').value = data.ratings.join(',');
      
      document.getElementById('configAlert').classList.toggle('hidden', configured);
      document.getElementById('processBtn').disabled = !configured;
      
      if (configured) scan();
    }

    document.getElementById('configForm').onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        tmdbApiKey: document.getElementById('tmdbKey').value || undefined,
        omdbApiKey: document.getElementById('omdbKey').value || undefined,
        mediaFolders: document.getElementById('mediaFolders').value,
        posterStyle: document.getElementById('posterStyle').value,
        ratings: document.getElementById('ratings').value,
      };
      
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      
      if (result.configured) {
        document.getElementById('configAlert').classList.add('hidden');
        document.getElementById('processBtn').disabled = false;
        configured = true;
        scan();
      }
    };

    async function scan() {
      if (!configured) return;
      document.getElementById('scanBtn').disabled = true;
      
      try {
        const res = await fetch('/api/scan');
        const data = await res.json();
        
        document.getElementById('statsCard').style.display = 'block';
        document.getElementById('itemsCard').style.display = 'block';
        
        document.getElementById('total').textContent = data.summary.total;
        document.getElementById('movies').textContent = data.summary.movies;
        document.getElementById('shows').textContent = data.summary.shows;
        document.getElementById('done').textContent = data.summary.hasPoster;
        document.getElementById('pending').textContent = data.summary.needsProcessing;
        
        const itemsHtml = data.items.slice(0, 50).map(item => 
          '<div class="item">' +
            '<span class="item-status">' + (item.hasPoster ? '✅' : '⏳') + '</span>' +
            '<span class="item-icon">' + (item.type === 'movie' ? '🎬' : '📺') + '</span>' +
            '<span class="item-title">' + item.title + '</span>' +
            '<span class="item-year">' + (item.year || '') + '</span>' +
          '</div>'
        ).join('');
        document.getElementById('items').innerHTML = itemsHtml + (data.items.length > 50 ? '<div class="item">... and ' + (data.items.length - 50) + ' more</div>' : '');
      } finally {
        document.getElementById('scanBtn').disabled = false;
      }
    }

    async function process() {
      if (!confirm('Generate posters for all pending items?\\n\\nExisting posters will NOT be overwritten.')) return;
      
      document.getElementById('processBtn').disabled = true;
      document.getElementById('progressContainer').style.display = 'block';
      
      await fetch('/api/process', { method: 'POST' });
      polling = setInterval(pollProgress, 1000);
    }

    async function pollProgress() {
      const res = await fetch('/api/results');
      const data = await res.json();
      
      if (data.progress.total > 0) {
        const pct = Math.round((data.progress.current / data.progress.total) * 100);
        document.getElementById('progressBar').style.width = pct + '%';
        document.getElementById('progressBar').textContent = pct + '% (' + data.progress.current + '/' + data.progress.total + ')';
      }
      
      if (!data.processing && polling) {
        clearInterval(polling);
        polling = null;
        document.getElementById('processBtn').disabled = false;
        alert('Complete! ' + data.summary.success + ' posters created, ' + data.summary.failed + ' failed.');
        scan();
      }
    }

    function refresh() {
      loadConfig();
    }

    loadConfig();
  </script>
</body>
</html>
  `);
});

const config = getConfig();
app.listen(config.port, () => {
  console.log(`
🎬 PosterForge running on http://localhost:${config.port}

${isConfigured() ? '✅ Configured and ready!' : '⚠️  Not configured - open the web UI to add API keys'}
  `);
});
