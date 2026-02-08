import sharp from 'sharp';
import type { OMDBRatings } from '../api/omdb.js';

export interface RatingBadge {
  type: 'imdb' | 'rt' | 'metacritic' | 'tmdb';
  value: string;
  color: string;
}

const BADGE_COLORS = {
  imdb: '#F5C518',
  rt: '#FA320A',
  metacritic: '#FFCC34',
  tmdb: '#01D277',
};

// Create the full rating bar with all badges properly aligned
function createRatingBar(badges: RatingBadge[], posterWidth: number): Buffer {
  const barHeight = 130; // Much taller bar
  const iconSize = 75;
  const fontSize = 55;
  const gapBetweenRatings = 40;
  const iconTextGap = 14;
  
  // Calculate widths for each rating
  const ratingWidths = badges.map(badge => {
    const textWidth = badge.value.length * (fontSize * 0.58);
    if (badge.type === 'metacritic') {
      // Metacritic shows icon + score text
      return iconSize + iconTextGap + textWidth;
    }
    return iconSize + iconTextGap + textWidth;
  });
  
  const totalWidth = ratingWidths.reduce((a, b) => a + b, 0) + (gapBetweenRatings * (badges.length - 1));
  let currentX = (posterWidth - totalWidth) / 2;
  
  const centerY = barHeight / 2;
  const iconY = centerY - (iconSize / 2);
  const textY = centerY + (fontSize * 0.35);
  
  let svgContent = '';
  
  badges.forEach((badge, i) => {
    if (badge.type === 'imdb') {
      // IMDb: Yellow rounded rectangle with "IMDb" text inside
      svgContent += `
        <g>
          <rect x="${currentX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="8" fill="#F5C518"/>
          <text x="${currentX + iconSize/2}" y="${centerY + 6}" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="18" font-weight="bold" fill="#000000">IMDb</text>
          <text x="${currentX + iconSize + iconTextGap}" y="${textY}" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF">${badge.value}</text>
        </g>
      `;
    } else if (badge.type === 'rt') {
      // Rotten Tomatoes: Tomato icon
      const tomatoX = currentX + iconSize/2;
      const tomatoY = centerY;
      const tomatoR = iconSize * 0.42;
      svgContent += `
        <g>
          <!-- Tomato body -->
          <ellipse cx="${tomatoX}" cy="${tomatoY + 3}" rx="${tomatoR}" ry="${tomatoR * 0.85}" fill="#FA320A"/>
          <!-- Highlight -->
          <ellipse cx="${tomatoX - tomatoR*0.35}" cy="${tomatoY - tomatoR*0.15}" rx="${tomatoR*0.3}" ry="${tomatoR*0.22}" fill="#FF6B4A" opacity="0.7"/>
          <!-- Leaf -->
          <ellipse cx="${tomatoX}" cy="${tomatoY - tomatoR*0.75}" rx="${tomatoR*0.55}" ry="${tomatoR*0.35}" fill="#4CAF50"/>
          <!-- Rating text -->
          <text x="${currentX + iconSize + iconTextGap}" y="${textY}" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF">${badge.value}</text>
        </g>
      `;
    } else if (badge.type === 'metacritic') {
      // Metacritic: Circle logo with "mc" styling + score
      const mcX = currentX + iconSize/2;
      const mcY = centerY;
      const mcR = iconSize * 0.45;
      
      svgContent += `
        <g>
          <!-- Outer yellow circle -->
          <circle cx="${mcX}" cy="${mcY}" r="${mcR}" fill="#FFCC34"/>
          <!-- Inner dark circle -->
          <circle cx="${mcX}" cy="${mcY}" r="${mcR * 0.78}" fill="#333333"/>
          <!-- MC text -->
          <text x="${mcX}" y="${mcY + 7}" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="18" font-weight="bold" fill="#FFCC34">mc</text>
          <!-- Score text -->
          <text x="${currentX + iconSize + iconTextGap}" y="${textY}" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF">${badge.value}</text>
        </g>
      `;
    } else if (badge.type === 'tmdb') {
      // TMDB: Teal/dark circle with TMDB text
      svgContent += `
        <g>
          <circle cx="${currentX + iconSize/2}" cy="${centerY}" r="${iconSize/2}" fill="#0D253F"/>
          <text x="${currentX + iconSize/2}" y="${centerY + 5}" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="14" font-weight="bold" fill="#01D277">TMDB</text>
          <text x="${currentX + iconSize + iconTextGap}" y="${textY}" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF">${badge.value}</text>
        </g>
      `;
    }
    
    currentX += ratingWidths[i] + gapBetweenRatings;
  });

  const svg = `<svg width="${posterWidth}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${posterWidth}" height="${barHeight}" fill="rgba(0,0,0,0.75)"/>
    ${svgContent}
  </svg>`;

  return Buffer.from(svg);
}

