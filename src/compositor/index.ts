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

// Create IMDb logo badge (yellow rectangle with IMDb text)
function createIMDbBadge(x: number, value: string): string {
  return `
    <g transform="translate(${x}, 0)">
      <!-- IMDb yellow badge -->
      <rect x="0" y="6" width="42" height="20" rx="3" fill="${BADGE_COLORS.imdb}" />
      <text x="21" y="21" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="13" font-weight="bold" fill="black">IMDb</text>
      <!-- Rating value -->
      <text x="52" y="22" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="white">${value}</text>
    </g>
  `;
}

// Create Rotten Tomatoes badge (tomato icon + percentage)
function createRTBadge(x: number, value: string): string {
  // Fresh tomato icon as SVG path
  return `
    <g transform="translate(${x}, 0)">
      <!-- Tomato icon -->
      <g transform="translate(0, 4) scale(0.85)">
        <!-- Tomato body -->
        <ellipse cx="14" cy="16" rx="12" ry="11" fill="#FA320A" />
        <!-- Tomato highlight -->
        <ellipse cx="10" cy="13" rx="4" ry="3" fill="#FF6347" opacity="0.6" />
        <!-- Leaf -->
        <path d="M14 5 Q12 2 8 3 Q10 6 14 5" fill="#4CAF50" />
        <path d="M14 5 Q16 2 20 3 Q18 6 14 5" fill="#388E3C" />
      </g>
      <!-- Percentage value -->
      <text x="34" y="22" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="white">${value}</text>
    </g>
  `;
}

// Create Metacritic badge (green M circle + score)
function createMetacriticBadge(x: number, value: string): string {
  return `
    <g transform="translate(${x}, 0)">
      <!-- Green circle with M -->
      <circle cx="14" cy="16" r="12" fill="${BADGE_COLORS.metacritic}" />
      <text x="14" y="21" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="white">M</text>
      <!-- Score value -->
      <text x="34" y="22" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="white">${value}</text>
    </g>
  `;
}

// Create TMDB badge (green circle + score)
function createTMDBBadge(x: number, value: string): string {
  return `
    <g transform="translate(${x}, 0)">
      <!-- TMDB circle -->
      <circle cx="14" cy="16" r="12" fill="${BADGE_COLORS.tmdb}" />
      <text x="14" y="20" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="8" font-weight="bold" fill="white">TMDB</text>
      <!-- Score value -->
      <text x="34" y="22" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="white">${value}</text>
    </g>
  `;
}

// Get badge width for layout calculation
function getBadgeWidth(badge: RatingBadge): number {
  const valueLength = badge.value.length;
  const baseWidth = badge.type === 'imdb' ? 52 : 34; // IMDb badge is wider
  return baseWidth + (valueLength * 9); // Approximate text width
}

// Create the inline rating bar
function createRatingBar(badges: RatingBadge[], posterWidth: number): Buffer {
  const barHeight = 32;
  const padding = 15;
  const gapBetweenBadges = 20;
  
  // Calculate total width needed
  let totalWidth = 0;
  badges.forEach((badge, i) => {
    totalWidth += getBadgeWidth(badge);
    if (i < badges.length - 1) totalWidth += gapBetweenBadges;
  });
  
  // Center the badges
  let currentX = (posterWidth - totalWidth) / 2;
  
  const badgesSVG = badges.map((badge, i) => {
    const x = currentX;
    currentX += getBadgeWidth(badge) + gapBetweenBadges;
    
    switch (badge.type) {
      case 'imdb':
        return createIMDbBadge(x, badge.value);
      case 'rt':
        return createRTBadge(x, badge.value);
      case 'metacritic':
        return createMetacriticBadge(x, badge.value);
      case 'tmdb':
        return createTMDBBadge(x, badge.value);
      default:
        return '';
    }
  }).join('');

  const svg = `
    <svg width="${posterWidth}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Semi-transparent black bar -->
      <rect x="0" y="0" width="${posterWidth}" height="${barHeight}" fill="rgba(0,0,0,0.85)" />
      ${badgesSVG}
    </svg>
  `;

  return Buffer.from(svg);
}

// Create corner badge style (fallback)
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

// Create minimal corner badge
function createMinimalBadge(badge: RatingBadge, index: number): string {
  const { value, color } = badge;
  const x = 8 + (index * 38);
  
  return `
    <g transform="translate(${x}, 8)">
      <rect x="0" y="0" width="34" height="26" rx="5" fill="${color}" />
      <text x="17" y="18" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" fill="rgba(0,0,0,0.9)">${value}</text>
    </g>
  `;
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
        value: ratings.imdb.rating + '/10',
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
    style = 'bar',  // Default to bar style
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
    const barHeight = 32;
    const overlaySVG = createRatingBar(badges, width);
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
