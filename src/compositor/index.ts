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

// Create a single rating badge for the bar style
function createBarBadge(badge: RatingBadge, x: number, barHeight: number): string {
  const { type, value, color } = badge;
  
  const labels: Record<string, string> = {
    imdb: 'IMDb',
    rt: 'RT',
    metacritic: 'META',
    tmdb: 'TMDB',
  };

  const badgeWidth = 70;
  const badgeHeight = barHeight - 10;
  const centerY = barHeight / 2;

  return `
    <g transform="translate(${x}, 5)">
      <!-- Badge background -->
      <rect x="0" y="0" width="${badgeWidth}" height="${badgeHeight}" rx="6" fill="${color}" />
      <!-- Source label -->
      <text x="${badgeWidth/2}" y="${badgeHeight * 0.38}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="bold" fill="rgba(0,0,0,0.8)">${labels[type]}</text>
      <!-- Rating value -->
      <text x="${badgeWidth/2}" y="${badgeHeight * 0.78}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="black">${value}</text>
    </g>
  `;
}

// Create corner badge style
function createCornerBadge(badge: RatingBadge, index: number): string {
  const { type, value, color } = badge;
  
  const labels: Record<string, string> = {
    imdb: 'IMDb',
    rt: 'RT',
    metacritic: 'MC',
    tmdb: 'TMDB',
  };

  const y = 10 + (index * 52);
  
  return `
    <g transform="translate(10, ${y})">
      <rect x="0" y="0" width="95" height="44" rx="8" fill="rgba(0,0,0,0.85)" />
      <rect x="3" y="3" width="38" height="38" rx="6" fill="${color}" />
      <text x="22" y="28" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" fill="rgba(0,0,0,0.9)">${labels[type]}</text>
      <text x="68" y="30" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="white">${value}</text>
    </g>
  `;
}

// Create minimal corner badge
function createMinimalBadge(badge: RatingBadge, index: number): string {
  const { type, value, color } = badge;
  const x = 8 + (index * 38);
  
  return `
    <g transform="translate(${x}, 8)">
      <rect x="0" y="0" width="34" height="26" rx="5" fill="${color}" />
      <text x="17" y="18" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" fill="rgba(0,0,0,0.9)">${value}</text>
    </g>
  `;
}

// Create the black bar overlay with badges
function createBarOverlay(badges: RatingBadge[], width: number, barHeight: number): Buffer {
  const totalBadgeWidth = badges.length * 70 + (badges.length - 1) * 12; // badges + gaps
  const startX = (width - totalBadgeWidth) / 2; // Center the badges
  
  const badgesSVG = badges.map((badge, i) => {
    const x = startX + (i * 82); // 70px badge + 12px gap
    return createBarBadge(badge, x, barHeight);
  }).join('');

  const svg = `
    <svg width="${width}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Gradient black bar for premium look -->
      <defs>
        <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(0,0,0,0.95)" />
          <stop offset="100%" style="stop-color:rgba(0,0,0,0.85)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${barHeight}" fill="url(#barGrad)" />
      ${badgesSVG}
    </svg>
  `;

  return Buffer.from(svg);
}

// Create corner badges overlay
function createCornerOverlay(badges: RatingBadge[], width: number, height: number): Buffer {
  const badgesSVG = badges.map((badge, i) => createCornerBadge(badge, i)).join('');

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${badgesSVG}
    </svg>
  `;

  return Buffer.from(svg);
}

// Create minimal overlay
function createMinimalOverlay(badges: RatingBadge[], width: number, height: number): Buffer {
  const badgesSVG = badges.map((badge, i) => createMinimalBadge(badge, i)).join('');

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
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
      // Clean up RT value
      const rtValue = ratings.rottenTomatoes.replace('%', '');
      badges.push({
        type: 'rt',
        value: `${rtValue}%`,
        color: BADGE_COLORS.rt,
      });
    } else if (type === 'metacritic' && ratings.metacritic) {
      // Clean up metacritic value
      const mcValue = ratings.metacritic.replace('/100', '');
      badges.push({
        type: 'metacritic',
        value: mcValue,
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
    style = 'bar',  // Default to bar style now
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

  // Create overlay based on style
  let composite: sharp.Sharp;
  
  if (style === 'bar') {
    const barHeight = 50;
    const overlaySVG = createBarOverlay(badges, width, barHeight);
    composite = sharp(posterBuffer).composite([
      { input: overlaySVG, top: height - barHeight, left: 0 },
    ]);
  } else if (style === 'minimal') {
    const overlaySVG = createMinimalOverlay(badges, width, height);
    composite = sharp(posterBuffer).composite([
      { input: overlaySVG, top: 0, left: 0 },
    ]);
  } else {
    // badges style - corner badges
    const overlaySVG = createCornerOverlay(badges, width, height);
    composite = sharp(posterBuffer).composite([
      { input: overlaySVG, top: 0, left: 0 },
    ]);
  }

  return composite.jpeg({ quality: 90 }).toBuffer();
}
