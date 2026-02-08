import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PosterProcessor, type ProcessResult } from './processor.js';
import { getConfig, saveConfig, isConfigured, type Config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

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
  if (mediaFolders) updates.mediaFolders = Array.isArray(mediaFolders) ? mediaFolders : mediaFolders.split(',').map((s: string) => s.trim());
  if (posterStyle) updates.posterStyle = posterStyle;
  if (ratings) updates.ratings = Array.isArray(ratings) ? ratings : ratings.split(',').map((s: string) => s.trim());
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

// API: Preview a single item (dry run)
app.post('/api/preview', async (req, res) => {
  if (!processor) {
    return res.status(500).json({ error: 'Not configured' });
  }

  const { folderPath, title, year, type } = req.body;
  
  try {
    const preview = await processor.preview({ folderPath, title, year, type });
    if (preview) {
      res.json(preview);
    } else {
      res.status(404).json({ error: 'Could not generate preview' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// API: Process a single item
app.post('/api/process-single', async (req, res) => {
  if (!processor) {
    return res.status(500).json({ error: 'Not configured' });
  }

  const { folderPath, title, year, type } = req.body;
  
  try {
    const result = await processor.processSingle({ folderPath, title, year, type });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// API: Start processing all
app.post('/api/process', async (req, res) => {
  if (!processor) {
    return res.status(500).json({ error: 'Not configured' });
  }

  if (isProcessing) {
    return res.status(409).json({ error: 'Already processing' });
  }

  const dryRun = req.query.dryRun === 'true';

  isProcessing = true;
  processResults = [];
  processProgress = { current: 0, total: 0 };

  res.json({ message: dryRun ? 'Dry run started' : 'Processing started' });

  try {
    processResults = await processor.processAll((result, current, total) => {
      processProgress = { current, total };
    }, dryRun);
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
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PosterForge</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎬</text></svg>">
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --success: #22c55e;
      --success-hover: #16a34a;
      --warning: #f59e0b;
      --danger: #ef4444;
      --border: #334155;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
    }
    
    [data-theme="light"] {
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-tertiary: #e2e8f0;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --border: #cbd5e1;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      transition: background 0.3s, color 0.3s;
    }

    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      flex-wrap: wrap;
      gap: 16px;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-icon {
      font-size: 2.5rem;
    }
    
    .logo h1 {
      font-size: 1.75rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent), #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .logo p {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    /* Theme Toggle */
    .theme-toggle {
      background: var(--bg-tertiary);
      border: none;
      border-radius: 8px;
      padding: 10px;
      cursor: pointer;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    
    .theme-toggle:hover { background: var(--border); }

    /* Cards */
    .card {
      background: var(--bg-secondary);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
      border: 1px solid var(--border);
    }
    
    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    
    .card-header i { color: var(--accent); }
    .card-header h2 { font-size: 1.125rem; font-weight: 600; }

    /* Forms */
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
    }
    
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full { grid-column: 1 / -1; }
    
    .form-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .form-input, .form-select {
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 0.9375rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    
    .form-input:focus, .form-select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }
    
    .form-input::placeholder { color: var(--text-muted); }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 10px;
      border: none;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-primary { background: var(--accent); color: white; }
    .btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); }
    
    .btn-success { background: var(--success); color: white; }
    .btn-success:hover { background: var(--success-hover); transform: translateY(-1px); }
    
    .btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); }
    .btn-secondary:hover { background: var(--border); }
    
    .btn-warning { background: var(--warning); color: white; }
    
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
    
    .btn-group { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
    }
    
    .stat-card {
      background: var(--bg-primary);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      border: 1px solid var(--border);
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent);
      line-height: 1;
    }
    
    .stat-value.success { color: var(--success); }
    .stat-value.warning { color: var(--warning); }
    
    .stat-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 8px;
    }

    /* Progress */
    .progress-container { margin: 20px 0; display: none; }
    .progress-container.active { display: block; }
    
    .progress-bar-bg {
      background: var(--bg-primary);
      border-radius: 12px;
      height: 40px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    
    .progress-bar {
      background: linear-gradient(90deg, var(--success), #34d399);
      height: 100%;
      width: 0%;
      transition: width 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 0.875rem;
    }

    /* Media Items */
    .items-list {
      max-height: 500px;
      overflow-y: auto;
    }
    
    .item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      border-radius: 12px;
      background: var(--bg-primary);
      margin-bottom: 8px;
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .item:hover {
      border-color: var(--accent);
      transform: translateX(4px);
    }
    
    .item-status {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .item-status.done { background: rgba(34, 197, 94, 0.2); color: var(--success); }
    .item-status.pending { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
    
    .item-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: var(--bg-tertiary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .item-info { flex: 1; min-width: 0; }
    .item-title { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .item-meta { font-size: 0.8125rem; color: var(--text-muted); margin-top: 2px; }
    
    .item-actions { display: flex; gap: 8px; }
    
    .item-btn {
      padding: 8px 12px;
      border-radius: 8px;
      border: none;
      background: var(--bg-tertiary);
      color: var(--text-primary);
      cursor: pointer;
      font-size: 0.8125rem;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.2s;
    }
    
    .item-btn:hover { background: var(--accent); color: white; }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }
    
    .modal-overlay.active { display: flex; }
    
    .modal {
      background: var(--bg-secondary);
      border-radius: 20px;
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5);
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
    }
    
    .modal-header h3 {
      font-size: 1.25rem;
      font-weight: 600;
    }
    
    .modal-close {
      background: var(--bg-tertiary);
      border: none;
      border-radius: 8px;
      padding: 8px;
      cursor: pointer;
      color: var(--text-primary);
    }
    
    .modal-body { padding: 24px; }
    
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 20px 24px;
      border-top: 1px solid var(--border);
    }

    /* Preview */
    .preview-container {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }
    
    .preview-poster {
      flex: 0 0 200px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: var(--shadow);
    }
    
    .preview-poster img {
      width: 100%;
      display: block;
    }
    
    .preview-info { flex: 1; min-width: 200px; }
    
    .preview-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 8px; }
    .preview-year { color: var(--text-muted); margin-bottom: 16px; }
    
    .preview-ratings {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .rating-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--bg-primary);
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    
    .rating-badge img { height: 20px; }
    .rating-badge span { font-weight: 600; }

    /* Alerts */
    .alert {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    
    .alert-warning {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid var(--warning);
      color: var(--warning);
    }
    
    .alert-success {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid var(--success);
      color: var(--success);
    }

    /* Toast */
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .toast {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: var(--shadow);
      animation: slideIn 0.3s ease;
      min-width: 300px;
    }
    
    .toast.success { border-color: var(--success); }
    .toast.error { border-color: var(--danger); }
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }

    .hidden { display: none !important; }
    
    /* Loading spinner */
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--bg-tertiary);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 4px;
      background: var(--bg-primary);
      padding: 4px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    
    .tab {
      flex: 1;
      padding: 12px 20px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .tab:hover { color: var(--text-primary); }
    .tab.active { background: var(--bg-secondary); color: var(--text-primary); box-shadow: var(--shadow); }

    /* Filter */
    .filter-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    
    .search-input {
      flex: 1;
      min-width: 200px;
      padding: 10px 16px 10px 40px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 0.9375rem;
    }
    
    .search-wrapper {
      position: relative;
      flex: 1;
      min-width: 200px;
    }
    
    .search-wrapper i {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
    }

    .filter-btn {
      padding: 10px 16px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg-primary);
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .filter-btn:hover, .filter-btn.active {
      border-color: var(--accent);
      color: var(--accent);
    }

    @media (max-width: 640px) {
      .header { flex-direction: column; align-items: flex-start; }
      .btn-group { flex-direction: column; }
      .btn-group .btn { width: 100%; justify-content: center; }
      .preview-container { flex-direction: column; }
      .preview-poster { flex: 0 0 auto; max-width: 200px; margin: 0 auto; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="logo">
        <span class="logo-icon">🎬</span>
        <div>
          <h1>PosterForge</h1>
          <p>Rating overlays for Plex, Jellyfin & Emby</p>
        </div>
      </div>
      <div class="header-actions">
        <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
          <i data-lucide="sun" class="sun-icon"></i>
          <i data-lucide="moon" class="moon-icon hidden"></i>
        </button>
      </div>
    </header>

    <!-- Alert -->
    <div id="configAlert" class="alert alert-warning hidden">
      <i data-lucide="alert-triangle"></i>
      <span>Please configure your API keys to get started.</span>
    </div>

    <!-- Config Card -->
    <div class="card">
      <div class="card-header">
        <i data-lucide="settings"></i>
        <h2>Configuration</h2>
      </div>
      <form id="configForm">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label"><i data-lucide="key" style="width:14px;height:14px"></i> TMDB API Key</label>
            <input type="password" id="tmdbKey" class="form-input" placeholder="Get from themoviedb.org">
          </div>
          <div class="form-group">
            <label class="form-label"><i data-lucide="key" style="width:14px;height:14px"></i> OMDB API Key</label>
            <input type="password" id="omdbKey" class="form-input" placeholder="Get from omdbapi.com">
          </div>
          <div class="form-group full">
            <label class="form-label"><i data-lucide="folder" style="width:14px;height:14px"></i> Media Folders</label>
            <input type="text" id="mediaFolders" class="form-input" placeholder="/media/movies, /media/tv">
          </div>
          <div class="form-group">
            <label class="form-label"><i data-lucide="palette" style="width:14px;height:14px"></i> Poster Style</label>
            <select id="posterStyle" class="form-select">
              <option value="badges">Badges (corner)</option>
              <option value="bar">Bar (bottom)</option>
              <option value="minimal">Minimal (small)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label"><i data-lucide="star" style="width:14px;height:14px"></i> Ratings to Show</label>
            <input type="text" id="ratings" class="form-input" placeholder="imdb, rt, metacritic">
          </div>
        </div>
        <div class="btn-group">
          <button type="submit" class="btn btn-success"><i data-lucide="save"></i> Save Configuration</button>
        </div>
      </form>
    </div>

    <!-- Actions Card -->
    <div class="card">
      <div class="card-header">
        <i data-lucide="zap"></i>
        <h2>Actions</h2>
      </div>
      <div class="btn-group" style="margin-top:0">
        <button class="btn btn-primary" onclick="scan()" id="scanBtn">
          <i data-lucide="search"></i> Scan Library
        </button>
        <button class="btn btn-warning" onclick="dryRun()" id="dryRunBtn" disabled>
          <i data-lucide="eye"></i> Dry Run
        </button>
        <button class="btn btn-success" onclick="processAll()" id="processBtn" disabled>
          <i data-lucide="wand-2"></i> Generate All
        </button>
        <button class="btn btn-secondary" onclick="refresh()">
          <i data-lucide="refresh-cw"></i> Refresh
        </button>
      </div>
    </div>

    <!-- Stats Card -->
    <div class="card hidden" id="statsCard">
      <div class="card-header">
        <i data-lucide="bar-chart-3"></i>
        <h2>Library Stats</h2>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" id="statTotal">0</div>
          <div class="stat-label">Total Items</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="statMovies">0</div>
          <div class="stat-label">Movies</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="statShows">0</div>
          <div class="stat-label">TV Shows</div>
        </div>
        <div class="stat-card">
          <div class="stat-value success" id="statDone">0</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value warning" id="statPending">0</div>
          <div class="stat-label">Pending</div>
        </div>
      </div>
      <div class="progress-container" id="progressContainer">
        <div class="progress-bar-bg">
          <div class="progress-bar" id="progressBar">0%</div>
        </div>
      </div>
    </div>

    <!-- Items Card -->
    <div class="card hidden" id="itemsCard">
      <div class="card-header">
        <i data-lucide="film"></i>
        <h2>Media Library</h2>
      </div>
      
      <div class="tabs">
        <button class="tab active" data-filter="all" onclick="setFilter('all')">
          <i data-lucide="layers"></i> All
        </button>
        <button class="tab" data-filter="pending" onclick="setFilter('pending')">
          <i data-lucide="clock"></i> Pending
        </button>
        <button class="tab" data-filter="done" onclick="setFilter('done')">
          <i data-lucide="check-circle"></i> Done
        </button>
      </div>
      
      <div class="filter-bar">
        <div class="search-wrapper">
          <i data-lucide="search" style="width:16px;height:16px"></i>
          <input type="text" class="search-input" id="searchInput" placeholder="Search titles..." oninput="filterItems()">
        </div>
        <button class="filter-btn" data-type="movie" onclick="toggleType('movie')">
          <i data-lucide="film"></i> Movies
        </button>
        <button class="filter-btn" data-type="show" onclick="toggleType('show')">
          <i data-lucide="tv"></i> TV Shows
        </button>
      </div>
      
      <div class="items-list" id="itemsList"></div>
    </div>
  </div>

  <!-- Preview Modal -->
  <div class="modal-overlay" id="previewModal">
    <div class="modal">
      <div class="modal-header">
        <h3>Preview Poster</h3>
        <button class="modal-close" onclick="closeModal()">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="preview-container" id="previewContent">
          <div style="text-align:center;padding:40px;">
            <div class="spinner" style="margin:0 auto 16px"></div>
            <p>Loading preview...</p>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        <button class="btn btn-success" id="generateBtn" onclick="generateCurrent()">
          <i data-lucide="download"></i> Generate Poster
        </button>
      </div>
    </div>
  </div>

  <!-- Toast Container -->
  <div class="toast-container" id="toastContainer"></div>

  <script>
    let allItems = [];
    let currentFilter = 'all';
    let currentTypeFilter = null;
    let configured = false;
    let polling = null;
    let currentItem = null;

    // Theme
    function toggleTheme() {
      const isDark = document.body.getAttribute('data-theme') !== 'light';
      document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
      document.querySelector('.sun-icon').classList.toggle('hidden', !isDark);
      document.querySelector('.moon-icon').classList.toggle('hidden', isDark);
      localStorage.setItem('theme', isDark ? 'light' : 'dark');
    }

    function loadTheme() {
      const saved = localStorage.getItem('theme') || 'dark';
      document.body.setAttribute('data-theme', saved);
      document.querySelector('.sun-icon').classList.toggle('hidden', saved === 'dark');
      document.querySelector('.moon-icon').classList.toggle('hidden', saved === 'light');
    }

    // Toast notifications
    function toast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const el = document.createElement('div');
      el.className = 'toast ' + type;
      el.innerHTML = '<i data-lucide="' + (type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info') + '"></i><span>' + message + '</span>';
      container.appendChild(el);
      lucide.createIcons();
      setTimeout(() => el.remove(), 4000);
    }

    // Load config
    async function loadConfig() {
      const res = await fetch('/api/config');
      const data = await res.json();
      configured = data.configured;
      
      if (data.mediaFolders?.length) document.getElementById('mediaFolders').value = data.mediaFolders.join(', ');
      if (data.posterStyle) document.getElementById('posterStyle').value = data.posterStyle;
      if (data.ratings?.length) document.getElementById('ratings').value = data.ratings.join(', ');
      
      document.getElementById('configAlert').classList.toggle('hidden', configured);
      document.getElementById('processBtn').disabled = !configured;
      document.getElementById('dryRunBtn').disabled = !configured;
      
      if (configured) scan();
    }

    // Save config
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
        configured = true;
        document.getElementById('configAlert').classList.add('hidden');
        document.getElementById('processBtn').disabled = false;
        document.getElementById('dryRunBtn').disabled = false;
        toast('Configuration saved!', 'success');
        scan();
      }
    };

    // Scan
    async function scan() {
      if (!configured) return;
      document.getElementById('scanBtn').disabled = true;
      document.getElementById('scanBtn').innerHTML = '<div class="spinner"></div> Scanning...';
      
      try {
        const res = await fetch('/api/scan');
        const data = await res.json();
        
        allItems = data.items;
        
        document.getElementById('statsCard').classList.remove('hidden');
        document.getElementById('itemsCard').classList.remove('hidden');
        
        document.getElementById('statTotal').textContent = data.summary.total;
        document.getElementById('statMovies').textContent = data.summary.movies;
        document.getElementById('statShows').textContent = data.summary.shows;
        document.getElementById('statDone').textContent = data.summary.hasPoster;
        document.getElementById('statPending').textContent = data.summary.needsProcessing;
        
        filterItems();
        toast('Found ' + data.summary.total + ' items', 'success');
      } catch (err) {
        toast('Scan failed: ' + err.message, 'error');
      } finally {
        document.getElementById('scanBtn').disabled = false;
        document.getElementById('scanBtn').innerHTML = '<i data-lucide="search"></i> Scan Library';
        lucide.createIcons();
      }
    }

    // Filter
    function setFilter(filter) {
      currentFilter = filter;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.tab[data-filter="' + filter + '"]').classList.add('active');
      filterItems();
    }

    function toggleType(type) {
      const btn = document.querySelector('.filter-btn[data-type="' + type + '"]');
      if (currentTypeFilter === type) {
        currentTypeFilter = null;
        btn.classList.remove('active');
      } else {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        currentTypeFilter = type;
        btn.classList.add('active');
      }
      filterItems();
    }

    function filterItems() {
      const search = document.getElementById('searchInput').value.toLowerCase();
      let items = allItems;
      
      if (currentFilter === 'pending') items = items.filter(i => !i.hasPoster);
      if (currentFilter === 'done') items = items.filter(i => i.hasPoster);
      if (currentTypeFilter) items = items.filter(i => i.type === currentTypeFilter);
      if (search) items = items.filter(i => i.title.toLowerCase().includes(search));
      
      renderItems(items.slice(0, 100));
    }

    function renderItems(items) {
      const html = items.map(item => 
        '<div class="item" onclick="previewItem(this)" data-item=\\'' + JSON.stringify(item).replace(/'/g, "\\\\'") + '\\'>' +
          '<div class="item-status ' + (item.hasPoster ? 'done' : 'pending') + '">' +
            '<i data-lucide="' + (item.hasPoster ? 'check' : 'clock') + '" style="width:16px;height:16px"></i>' +
          '</div>' +
          '<div class="item-icon">' +
            '<i data-lucide="' + (item.type === 'movie' ? 'film' : 'tv') + '"></i>' +
          '</div>' +
          '<div class="item-info">' +
            '<div class="item-title">' + item.title + '</div>' +
            '<div class="item-meta">' + (item.year || 'Unknown year') + ' • ' + (item.type === 'movie' ? 'Movie' : 'TV Show') + '</div>' +
          '</div>' +
        '</div>'
      ).join('');
      
      document.getElementById('itemsList').innerHTML = html || '<p style="text-align:center;color:var(--text-muted);padding:40px;">No items found</p>';
      lucide.createIcons();
    }

    // Preview
    async function previewItem(el) {
      currentItem = JSON.parse(el.dataset.item);
      document.getElementById('previewModal').classList.add('active');
      document.getElementById('previewContent').innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner" style="margin:0 auto 16px"></div><p>Loading preview...</p></div>';
      
      try {
        const res = await fetch('/api/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentItem),
        });
        const data = await res.json();
        
        if (data.error) {
          document.getElementById('previewContent').innerHTML = '<p style="text-align:center;color:var(--danger);">' + data.error + '</p>';
          return;
        }
        
        const ratingsHtml = (data.ratings || []).map(r => 
          '<div class="rating-badge"><span>' + r.source + '</span><span>' + r.value + '</span></div>'
        ).join('');
        
        document.getElementById('previewContent').innerHTML = 
          '<div class="preview-poster"><img src="' + (data.posterUrl || '') + '" alt="Poster"></div>' +
          '<div class="preview-info">' +
            '<div class="preview-title">' + (data.title || currentItem.title) + '</div>' +
            '<div class="preview-year">' + (data.year || currentItem.year || '') + '</div>' +
            '<div class="preview-ratings">' + ratingsHtml + '</div>' +
          '</div>';
      } catch (err) {
        document.getElementById('previewContent').innerHTML = '<p style="text-align:center;color:var(--danger);">Failed to load preview</p>';
      }
    }

    function closeModal() {
      document.getElementById('previewModal').classList.remove('active');
      currentItem = null;
    }

    async function generateCurrent() {
      if (!currentItem) return;
      document.getElementById('generateBtn').disabled = true;
      document.getElementById('generateBtn').innerHTML = '<div class="spinner"></div> Generating...';
      
      try {
        const res = await fetch('/api/process-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentItem),
        });
        const data = await res.json();
        
        if (data.success) {
          toast('Poster generated successfully!', 'success');
          closeModal();
          scan();
        } else {
          toast('Failed: ' + (data.error || 'Unknown error'), 'error');
        }
      } catch (err) {
        toast('Error: ' + err.message, 'error');
      } finally {
        document.getElementById('generateBtn').disabled = false;
        document.getElementById('generateBtn').innerHTML = '<i data-lucide="download"></i> Generate Poster';
        lucide.createIcons();
      }
    }

    // Dry run
    async function dryRun() {
      if (!confirm('This will show what posters would be generated without actually creating them.')) return;
      await runProcess(true);
    }

    // Process all
    async function processAll() {
      if (!confirm('Generate posters for all pending items?\\n\\nExisting posters will NOT be overwritten.')) return;
      await runProcess(false);
    }

    async function runProcess(dryRun) {
      document.getElementById('processBtn').disabled = true;
      document.getElementById('dryRunBtn').disabled = true;
      document.getElementById('progressContainer').classList.add('active');
      
      await fetch('/api/process' + (dryRun ? '?dryRun=true' : ''), { method: 'POST' });
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
        document.getElementById('dryRunBtn').disabled = false;
        document.getElementById('progressContainer').classList.remove('active');
        toast('Complete! ' + data.summary.success + ' succeeded, ' + data.summary.failed + ' failed.', 'success');
        scan();
      }
    }

    function refresh() {
      loadConfig();
    }

    // Init
    loadTheme();
    loadConfig();
    lucide.createIcons();
  </script>
</body>
</html>`);
});

const config = getConfig();
const host = process.env.HOST || '0.0.0.0';
app.listen(config.port, host, () => {
  console.log(\`
🎬 PosterForge running on http://\${host}:\${config.port}

\${isConfigured() ? '✅ Configured and ready!' : '⚠️  Not configured - open the web UI to add API keys'}
  \`);
});
