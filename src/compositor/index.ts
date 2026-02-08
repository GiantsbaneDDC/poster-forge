import sharp from 'sharp';
import type { OMDBRatings } from '../api/omdb.js';

export interface RatingBadge {
  type: 'imdb' | 'rt' | 'metacritic' | 'tmdb';
  value: string;
  color: string;
}

// Rating badge colors
const BADGE_COLORS = {
  imdb: '#F5C518',
  rt: '#FA320A',
  metacritic: '#FFCC34',
  tmdb: '#01D277',
};

// Actual IMDb logo SVG (yellow rounded rectangle with IMDb text)
function createIMDbIcon(x: number, y: number, size: number): string {
  const scale = size / 48;
  return `
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <rect x="0" y="4" width="48" height="40" rx="6" fill="#F5C518"/>
      <text x="24" y="33" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="22" font-weight="bold" fill="#000000">IMDb</text>
    </g>
  `;
}

// Rotten Tomatoes fresh tomato logo
function createRTIcon(x: number, y: number, size: number): string {
  const scale = size / 48;
  return `
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <!-- Tomato body -->
      <ellipse cx="24" cy="28" rx="20" ry="18" fill="#FA320A"/>
      <!-- Highlight -->
      <ellipse cx="16" cy="22" rx="8" ry="6" fill="#FF6B4A" opacity="0.7"/>
      <!-- Stem -->
      <path d="M24 10 L24 14" stroke="#4A7C20" stroke-width="3" stroke-linecap="round"/>
      <!-- Leaf left -->
      <path d="M24 12 Q16 4 10 8 Q14 14 24 12" fill="#4CAF50"/>
      <!-- Leaf right -->
      <path d="M24 12 Q32 4 38 8 Q34 14 24 12" fill="#388E3C"/>
    </g>
  `;
}

// Metacritic logo (square with score styling)
function createMetacriticIcon(x: number, y: number, size: number, score: string): string {
  const scale = size / 48;
  // Determine color based on score
  const numScore = parseInt(score) || 0;
  let bgColor = '#6c3';  // Green for 61+
  if (numScore < 40) bgColor = '#f00';  // Red for <40
  else if (numScore < 61) bgColor = '#fc3';  // Yellow for 40-60
  
  return `
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <rect x="0" y="4" width="44" height="40" rx="4" fill="${bgColor}"/>
      <text x="22" y="33" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="bold" fill="#FFFFFF">${score}</text>
    </g>
  `;
}

// TMDB logo
function createTMDBIcon(x: number, y: number, size: number): string {
  const scale = size / 48;
  return `
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <rect x="0" y="4" width="48" height="40" rx="6" fill="#0D253F"/>
      <text x="24" y="30" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="#01D277">TMDB</text>
    </g>
  `;
}

// Create a rating entry with icon + value
function createRatingEntry(badge: RatingBadge, x: number, barHeight: number): { svg: string; width: number } {
  const iconSize = barHeight - 12;
  const iconY = 6;
  const textY = barHeight / 2 + 10;
  const fontSize = Math.floor(barHeight * 0.55);
  
  let iconSvg = '';
  let iconWidth = iconSize;
  
  switch (badge.type) {
    case 'imdb':
      iconSvg = createIMDbIcon(x, iconY, iconSize);
      iconWidth = iconSize;
      break;
    case 'rt':
      iconSvg = createRTIcon(x, iconY, iconSize);
      iconWidth = iconSize;
      break;
    case 'metacritic':
      // For metacritic, the icon IS the score
      iconSvg = createMetacriticIcon(x, iconY, iconSize, badge.value);
      // No separate text needed
      return { svg: iconSvg, width: iconSize + 10 };
    case 'tmdb':
      iconSvg = createTMDBIcon(x, iconY, iconSize);
      iconWidth = iconSize;
      break;
  }
  
  // Add rating value text next to icon
  const textX = x + iconWidth + 8;
  const textSvg = `<text x="${textX}" y="${textY}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF">${badge.value}</text>`;
  
  // Estimate text width
  const textWidth = badge.value.length * (fontSize * 0.6);
  
  return { 
    svg: iconSvg + textSvg, 
    width: iconWidth + 8 + textWidth 
  };
}

