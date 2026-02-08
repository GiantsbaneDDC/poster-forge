import axios from 'axios';

const OMDB_BASE = 'https://www.omdbapi.com';

export interface OMDBRatings {
  imdb: { rating: string; votes: string } | null;
  rottenTomatoes: string | null;
  metacritic: string | null;
}

export interface OMDBResponse {
  Title: string;
  Year: string;
  imdbRating: string;
  imdbVotes: string;
  Metascore: string;
  Ratings: Array<{ Source: string; Value: string }>;
  Response: string;
  Error?: string;
}

export class OMDBClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Get ratings by IMDB ID
  async getRatings(imdbId: string): Promise<OMDBRatings | null> {
    try {
      const response = await axios.get<OMDBResponse>(OMDB_BASE, {
        params: {
          apikey: this.apiKey,
          i: imdbId,
        },
      });

      if (response.data.Response === 'False') {
        console.warn(`OMDB: ${response.data.Error} for ${imdbId}`);
        return null;
      }

      const data = response.data;
      
      // Extract Rotten Tomatoes from Ratings array
      const rtRating = data.Ratings?.find(r => r.Source === 'Rotten Tomatoes');
      
      return {
        imdb: data.imdbRating && data.imdbRating !== 'N/A' 
          ? { rating: data.imdbRating, votes: data.imdbVotes } 
          : null,
        rottenTomatoes: rtRating?.Value?.replace('%', '') || null,
        metacritic: data.Metascore && data.Metascore !== 'N/A' ? data.Metascore : null,
      };
    } catch (error) {
      console.error(`OMDB error for ${imdbId}:`, error);
      return null;
    }
  }

  // Search by title (fallback if no IMDB ID)
  async searchByTitle(title: string, year?: number): Promise<OMDBRatings | null> {
    try {
      const params: Record<string, string> = {
        apikey: this.apiKey,
        t: title,
      };
      if (year) params.y = year.toString();

      const response = await axios.get<OMDBResponse>(OMDB_BASE, { params });

      if (response.data.Response === 'False') {
        return null;
      }

      const data = response.data;
      const rtRating = data.Ratings?.find(r => r.Source === 'Rotten Tomatoes');
      
      return {
        imdb: data.imdbRating && data.imdbRating !== 'N/A' 
          ? { rating: data.imdbRating, votes: data.imdbVotes } 
          : null,
        rottenTomatoes: rtRating?.Value?.replace('%', '') || null,
        metacritic: data.Metascore && data.Metascore !== 'N/A' ? data.Metascore : null,
      };
    } catch (error) {
      console.error(`OMDB search error for ${title}:`, error);
      return null;
    }
  }
}
