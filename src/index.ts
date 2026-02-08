import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PosterProcessor, createProcessorFromEnv, type ProcessResult } from './processor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

let processor: PosterProcessor;
let isProcessing = false;
let processResults: ProcessResult[] = [];
let processProgress = { current: 0, total: 0 };

// Initialize processor
try {
  processor = createProcessorFromEnv();
} catch (error) {
  console.error('Configuration error:', error);
  console.log('Please configure .env file. See .env.example');
}

// API: Get status
app.get('/api/status', (req, res) => {
  res.json({
    configured: !!processor,
    processing: isProcessing,
    progress: processProgress,
    lastResults: processResults.length,
  });
});

// API: Scan folders
app.get('/api/scan', (req, res) => {
  if (!processor) {
    return res.status(500).json({ error: 'Not configured' });
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

// Serve simple UI
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>PosterForge</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { max-width: 900px; margin: 0 auto; padding: 20px; background: #0f172a; color: #e2e8f0; }
    h1 { display: flex; align-items: center; gap: 12px; }
    h1 span { font-size: 2rem; }
    .card { background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 16px; }
    .btn { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem; margin-right: 8px; }
    .btn:hover { background: #2563eb; }
    .btn:disabled { background: #64748b; cursor: not-allowed; }
    .btn-secondary { background: #475569; }
    .stats { display: flex; gap: 16px; flex-wrap: wrap; }
    .stat { background: #334155; padding: 16px; border-radius: 8px; min-width: 120px; text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; color: #3b82f6; }
    .stat-label { font-size: 0.875rem; color: #94a3b8; }
    .progress { background: #334155; border-radius: 8px; height: 24px; overflow: hidden; margin: 16px 0; }
    .progress-bar { background: #22c55e; height: 100%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; font-weight: bold; }
    .items { max-height: 400px; overflow-y: auto; }
    .item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #334155; }
    .item-icon { font-size: 1.25rem; }
    .item-status { width: 20px; }
    .item-title { flex: 1; }
    .item-year { color: #94a3b8; }
    #log { font-family: monospace; font-size: 0.875rem; background: #0f172a; padding: 12px; border-radius: 8px; max-height: 200px; overflow-y: auto; }
  </style>
</head>
<body>
  <h1><span>🎬</span> PosterForge</h1>
  
  <div class="card">
    <button class="btn" onclick="scan()">🔍 Scan Folders</button>
    <button class="btn" onclick="process()" id="processBtn">🎨 Generate Posters</button>
    <button class="btn btn-secondary" onclick="refresh()">🔄 Refresh</button>
  </div>

  <div class="card">
    <h3>📊 Status</h3>
    <div class="stats" id="stats">
      <div class="stat"><div class="stat-value" id="total">-</div><div class="stat-label">Total</div></div>
      <div class="stat"><div class="stat-value" id="movies">-</div><div class="stat-label">Movies</div></div>
      <div class="stat"><div class="stat-value" id="shows">-</div><div class="stat-label">TV Shows</div></div>
      <div class="stat"><div class="stat-value" id="done">-</div><div class="stat-label">Done</div></div>
      <div class="stat"><div class="stat-value" id="pending">-</div><div class="stat-label">Pending</div></div>
    </div>
    <div class="progress" id="progressContainer" style="display:none;">
      <div class="progress-bar" id="progressBar" style="width:0%">0%</div>
    </div>
  </div>

  <div class="card">
    <h3>📁 Media Items</h3>
    <div class="items" id="items"></div>
  </div>

  <div class="card">
    <h3>📝 Log</h3>
    <div id="log"></div>
  </div>

  <script>
    let polling = null;

    async function scan() {
      log('Scanning folders...');
      const res = await fetch('/api/scan');
      const data = await res.json();
      
      document.getElementById('total').textContent = data.summary.total;
      document.getElementById('movies').textContent = data.summary.movies;
      document.getElementById('shows').textContent = data.summary.shows;
      document.getElementById('done').textContent = data.summary.hasPoster;
      document.getElementById('pending').textContent = data.summary.needsProcessing;
      
      const itemsHtml = data.items.slice(0, 50).map(item => \`
        <div class="item">
          <span class="item-status">\${item.hasPoster ? '✅' : '⏳'}</span>
          <span class="item-icon">\${item.type === 'movie' ? '🎬' : '📺'}</span>
          <span class="item-title">\${item.title}</span>
          <span class="item-year">\${item.year || ''}</span>
        </div>
      \`).join('');
      document.getElementById('items').innerHTML = itemsHtml + (data.items.length > 50 ? '<div class="item">... and more</div>' : '');
      
      log('Found ' + data.summary.total + ' items (' + data.summary.needsProcessing + ' need processing)');
    }

    async function process() {
      if (confirm('Start processing all pending items?')) {
        log('Starting processing...');
        document.getElementById('processBtn').disabled = true;
        document.getElementById('progressContainer').style.display = 'block';
        
        await fetch('/api/process', { method: 'POST' });
        
        polling = setInterval(pollProgress, 1000);
      }
    }

    async function pollProgress() {
      const res = await fetch('/api/results');
      const data = await res.json();
      
      if (data.progress.total > 0) {
        const pct = Math.round((data.progress.current / data.progress.total) * 100);
        document.getElementById('progressBar').style.width = pct + '%';
        document.getElementById('progressBar').textContent = pct + '%';
      }
      
      if (!data.processing && polling) {
        clearInterval(polling);
        polling = null;
        document.getElementById('processBtn').disabled = false;
        log('Complete! ' + data.summary.success + ' succeeded, ' + data.summary.failed + ' failed');
        scan();
      }
    }

    async function refresh() {
      const res = await fetch('/api/status');
      const data = await res.json();
      log('Status: ' + (data.configured ? 'Configured' : 'Not configured') + ', Processing: ' + data.processing);
      if (data.configured) scan();
    }

    function log(msg) {
      const el = document.getElementById('log');
      el.innerHTML = '[' + new Date().toLocaleTimeString() + '] ' + msg + '<br>' + el.innerHTML;
    }

    refresh();
  </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 8760;
app.listen(PORT, () => {
  console.log(`
🎬 PosterForge running on http://localhost:${PORT}

Configure in .env:
  TMDB_API_KEY     - Get from themoviedb.org
  OMDB_API_KEY     - Get from omdbapi.com
  MEDIA_FOLDERS    - Your movie/TV folders
  `);
});
