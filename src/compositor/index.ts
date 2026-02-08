import sharp from 'sharp';
import type { OMDBRatings } from '../api/omdb.js';

export interface RatingBadge {
  type: 'imdb' | 'rt' | 'metacritic' | 'tmdb';
  value: string;
  color: string;
}

// Rating badge colors
const BADGE_COLORS = {
  imdb: '#F5C518',      // IMDB yellow
  rt: '#FA320A',        // Rotten Tomatoes red
  metacritic: '#66CC33', // Metacritic green
  tmdb: '#01D277',      // TMDB green
};

// Create an SVG rating badge
function createBadgeSVG(badge: RatingBadge, index: number, style: 'badges' | 'bar' | 'minimal'): string {
  const { type, value, color } = badge;
  
  // Icon paths for each rating source
  const icons: Record<string, string> = {
    imdb: 'M5.5 2h3v12h-3V2zm5 0h3v12h-3V2z', // Simplified IMDB bars
    rt: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z', // Tomato circle
    metacritic: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z', // Circle
    tmdb: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z', // Circle
  };

  const labels: Record<string, string> = {
    imdb: 'IMDb',
    rt: 'RT',
    metacritic: 'MC',
    tmdb: 'TMDB',
  };

  if (style === 'badges') {
    // Corner badge style
    const y = 10 + (index * 50);
    return `
      <g transform="translate(10, ${y})">
        <rect x="0" y="0" width="90" height="40" rx="6" fill="rgba(0,0,0,0.85)" />
        <rect x="2" y="2" width="36" height="36" rx="4" fill="${color}" />
        <text x="20" y="27" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="black">${labels[type]}</text>
        <text x="62" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white">${value}</text>
      </g>
    `;
  } else if (style === 'minimal') {
    // Small corner dots
    const x = 10 + (index * 35);
    return `
      <g transform="translate(${x}, 10)">
        <rect x="0" y="0" width="30" height="24" rx="4" fill="${color}" />
        <text x="15" y="17" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="black">${value}</text>
      </g>
    `;
  } else {
    // Bar style at bottom
    const x = 10 + (index * 80);
    return `
      <g transform="translate(${x}, 0)">
        <rect x="0" y="0" width="70" height="30" rx="4" fill="${color}" />
        <text x="35" y="12" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="black">${labels[type]}</text>
        <text x="35" y="24" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="black">${value}</text>
      </g>
    `;
  }
}

// Create full overlay SVG
function createOverlaySVG(
  badges: RatingBadge[], 
  width: number, 
  height: number, 
  style: 'badges' | 'bar' | 'minimal'
): Buffer {
  let badgesSVG = '';
  let overlayHeight = height;
  let overlayY = 0;

  if (style === 'bar') {
    // Bottom bar
    overlayHeight = 40;
    overlayY = height - overlayHeight;
    badgesSVG = `
      <rect x="0" y="0" width="${width}" height="${overlayHeight}" fill="rgba(0,0,0,0.85)" />
      ${badges.map((b, i) => createBadgeSVG(b, i, style)).join('')}
    `;
  } else {
    badgesSVG = badges.map((b, i) => createBadgeSVG(b, i, style)).join('');
  }

  const svg = `
    <svg width="${width}" height="${style === 'bar' ? overlayHeight : height}" xmlns="http://www.w3.org/2000/svg">
      ${badgesSVG}
    </svg>
  `;

  return Buffer.from(svg);
}

// Convert ratings to badge format
export function ratingsTooBadges(
  ratings: OMDBRatings, 
  tmdbRating?: number,
  showRatings: string[] = ['imdb', 'rt', 'metacritic']
): RatingBadge[] {
  const badges: RatingBadge[] = [];

  for (const type of showRatings) {
    if (badges.length >= 3) break; // Max 3 badges

    if (type === 'imdb' && ratings.imdb) {
      badges.push({
        type: 'imdb',
        value: ratings.imdb.rating,
        color: BADGE_COLORS.imdb,
      });
    } else if (type === 'rt' && ratings.rottenTomatoes) {
      badges.push({
        type: 'rt',
        value: `${ratings.rottenTomatoes}%`,
        color: BADGE_COLORS.rt,
      });
    } else if (type === 'metacritic' && ratings.metacritic) {
      badges.push({
        type: 'metacritic',
        value: ratings.metacritic,
        color: BADGE_COLORS.metacritic,
      });
    } else if (type === 'tmdb' && tmdbRating && tmdbRating > 0) {
      badges.push({
        type: 'tmdb',
        value: tmdbRating.toFixed(1),
        color: BADGE_COLORS.tmdb,
      });
    }
  }

  return badges;
}

// Composite poster with rating badges
export async function createRatedPoster(
  posterBuffer: Buffer,
  ratings: OMDBRatings,
  options: {
    tmdbRating?: number;
    style?: 'badges' | 'bar' | 'minimal';
    showRatings?: string[];
  } = {}
): Promise<Buffer> {
  const { 
    tmdbRating, 
    style = 'badges', 
    showRatings = ['imdb', 'rt', 'metacritic'] 
  } = options;

  // Get poster dimensions
  const metadata = await sharp(posterBuffer).metadata();
  const width = metadata.width || 780;
  const height = metadata.height || 1170;

  // Create badges
  const badges = ratingsTooBadges(ratings, tmdbRating, showRatings);
  
  if (badges.length === 0) {
    // No ratings to show, return original
    return posterBuffer;
  }

  // Create overlay SVG
  const overlaySVG = createOverlaySVG(badges, width, height, style);

  // Composite overlay onto poster
  let composite: sharp.Sharp;
  
  if (style === 'bar') {
    // Bar goes at bottom
    composite = sharp(posterBuffer).composite([
      { input: overlaySVG, top: height - 40, left: 0 },
    ]);
  } else {
    // Badges go at top-left
    composite = sharp(posterBuffer).composite([
      { input: overlaySVG, top: 0, left: 0 },
    ]);
  }

  return composite.jpeg({ quality: 90 }).toBuffer();
}
