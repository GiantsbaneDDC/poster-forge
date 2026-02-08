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

  // Preview a single item - returns the actual composite poster as base64
  async preview(item: Partial<MediaItem>): Promise<{
    title: string;
    year?: number;
    posterUrl?: string;
    previewImage?: string; // base64 data URL of the composite poster
    ratings: { source: string; value: string }[];
  } | null> {
    try {
      let imdbId: string | undefined;
      let posterPath: string | null = null;
      let posterBuffer: Buffer | null = null;
      let tmdbRating: number | undefined;
      let title = item.title || '';
      let year = item.year;

      if (item.type === 'movie') {
        const result = await this.tmdb.findMovie(title, year);
        if (!result) return null;
        title = result.movie.title;
        year = result.movie.release_date ? parseInt(result.movie.release_date.slice(0, 4)) : year;
        imdbId = result.imdbId || undefined;
        posterPath = result.movie.poster_path;
        tmdbRating = result.movie.vote_average;
        if (posterPath) {
          posterBuffer = await this.tmdb.downloadPoster(posterPath);
        }
      } else {
        const result = await this.tmdb.findShow(title, year);
        if (!result) return null;
        title = result.show.name;
        year = result.show.first_air_date ? parseInt(result.show.first_air_date.slice(0, 4)) : year;
        imdbId = result.imdbId || undefined;
        posterPath = result.show.poster_path;
        tmdbRating = result.show.vote_average;
        if (posterPath) {
          posterBuffer = await this.tmdb.downloadPoster(posterPath);
        }
      }

      const ratings: { source: string; value: string }[] = [];
      let omdbRatings: { imdb: { rating: string; votes: string } | null; rottenTomatoes: string | null; metacritic: string | null } = {
        imdb: null,
        rottenTomatoes: null,
        metacritic: null,
      };
      
      if (imdbId) {
        const fetchedRatings = await this.omdb.getRatings(imdbId);
        if (fetchedRatings) {
          omdbRatings = fetchedRatings;
          if (fetchedRatings.imdb) ratings.push({ source: 'IMDb', value: fetchedRatings.imdb.rating });
          if (fetchedRatings.rottenTomatoes) ratings.push({ source: 'RT', value: fetchedRatings.rottenTomatoes });
          if (fetchedRatings.metacritic) ratings.push({ source: 'Metacritic', value: fetchedRatings.metacritic });
        }
      }

      // Generate the actual composite poster preview
      let previewImage: string | undefined;
      if (posterBuffer) {
        const compositePoster = await createRatedPoster(posterBuffer, omdbRatings, {
          tmdbRating,
          style: this.config.style,
          showRatings: this.config.ratings,
        });
        previewImage = 'data:image/jpeg;base64,' + compositePoster.toString('base64');
      }

      return {
        title,
        year,
        posterUrl: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : undefined,
        previewImage,
        ratings,
      };
    } catch (error) {
      console.error('Preview error:', error);
      return null;
    }
  }

  // Process a single item by partial info
  async processSingle(itemInfo: Partial<MediaItem>): Promise<ProcessResult> {
    const folderPath = itemInfo.folderPath || '';
    const item: MediaItem = {
      folderPath,
      folderName: itemInfo.folderName || folderPath.split('/').pop() || '',
      title: itemInfo.title || '',
      year: itemInfo.year,
      type: itemInfo.type || 'movie',
      hasPoster: false,
    };
    return this.processItem(item);
  }

  // Process all items in configured folders
  async processAll(onProgress?: (result: ProcessResult, current: number, total: number) => void, dryRun = false, overwriteAll = false): Promise<ProcessResult[]> {
    const items = scanAllFolders(this.config.mediaFolders);
    const results: ProcessResult[] = [];
    
    // Temporarily set overwrite if regenerating all
    const originalOverwrite = this.config.overwrite;
    if (overwriteAll) {
      this.config.overwrite = true;
    }

    console.log(`Found ${items.length} media items to process${dryRun ? ' (dry run)' : ''}${overwriteAll ? ' (overwrite all)' : ''}`);

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (dryRun) {
          // For dry run, just check what would be processed
          const wouldProcess = !item.hasPoster || this.config.overwrite;
          results.push({
            item,
            success: true,
            message: wouldProcess ? 'Would generate poster' : 'Would skip (poster exists)',
          });
        } else {
          const result = await this.processItem(item);
          results.push(result);
        }

        if (onProgress) {
          onProgress(results[results.length - 1], i + 1, items.length);
        }

        // Rate limiting - be nice to APIs (skip delay for dry run)
        if (!dryRun) await this.delay(250);
      }
    } finally {
      // Restore original overwrite setting
      this.config.overwrite = originalOverwrite;
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
