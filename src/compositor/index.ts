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
  metacritic: '#66CC33',
  tmdb: '#01D277',
};

// Create the full rating bar with all badges properly aligned
function createRatingBar(badges: RatingBadge[], posterWidth: number): Buffer {
  const barHeight = 70;
  const iconSize = 40;
  const fontSize = 28;
  const gapBetweenRatings = 30;
  const iconTextGap = 10;
  
  // Calculate widths for each rating
  const ratingWidths = badges.map(badge => {
    const textWidth = badge.value.length * (fontSize * 0.6);
    if (badge.type === 'metacritic') {
      // Metacritic is just a colored box with score inside
      return iconSize + 5;
    }
    return iconSize + iconTextGap + textWidth;
  });
  
  const totalWidth = ratingWidths.reduce((a, b) => a + b, 0) + (gapBetweenRatings * (badges.length - 1));
  let currentX = (posterWidth - totalWidth) / 2;
  
  const centerY = barHeight / 2;
  const iconY = centerY - (iconSize / 2);
  const textY = centerY + (fontSize * 0.35); // Vertically center text
  
  let svgContent = '';
  
  badges.forEach((badge, i) => {
    if (badge.type === 'imdb') {
      // IMDb: Yellow rounded rectangle with "IMDb" text inside
      svgContent += `
        <g>
          <rect x="${currentX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="6" fill="#F5C518"/>
          <text x="${currentX + iconSize/2}" y="${centerY + 5}" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="14" font-weight="bold" fill="#000000">IMDb</text>
          <text x="${currentX + iconSize + iconTextGap}" y="${textY}" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF">${badge.value}</text>
        </g>
      `;
    } else if (badge.type === 'rt') {
      // Rotten Tomatoes: Tomato icon
      const tomatoX = currentX + iconSize/2;
      const tomatoY = centerY;
      const tomatoR = iconSize * 0.45;
      svgContent += `
        <g>
          <!-- Tomato body -->
          <ellipse cx="${tomatoX}" cy="${tomatoY + 2}" rx="${tomatoR}" ry="${tomatoR * 0.9}" fill="#FA320A"/>
          <!-- Highlight -->
          <ellipse cx="${tomatoX - tomatoR*0.3}" cy="${tomatoY - tomatoR*0.2}" rx="${tomatoR*0.35}" ry="${tomatoR*0.25}" fill="#FF6347" opacity="0.6"/>
          <!-- Leaf -->
          <ellipse cx="${tomatoX}" cy="${tomatoY - tomatoR*0.7}" rx="${tomatoR*0.5}" ry="${tomatoR*0.3}" fill="#228B22"/>
          <!-- Rating text -->
          <text x="${currentX + iconSize + iconTextGap}" y="${textY}" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF">${badge.value}</text>
        </g>
      `;
    } else if (badge.type === 'metacritic') {
      // Metacritic: Colored square with score inside (color based on score)
      const score = parseInt(badge.value) || 0;
      let bgColor = '#66CC33'; // Green 61+
      if (score < 40) bgColor = '#FF0000'; // Red <40
      else if (score < 61) bgColor = '#FFCC33'; // Yellow 40-60
      
      svgContent += `
        <g>
          <rect x="${currentX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="4" fill="${bgColor}"/>
          <text x="${currentX + iconSize/2}" y="${centerY + fontSize*0.3}" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="${fontSize * 0.85}" font-weight="bold" fill="#FFFFFF">${badge.value}</text>
        </g>
      `;
    } else if (badge.type === 'tmdb') {
      // TMDB: Teal circle with score
      svgContent += `
        <g>
          <circle cx="${currentX + iconSize/2}" cy="${centerY}" r="${iconSize/2}" fill="#0D253F"/>
          <text x="${currentX + iconSize/2}" y="${centerY + 4}" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="11" font-weight="bold" fill="#01D277">TMDB</text>
          <text x="${currentX + iconSize + iconTextGap}" y="${textY}" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF">${badge.value}</text>
        </g>
      `;
    }
    
    currentX += ratingWidths[i] + gapBetweenRatings;
  });

  const svg = `<svg width="${posterWidth}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${posterWidth}" height="${barHeight}" fill="rgba(0,0,0,0.9)"/>
    ${svgContent}
  </svg>`;

  return Buffer.from(svg);
}

