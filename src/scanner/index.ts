import fs from 'fs';
import path from 'path';

export interface MediaItem {
  folderPath: string;
  folderName: string;
  title: string;
  year?: number;
  type: 'movie' | 'show';
  imdbId?: string;
  tmdbId?: string;
  tvdbId?: string;
  hasPoster: boolean;
}

// Regex patterns for extracting info from folder names
const YEAR_PATTERN = /[\(\[\{]?((?:19|20)\d{2})[\)\]\}]?/;
const IMDB_PATTERN = /[\[\{]imdb[-:=]?(tt\d+)[\]\}]/i;
const TMDB_PATTERN = /[\[\{]tmdb[-:=]?(\d+)[\]\}]/i;
const TVDB_PATTERN = /[\[\{]tvdb[-:=]?(\d+)[\]\}]/i;

// Common video extensions
const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.mov', '.wmv', '.ts', '.m2ts'];

// Parse a folder name to extract title, year, and IDs
export function parseFolderName(folderName: string): { 
  title: string; 
  year?: number; 
  imdbId?: string;
  tmdbId?: string;
  tvdbId?: string;
} {
  let name = folderName;
  let year: number | undefined;
  let imdbId: string | undefined;
  let tmdbId: string | undefined;
  let tvdbId: string | undefined;

  // Extract IMDB ID
  const imdbMatch = name.match(IMDB_PATTERN);
  if (imdbMatch) {
    imdbId = imdbMatch[1];
    name = name.replace(IMDB_PATTERN, '');
  }

  // Extract TMDB ID
  const tmdbMatch = name.match(TMDB_PATTERN);
  if (tmdbMatch) {
    tmdbId = tmdbMatch[1];
    name = name.replace(TMDB_PATTERN, '');
  }

  // Extract TVDB ID
  const tvdbMatch = name.match(TVDB_PATTERN);
  if (tvdbMatch) {
    tvdbId = tvdbMatch[1];
    name = name.replace(TVDB_PATTERN, '');
  }

  // Extract year
  const yearMatch = name.match(YEAR_PATTERN);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
    name = name.replace(YEAR_PATTERN, '');
  }

  // Clean up the title
  const title = name
    .replace(/[\[\]\(\)\{\}]/g, '') // Remove brackets
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .trim();

  return { title, year, imdbId, tmdbId, tvdbId };
}

// Determine if a folder is a movie or TV show based on structure
export function detectMediaType(folderPath: string): 'movie' | 'show' {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  
  // Check for season folders (Season 1, S01, etc.)
  const hasSeasonFolders = entries.some(e => 
    e.isDirectory() && /^(season|s)\s*\d+/i.test(e.name)
  );
  
  if (hasSeasonFolders) return 'show';

  // Check for episode patterns in video files
  const videoFiles = entries.filter(e => 
    e.isFile() && VIDEO_EXTENSIONS.includes(path.extname(e.name).toLowerCase())
  );
  
  const hasEpisodePattern = videoFiles.some(f => 
    /s\d{1,2}e\d{1,2}|(\d{1,2})x(\d{1,2})/i.test(f.name)
  );
  
  if (hasEpisodePattern) return 'show';

  return 'movie';
}

// Scan a media folder and return all media items
export function scanMediaFolder(mediaFolderPath: string): MediaItem[] {
  const items: MediaItem[] = [];

  if (!fs.existsSync(mediaFolderPath)) {
    console.warn(`Folder does not exist: ${mediaFolderPath}`);
    return items;
  }

  const entries = fs.readdirSync(mediaFolderPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    // Skip hidden folders and common non-media folders
    if (entry.name.startsWith('.') || entry.name.startsWith('@')) continue;
    
    const folderPath = path.join(mediaFolderPath, entry.name);
    const parsed = parseFolderName(entry.name);
    const type = detectMediaType(folderPath);
    
    // Check if poster already exists
    const posterPath = path.join(folderPath, 'poster.jpg');
    const hasPoster = fs.existsSync(posterPath);

    items.push({
      folderPath,
      folderName: entry.name,
      title: parsed.title,
      year: parsed.year,
      type,
      imdbId: parsed.imdbId,
      tmdbId: parsed.tmdbId,
      tvdbId: parsed.tvdbId,
      hasPoster,
    });
  }

  return items;
}

// Scan multiple media folders
export function scanAllFolders(folderPaths: string[]): MediaItem[] {
  const allItems: MediaItem[] = [];
  
  for (const folderPath of folderPaths) {
    const items = scanMediaFolder(folderPath);
    allItems.push(...items);
  }

  return allItems;
}
