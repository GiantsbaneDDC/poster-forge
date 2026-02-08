#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createProcessorFromEnv, PosterProcessor, ProcessorConfig } from './processor.js';
import { parseFolderName, detectMediaType } from './scanner/index.js';

const COMMANDS = ['scan', 'process', 'test', 'dry-run', 'single', 'help'];

function printHelp() {
  console.log(`
🎬 PosterForge - Movie/TV Poster Rating Overlays

USAGE:
  npm run scan       Scan media folders and list items
  npm run dry-run    Show what WOULD be processed (no changes)
  npm run test       Process ONE item as a test
  npm run process    Process all items and create rated posters

SINGLE ITEM:
  npm run single "/path/to/Movie Folder (2020)"

CONFIGURATION:
  Copy .env.example to .env and configure:
  - TMDB_API_KEY     Your TMDB API key (required)
  - OMDB_API_KEY     Your OMDB API key (required)
  - MEDIA_FOLDERS    Comma-separated paths to media folders
  - POSTER_STYLE     badges | bar | minimal
  - RATINGS          imdb,rt,metacritic (pick up to 3)
  - OVERWRITE        true | false (default: false)

SAFETY:
  - OVERWRITE=false means existing poster.jpg files are SKIPPED
  - Use 'dry-run' to preview before processing
  - Use 'test' to process just one item first
  - Use 'single' to test a specific folder
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
      console.log(`   ✅ Already done: ${withPoster.length} (will be SKIPPED)`);
      console.log(`   ⏳ Need processing: ${needsProcessing.length}`);
      console.log('');

      if (needsProcessing.length > 0) {
        console.log('📁 Items that WILL be processed:');
        for (const item of needsProcessing.slice(0, 20)) {
          const year = item.year ? ` (${item.year})` : '';
          const type = item.type === 'movie' ? '🎬' : '📺';
          console.log(`   ⏳ ${type} ${item.title}${year}`);
        }
        if (needsProcessing.length > 20) {
          console.log(`   ... and ${needsProcessing.length - 20} more`);
        }
      }

      if (withPoster.length > 0 && withPoster.length <= 10) {
        console.log('\n📁 Items that will be SKIPPED (already have poster.jpg):');
        for (const item of withPoster) {
          const year = item.year ? ` (${item.year})` : '';
          const type = item.type === 'movie' ? '🎬' : '📺';
          console.log(`   ✅ ${type} ${item.title}${year}`);
        }
      }

    } else if (command === 'dry-run') {
      console.log('🔍 DRY RUN - No changes will be made\n');
      const items = processor.scan();
      const needsProcessing = items.filter(i => !i.hasPoster);

      console.log(`Would process ${needsProcessing.length} items:\n`);
      
      for (const item of needsProcessing) {
        const year = item.year ? ` (${item.year})` : '';
        const type = item.type === 'movie' ? '🎬' : '📺';
        const posterPath = path.join(item.folderPath, 'poster.jpg');
        console.log(`   ${type} ${item.title}${year}`);
        console.log(`      → Would create: ${posterPath}`);
      }

      console.log(`\n✅ No changes made. Run 'npm run process' to actually create posters.`);

    } else if (command === 'test') {
      console.log('🧪 TEST MODE - Processing ONE item only\n');
      const items = processor.scan().filter(i => !i.hasPoster);

      if (items.length === 0) {
        console.log('No items need processing!');
        return;
      }

      const testItem = items[0];
      console.log(`Testing with: ${testItem.title} (${testItem.year || 'unknown year'})`);
      console.log(`Folder: ${testItem.folderPath}`);
      console.log(`Type: ${testItem.type}\n`);

      const result = await processor.processItem(testItem);
      
      if (result.success) {
        console.log(`\n✅ SUCCESS: ${result.message}`);
        console.log(`   Created: ${result.posterPath}`);
        console.log(`\n👀 Check the poster at: ${result.posterPath}`);
        console.log(`   If it looks good, run 'npm run process' for all items.`);
      } else {
        console.log(`\n❌ FAILED: ${result.message}`);
      }

    } else if (command === 'single') {
      const folderPath = process.argv[3];
      if (!folderPath) {
        console.log('Usage: npm run single "/path/to/Movie Folder (2020)"');
        return;
      }

      if (!fs.existsSync(folderPath)) {
        console.log(`❌ Folder not found: ${folderPath}`);
        return;
      }

      const folderName = path.basename(folderPath);
      const parsed = parseFolderName(folderName);
      const type = detectMediaType(folderPath);
      const posterPath = path.join(folderPath, 'poster.jpg');

      console.log(`🎯 Processing single folder:\n`);
      console.log(`   Path:  ${folderPath}`);
      console.log(`   Title: ${parsed.title}`);
      console.log(`   Year:  ${parsed.year || 'unknown'}`);
      console.log(`   Type:  ${type}`);
      console.log(`   Has poster: ${fs.existsSync(posterPath)}\n`);

      const item = {
        folderPath,
        folderName,
        title: parsed.title,
        year: parsed.year,
        type,
        imdbId: parsed.imdbId,
        tmdbId: parsed.tmdbId,
        tvdbId: parsed.tvdbId,
        hasPoster: fs.existsSync(posterPath),
      };

      const result = await processor.processItem(item);
      
      if (result.success) {
        console.log(`✅ SUCCESS: ${result.message}`);
        console.log(`   Created: ${result.posterPath}`);
      } else {
        console.log(`❌ FAILED: ${result.message}`);
      }

    } else if (command === 'process') {
      const items = processor.scan();
      const needsProcessing = items.filter(i => !i.hasPoster);

      console.log(`🎨 Processing ${needsProcessing.length} items (skipping ${items.length - needsProcessing.length} with existing posters)\n`);

      if (needsProcessing.length === 0) {
        console.log('✅ Nothing to process - all items already have posters!');
        return;
      }

      // Confirmation
      console.log('⚠️  This will create poster.jpg files in your media folders.');
      console.log('    Existing poster.jpg files will NOT be overwritten.\n');

      const results = await processor.processAll((result, current, total) => {
        const pct = Math.round((current / total) * 100);
        const status = result.success ? '✅' : '❌';
        const type = result.item.type === 'movie' ? '🎬' : '📺';
        console.log(`[${pct.toString().padStart(3)}%] ${status} ${type} ${result.item.title} - ${result.message}`);
      });

      const successful = results.filter(r => r.success && r.message !== 'Skipped (poster exists)').length;
      const skipped = results.filter(r => r.message === 'Skipped (poster exists)').length;
      const failed = results.filter(r => !r.success).length;

      console.log('\n📊 Complete:');
      console.log(`   ✅ Created:  ${successful}`);
      console.log(`   ⏭️  Skipped:  ${skipped}`);
      console.log(`   ❌ Failed:   ${failed}`);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
