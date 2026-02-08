import fs from 'fs';
import path from 'path';

export interface Config {
  tmdbApiKey: string;
  omdbApiKey: string;
  mediaFolders: string[];
  posterStyle: 'badges' | 'bar' | 'minimal';
  ratings: string[];
  overwrite: boolean;
  port: number;
}

const CONFIG_PATH = process.env.CONFIG_PATH || '/posterforge/config/config.json';

// Load config from file if it exists
function loadConfigFile(): Partial<Config> {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not load config file:', err);
  }
  return {};
}

// Save config to file
export function saveConfig(config: Partial<Config>): void {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Merge with existing config
    const existing = loadConfigFile();
    const merged = { ...existing, ...config };
    
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  } catch (err) {
    console.error('Could not save config:', err);
  }
}

// Get config from env vars + config file
export function getConfig(): Config {
  const fileConfig = loadConfigFile();
  
  return {
    tmdbApiKey: process.env.TMDB_API_KEY || fileConfig.tmdbApiKey || '',
    omdbApiKey: process.env.OMDB_API_KEY || fileConfig.omdbApiKey || '',
    mediaFolders: process.env.MEDIA_FOLDERS 
      ? process.env.MEDIA_FOLDERS.split(',').filter(Boolean)
      : fileConfig.mediaFolders || [],
    posterStyle: (process.env.POSTER_STYLE || fileConfig.posterStyle || 'badges') as Config['posterStyle'],
    ratings: process.env.RATINGS 
      ? process.env.RATINGS.split(',')
      : fileConfig.ratings || ['imdb', 'rt', 'metacritic'],
    overwrite: process.env.OVERWRITE === 'true' || fileConfig.overwrite || false,
    port: parseInt(process.env.PORT || '8750', 10) || fileConfig.port || 8750,
  };
}

// Check if config is valid
export function isConfigured(): boolean {
  const config = getConfig();
  return !!(config.tmdbApiKey && config.omdbApiKey && config.mediaFolders.length > 0);
}