// Corner badges overlay
function createCornerOverlay(badges: RatingBadge[], width: number, height: number): Buffer {
  const iconSize = 45;
  const fontSize = 22;
  const padding = 12;
  const gap = 55;
  
  const svgContent = badges.map((badge, i) => {
    const y = padding + (i * gap);
    const centerY = y + iconSize / 2;
    
    let badgeSvg = '';
    const bgWidth = iconSize + 60;
    
    badgeSvg += `<rect x="${padding}" y="${y}" width="${bgWidth}" height="${iconSize}" rx="8" fill="rgba(0,0,0,0.85)"/>`;
    
    if (badge.type === 'imdb') {
      badgeSvg += `
        <rect x="${padding + 4}" y="${y + 4}" width="${iconSize - 8}" height="${iconSize - 8}" rx="4" fill="#F5C518"/>
        <text x="${padding + iconSize/2}" y="${centerY + 4}" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="11" font-weight="bold" fill="#000">IMDb</text>
        <text x="${padding + iconSize + 8}" y="${centerY + 7}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFF">${badge.value}</text>
      `;
    } else if (badge.type === 'rt') {
      const cx = padding + iconSize/2;
      badgeSvg += `
        <ellipse cx="${cx}" cy="${centerY + 2}" rx="16" ry="14" fill="#FA320A"/>
        <ellipse cx="${cx - 5}" cy="${centerY - 3}" rx="5" ry="4" fill="#FF6347" opacity="0.6"/>
        <ellipse cx="${cx}" cy="${centerY - 12}" rx="8" ry="5" fill="#228B22"/>
        <text x="${padding + iconSize + 8}" y="${centerY + 7}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFF">${badge.value}</text>
      `;
    } else if (badge.type === 'metacritic') {
      const score = parseInt(badge.value) || 0;
      let bgColor = '#66CC33';
      if (score < 40) bgColor = '#FF0000';
      else if (score < 61) bgColor = '#FFCC33';
      badgeSvg += `
        <rect x="${padding + 4}" y="${y + 4}" width="${iconSize - 8}" height="${iconSize - 8}" rx="4" fill="${bgColor}"/>
        <text x="${padding + iconSize/2}" y="${centerY + 7}" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#FFF">${badge.value}</text>
      `;
    }
    
    return badgeSvg;
  }).join('');

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
  return Buffer.from(svg);
}

// Minimal overlay
function createMinimalOverlay(badges: RatingBadge[], width: number, height: number): Buffer {
  const iconSize = 32;
  const padding = 8;
  
  const svgContent = badges.map((badge, i) => {
    const x = padding + (i * (iconSize + 8));
    const score = parseInt(badge.value) || 0;
    
    if (badge.type === 'imdb') {
      return `<rect x="${x}" y="${padding}" width="${iconSize}" height="${iconSize}" rx="4" fill="#F5C518"/><text x="${x + iconSize/2}" y="${padding + iconSize/2 + 4}" text-anchor="middle" font-size="10" font-weight="bold" fill="#000">IMDb</text>`;
    } else if (badge.type === 'metacritic') {
      let bgColor = score >= 61 ? '#66CC33' : score >= 40 ? '#FFCC33' : '#FF0000';
      return `<rect x="${x}" y="${padding}" width="${iconSize}" height="${iconSize}" rx="4" fill="${bgColor}"/><text x="${x + iconSize/2}" y="${padding + iconSize/2 + 6}" text-anchor="middle" font-size="14" font-weight="bold" fill="#FFF">${badge.value}</text>`;
    } else if (badge.type === 'rt') {
      return `<ellipse cx="${x + iconSize/2}" cy="${padding + iconSize/2}" rx="14" ry="12" fill="#FA320A"/>`;
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
  const barHeight = 70;
  
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
