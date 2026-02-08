#!/usr/bin/env node
import 'dotenv/config';
import { createProcessorFromEnv } from './processor.js';

const COMMANDS = ['scan', 'process', 'help'];

function printHelp() {
  console.log(`
🎬 PosterForge - Movie/TV Poster Rating Overlays

USAGE:
  npm run scan      Scan media folders and list items
  npm run process   Process all items and create rated posters

CONFIGURATION:
  Copy .env.example to .env and configure:
  - TMDB_API_KEY     Your TMDB API key (required)
  - OMDB_API_KEY     Your OMDB API key (required)
  - MEDIA_FOLDERS    Comma-separated paths to media folders
  - POSTER_STYLE     badges | bar | minimal
  - RATINGS          imdb,rt,metacritic (pick up to 3)
  - OVERWRITE        true | false

EXAMPLES:
  # Scan and see what would be processed
  npm run scan

  # Generate all posters
  npm run process
`);
}

async function main() {
  const command = process.argv[2] || 'help';

  if (command === 'help' || !COMMANDS.includes(command)) {
    printHelp();
    return;
  }

  try {
    const processor = createProcessorFromEnv();

    if (command === 'scan') {
      console.log('🔍 Scanning media folders...\n');
      const items = processor.scan();

      const movies = items.filter(i => i.type === 'movie');
      const shows = items.filter(i => i.type === 'show');
      const withPoster = items.filter(i => i.hasPoster);
      const needsProcessing = items.filter(i => !i.hasPoster);

      console.log(`📊 Summary:`);
      console.log(`   Total items:     ${items.length}`);
      console.log(`   Movies:          ${movies.length}`);
      console.log(`   TV Shows:        ${shows.length}`);
      console.log(`   Already done:    ${withPoster.length}`);
      console.log(`   Need processing: ${needsProcessing.length}`);
      console.log('');

      if (items.length > 0) {
        console.log('📁 Items found:');
        for (const item of items.slice(0, 20)) {
          const status = item.hasPoster ? '✅' : '⏳';
          const year = item.year ? ` (${item.year})` : '';
          const type = item.type === 'movie' ? '🎬' : '📺';
          console.log(`   ${status} ${type} ${item.title}${year}`);
        }
        if (items.length > 20) {
          console.log(`   ... and ${items.length - 20} more`);
        }
      }

    } else if (command === 'process') {
      console.log('🎨 Processing media folders...\n');

      const results = await processor.processAll((result, current, total) => {
        const pct = Math.round((current / total) * 100);
        const status = result.success ? '✅' : '❌';
        const type = result.item.type === 'movie' ? '🎬' : '📺';
        console.log(`[${pct}%] ${status} ${type} ${result.item.title} - ${result.message}`);
      });

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log('');
      console.log('📊 Complete:');
      console.log(`   ✅ Successful: ${successful}`);
      console.log(`   ❌ Failed:     ${failed}`);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