// Create the rating bar overlay
function createRatingBar(badges: RatingBadge[], posterWidth: number): Buffer {
  const barHeight = 60; // Much bigger bar
  const padding = 20;
  const gapBetweenBadges = 35;
  
  // First pass: calculate total width
  let testX = 0;
  const widths: number[] = [];
  badges.forEach(badge => {
    const entry = createRatingEntry(badge, testX, barHeight);
    widths.push(entry.width);
    testX += entry.width + gapBetweenBadges;
  });
  
  const totalWidth = widths.reduce((a, b) => a + b, 0) + (gapBetweenBadges * (badges.length - 1));
  
  // Second pass: create SVG with centered badges
  let currentX = (posterWidth - totalWidth) / 2;
  const badgesSVG = badges.map((badge, i) => {
    const entry = createRatingEntry(badge, currentX, barHeight);
    currentX += widths[i] + gapBetweenBadges;
    return entry.svg;
  }).join('');

  const svg = `
    <svg width="${posterWidth}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Dark semi-transparent bar -->
      <rect x="0" y="0" width="${posterWidth}" height="${barHeight}" fill="rgba(0,0,0,0.9)"/>
      ${badgesSVG}
    </svg>
  `;

  return Buffer.from(svg);
}

// Corner badges style
function createCornerOverlay(badges: RatingBadge[], width: number, height: number): Buffer {
  const badgeSize = 50;
  const padding = 15;
  const gap = 60;
  
  const badgesSVG = badges.map((badge, i) => {
    const y = padding + (i * gap);
    let iconSvg = '';
    
    switch (badge.type) {
      case 'imdb':
        iconSvg = createIMDbIcon(padding, y, badgeSize);
        break;
      case 'rt':
        iconSvg = createRTIcon(padding, y, badgeSize);
        break;
      case 'metacritic':
        iconSvg = createMetacriticIcon(padding, y, badgeSize, badge.value);
        return iconSvg; // Metacritic has score in icon
      case 'tmdb':
        iconSvg = createTMDBIcon(padding, y, badgeSize);
        break;
    }
    
    // Add value text
    const textX = padding + badgeSize + 10;
    const textY = y + badgeSize / 2 + 8;
    const textSvg = `
      <rect x="${padding - 5}" y="${y}" width="${badgeSize + 70}" height="${badgeSize}" rx="8" fill="rgba(0,0,0,0.8)"/>
      ${iconSvg}
      <text x="${textX}" y="${textY}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="bold" fill="#FFFFFF">${badge.value}</text>
    `;
    
    return textSvg;
  }).join('');

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${badgesSVG}
    </svg>
  `;

  return Buffer.from(svg);
}

// Minimal style
function createMinimalOverlay(badges: RatingBadge[], width: number, height: number): Buffer {
  const badgeSize = 35;
  const padding = 10;
  
  const badgesSVG = badges.map((badge, i) => {
    const x = padding + (i * (badgeSize + 10));
    switch (badge.type) {
      case 'imdb':
        return createIMDbIcon(x, padding, badgeSize);
      case 'rt':
        return createRTIcon(x, padding, badgeSize);
      case 'metacritic':
        return createMetacriticIcon(x, padding, badgeSize, badge.value);
      case 'tmdb':
        return createTMDBIcon(x, padding, badgeSize);
      default:
        return '';
    }
  }).join('');

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
    if (badges.length >= 3) break;

    if (type === 'imdb' && ratings.imdb) {
      badges.push({
        type: 'imdb',
        value: ratings.imdb.rating + '/10',
        color: BADGE_COLORS.imdb,
      });
    } else if (type === 'rt' && ratings.rottenTomatoes) {
      const rtValue = ratings.rottenTomatoes.replace('%', '');
      badges.push({
        type: 'rt',
        value: `${rtValue}%`,
        color: BADGE_COLORS.rt,
      });
    } else if (type === 'metacritic' && ratings.metacritic) {
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

// Main export: Create rated poster
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
    style = 'bar',
    showRatings = ['imdb', 'rt', 'metacritic'] 
  } = options;

  const metadata = await sharp(posterBuffer).metadata();
  const width = metadata.width || 780;
  const height = metadata.height || 1170;

  const badges = ratingsTooBadges(ratings, tmdbRating, showRatings);
  
  if (badges.length === 0) {
    return posterBuffer;
  }

  let composite: sharp.Sharp;
  
  if (style === 'bar') {
    const barHeight = 60;
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
    const overlaySVG = createCornerOverlay(badges, width, height);
    composite = sharp(posterBuffer).composite([
      { input: overlaySVG, top: 0, left: 0 },
    ]);
  }

  return composite.jpeg({ quality: 90 }).toBuffer();
}