// Corner badges overlay
function createCornerOverlay(badges: RatingBadge[], width: number, height: number): Buffer {
  const iconSize = 55;
  const fontSize = 28;
  const padding = 15;
  const gap = 70;
  
  const svgContent = badges.map((badge, i) => {
    const y = padding + (i * gap);
    const centerY = y + iconSize / 2;
    
    let badgeSvg = '';
    const bgWidth = iconSize + 80;
    
    badgeSvg += `<rect x="${padding}" y="${y}" width="${bgWidth}" height="${iconSize}" rx="10" fill="rgba(0,0,0,0.88)"/>`;
    
    if (badge.type === 'imdb') {
      badgeSvg += `
        <rect x="${padding + 5}" y="${y + 5}" width="${iconSize - 10}" height="${iconSize - 10}" rx="6" fill="#F5C518"/>
        <text x="${padding + iconSize/2}" y="${centerY + 5}" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="14" font-weight="bold" fill="#000">IMDb</text>
        <text x="${padding + iconSize + 10}" y="${centerY + 9}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFF">${badge.value}</text>
      `;
    } else if (badge.type === 'rt') {
      const cx = padding + iconSize/2;
      const r = iconSize * 0.38;
      badgeSvg += `
        <ellipse cx="${cx}" cy="${centerY + 2}" rx="${r}" ry="${r * 0.85}" fill="#FA320A"/>
        <ellipse cx="${cx - r*0.3}" cy="${centerY - r*0.2}" rx="${r*0.28}" ry="${r*0.2}" fill="#FF6B4A" opacity="0.7"/>
        <ellipse cx="${cx}" cy="${centerY - r*0.7}" rx="${r*0.5}" ry="${r*0.3}" fill="#4CAF50"/>
        <text x="${padding + iconSize + 10}" y="${centerY + 9}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFF">${badge.value}</text>
      `;
    } else if (badge.type === 'metacritic') {
      const cx = padding + iconSize/2;
      const r = iconSize * 0.4;
      badgeSvg += `
        <circle cx="${cx}" cy="${centerY}" r="${r}" fill="#FFCC34"/>
        <circle cx="${cx}" cy="${centerY}" r="${r * 0.78}" fill="#333"/>
        <text x="${cx}" y="${centerY + 6}" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFCC34">mc</text>
        <text x="${padding + iconSize + 10}" y="${centerY + 9}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFF">${badge.value}</text>
      `;
    }
    
    return badgeSvg;
  }).join('');

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
  return Buffer.from(svg);
}

// Minimal overlay
function createMinimalOverlay(badges: RatingBadge[], width: number, height: number): Buffer {
  const iconSize = 40;
  const padding = 10;
  
  const svgContent = badges.map((badge, i) => {
    const x = padding + (i * (iconSize + 12));
    
    if (badge.type === 'imdb') {
      return `<rect x="${x}" y="${padding}" width="${iconSize}" height="${iconSize}" rx="5" fill="#F5C518"/><text x="${x + iconSize/2}" y="${padding + iconSize/2 + 5}" text-anchor="middle" font-size="12" font-weight="bold" fill="#000">IMDb</text>`;
    } else if (badge.type === 'metacritic') {
      return `<circle cx="${x + iconSize/2}" cy="${padding + iconSize/2}" r="${iconSize/2}" fill="#FFCC34"/><circle cx="${x + iconSize/2}" cy="${padding + iconSize/2}" r="${iconSize/2 * 0.78}" fill="#333"/><text x="${x + iconSize/2}" y="${padding + iconSize/2 + 5}" text-anchor="middle" font-size="12" font-weight="bold" fill="#FFCC34">mc</text>`;
    } else if (badge.type === 'rt') {
      return `<ellipse cx="${x + iconSize/2}" cy="${padding + iconSize/2}" rx="${iconSize*0.4}" ry="${iconSize*0.35}" fill="#FA320A"/>`;
    }
    return '';
  }).join('');

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
  return Buffer.from(svg);
}

// Convert ratings to badges
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
        value: rtValue + '%',
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

// Main export
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
  const barHeight = 130;
  
  if (style === 'bar') {
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
