import fs from 'fs';
import path from 'path';
import { TMDBClient } from './api/tmdb.js';
import { OMDBClient } from './api/omdb.js';
import { scanAllFolders, type MediaItem } from './scanner/index.js';
import { createRatedPoster } from './compositor/index.js';

export interface ProcessorConfig {
  tmdbApiKey: string;
  omdbApiKey: string;
  mediaFolders: string[];
  style: 'badges' | 'bar' | 'minimal';
  ratings: string[];
  overwrite: boolean;
}

export interface ProcessResult {
  item: MediaItem;
  success: boolean;
  message: string;
  posterPath?: string;
}

export class PosterProcessor {
  private tmdb: TMDBClient;
  private omdb: OMDBClient;
  private config: ProcessorConfig;

  constructor(config: ProcessorConfig) {
    this.config = config;
    this.tmdb = new TMDBClient(config.tmdbApiKey);
    this.omdb = new OMDBClient(config.omdbApiKey);
  }

  // Process a single media item
  async processItem(item: MediaItem): Promise<ProcessResult> {
    const posterPath = path.join(item.folderPath, 'poster.jpg');

    // Skip if poster exists and not overwriting
    if (item.hasPoster && !this.config.overwrite) {
      return {
        item,
        success: true,
        message: 'Skipped (poster exists)',
        posterPath,
      };
    }

    try {
      // Step 1: Find the media on TMDB
      let imdbId = item.imdbId;
      let posterBuffer: Buffer | null = null;
      let tmdbRating: number | undefined;

      if (item.type === 'movie') {
        const result = await this.tmdb.findMovie(item.title, item.year);
        if (!result || !result.movie.poster_path) {
          return { item, success: false, message: 'Not found on TMDB' };
        }
        imdbId = imdbId || result.imdbId || undefined;
        tmdbRating = result.movie.vote_average;
        posterBuffer = await this.tmdb.downloadPoster(result.movie.poster_path);
      } else {
        const result = await this.tmdb.findShow(item.title, item.year);
        if (!result || !result.show.poster_path) {
          return { item, success: false, message: 'Not found on TMDB' };
        }
        imdbId = imdbId || result.imdbId || undefined;
        tmdbRating = result.show.vote_average;
        posterBuffer = await this.tmdb.downloadPoster(result.show.poster_path);
      }

      // Step 2: Get ratings from OMDB
      let ratings: { imdb: { rating: string; votes: string } | null; rottenTomatoes: string | null; metacritic: string | null } = { 
        imdb: null, 
        rottenTomatoes: null, 
        metacritic: null 
      };
      if (imdbId) {
        const omdbRatings = await this.omdb.getRatings(imdbId);
        if (omdbRatings) {
          ratings = omdbRatings;
        }
      }

      // Step 3: Create rated poster
      const ratedPoster = await createRatedPoster(posterBuffer, ratings, {
        tmdbRating,
        style: this.config.style,
        showRatings: this.config.ratings,
      });

      // Step 4: Save poster
      fs.writeFileSync(posterPath, ratedPoster);

      return {
        item,
        success: true,
        message: 'Poster created',
        posterPath,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { item, success: false, message };
    }
  }

  // Process all items in configured folders
  async processAll(onProgress?: (result: ProcessResult, current: number, total: number) => void): Promise<ProcessResult[]> {
    const items = scanAllFolders(this.config.mediaFolders);
    const results: ProcessResult[] = [];

    console.log(`Found ${items.length} media items to process`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const result = await this.processItem(item);
      results.push(result);

      if (onProgress) {
        onProgress(result, i + 1, items.length);
      }

      // Rate limiting - be nice to APIs
      await this.delay(250);
    }

    return results;
  }

  // Scan folders and return items (without processing)
  scan(): MediaItem[] {
    return scanAllFolders(this.config.mediaFolders);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create processor from environment variables
export function createProcessorFromEnv(): PosterProcessor {
  const config: ProcessorConfig = {
    tmdbApiKey: process.env.TMDB_API_KEY || '',
    omdbApiKey: process.env.OMDB_API_KEY || '',
    mediaFolders: (process.env.MEDIA_FOLDERS || '').split(',').filter(Boolean),
    style: (process.env.POSTER_STYLE as 'badges' | 'bar' | 'minimal') || 'badges',
    ratings: (process.env.RATINGS || 'imdb,rt,metacritic').split(','),
    overwrite: process.env.OVERWRITE === 'true',
  };

  if (!config.tmdbApiKey) {
    throw new Error('TMDB_API_KEY is required');
  }
  if (!config.omdbApiKey) {
    throw new Error('OMDB_API_KEY is required');
  }
  if (config.mediaFolders.length === 0) {
    throw new Error('MEDIA_FOLDERS is required');
  }

  return new PosterProcessor(config);
}
