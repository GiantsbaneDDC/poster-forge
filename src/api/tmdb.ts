import axios from 'axios';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export interface TMDBMovie {
  id: number;
  imdb_id?: string;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
}

export interface TMDBShow {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
}

export interface TMDBExternalIds {
  imdb_id: string | null;
  tvdb_id: number | null;
}

export class TMDBClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = `${TMDB_BASE}${endpoint}`;
    const response = await axios.get<T>(url, {
      params: { api_key: this.apiKey, ...params },
    });
    return response.data;
  }

  // Search for a movie by title and year
  async searchMovie(title: string, year?: number): Promise<TMDBMovie[]> {
    const params: Record<string, string> = { query: title };
    if (year) params.year = year.toString();
    
    const response = await this.get<{ results: TMDBMovie[] }>('/search/movie', params);
    return response.results;
  }

  // Search for a TV show by title and year
  async searchShow(title: string, year?: number): Promise<TMDBShow[]> {
    const params: Record<string, string> = { query: title };
    if (year) params.first_air_date_year = year.toString();
    
    const response = await this.get<{ results: TMDBShow[] }>('/search/tv', params);
    return response.results;
  }

  // Get movie details including IMDB ID
  async getMovie(id: number): Promise<TMDBMovie> {
    return this.get<TMDBMovie>(`/movie/${id}`);
  }

  // Get TV show external IDs (IMDB, TVDB)
  async getShowExternalIds(id: number): Promise<TMDBExternalIds> {
    return this.get<TMDBExternalIds>(`/tv/${id}/external_ids`);
  }

  // Get poster image URL
  getPosterUrl(posterPath: string, size: 'w500' | 'w780' | 'original' = 'w780'): string {
    return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
  }

  // Download poster image as buffer
  async downloadPoster(posterPath: string, size: 'w500' | 'w780' | 'original' = 'w780'): Promise<Buffer> {
    const url = this.getPosterUrl(posterPath, size);
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  // Find best match for a movie
  async findMovie(title: string, year?: number): Promise<{ movie: TMDBMovie; imdbId: string | null } | null> {
    const results = await this.searchMovie(title, year);
    if (results.length === 0) return null;

    // Get the first result (usually best match)
    const movie = await this.getMovie(results[0].id);
    return {
      movie,
      imdbId: movie.imdb_id || null,
    };
  }

  // Find best match for a TV show
  async findShow(title: string, year?: number): Promise<{ show: TMDBShow; imdbId: string | null } | null> {
    const results = await this.searchShow(title, year);
    if (results.length === 0) return null;

    const show = results[0];
    const externalIds = await this.getShowExternalIds(show.id);
    
    return {
      show,
      imdbId: externalIds.imdb_id,
    };
  }
}
