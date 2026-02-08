import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import { PosterProcessor } from './processor.js';
import { parseFolderName } from './scanner/index.js';

export interface WatcherOptions {
  mediaFolders: string[];
  processor: PosterProcessor;
  onNewMedia?: (folder: string, title: string) => void;
  onPosterCreated?: (folder: string, title: string, success: boolean) => void;
}

export class FolderWatcher {
  private watchers: chokidar.FSWatcher[] = [];
  private processor: PosterProcessor;
  private options: WatcherOptions;
  private processing = new Set<string>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(options: WatcherOptions) {
    this.options = options;
    this.processor = options.processor;
  }

  start(): void {
    console.log('🔍 Starting folder watcher...');
    
    for (const folder of this.options.mediaFolders) {
      if (!fs.existsSync(folder)) {
        console.log(`⚠️  Folder does not exist: ${folder}`);
        continue;
      }

      console.log(`👀 Watching: ${folder}`);
      
      const watcher = chokidar.watch(folder, {
        depth: 1, // Only watch immediate subdirectories
        ignoreInitial: true, // Don't trigger for existing folders
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });

      watcher.on('addDir', (dirPath) => {
        this.handleNewDirectory(dirPath, folder);
      });

      // Also watch for new video files (in case folder already exists)
      watcher.on('add', (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        const videoExts = ['.mkv', '.mp4', '.avi', '.m4v', '.mov', '.wmv'];
        if (videoExts.includes(ext)) {
          const dirPath = path.dirname(filePath);
          this.handleNewDirectory(dirPath, folder);
        }
      });

      this.watchers.push(watcher);
    }

    console.log('✅ Folder watcher started');
  }

  private handleNewDirectory(dirPath: string, baseFolder: string): void {
    // Ignore the base folder itself
    if (dirPath === baseFolder) return;
    
    // Get the folder name (immediate child of media folder)
    const relativePath = path.relative(baseFolder, dirPath);
    const topLevelFolder = relativePath.split(path.sep)[0];
    const fullPath = path.join(baseFolder, topLevelFolder);
    
    // Skip if already processing
    if (this.processing.has(fullPath)) return;
    
    // Debounce - wait for folder to stabilize (files still being copied)
    if (this.debounceTimers.has(fullPath)) {
      clearTimeout(this.debounceTimers.get(fullPath));
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(fullPath);
      this.processNewFolder(fullPath);
    }, 5000); // Wait 5 seconds after last activity

    this.debounceTimers.set(fullPath, timer);
  }

  private async processNewFolder(folderPath: string): Promise<void> {
    // Check if poster already exists
    const posterPath = path.join(folderPath, 'poster.jpg');
    if (fs.existsSync(posterPath)) {
      console.log(`⏭️  Poster already exists: ${path.basename(folderPath)}`);
      return;
    }

    const folderName = path.basename(folderPath);
    const parsed = parseFolderName(folderName);
    
    console.log(`🆕 New media detected: ${parsed.title} (${parsed.year || 'unknown year'})`);
    
    if (this.options.onNewMedia) {
      this.options.onNewMedia(folderPath, parsed.title);
    }

    // Mark as processing
    this.processing.add(folderPath);

    try {
      // Determine if movie or TV show
      const isShow = this.isLikelyTVShow(folderPath);
      
      const result = await this.processor.processSingle({
        folderPath,
        folderName,
        title: parsed.title,
        year: parsed.year,
        type: isShow ? 'show' : 'movie',
      });

      if (result.success) {
        console.log(`✅ Poster created: ${parsed.title}`);
      } else {
        console.log(`❌ Failed to create poster for ${parsed.title}: ${result.message}`);
      }

      if (this.options.onPosterCreated) {
        this.options.onPosterCreated(folderPath, parsed.title, result.success);
      }
    } catch (error) {
      console.error(`❌ Error processing ${parsed.title}:`, error);
    } finally {
      this.processing.delete(folderPath);
    }
  }

  private isLikelyTVShow(folderPath: string): boolean {
    try {
      const contents = fs.readdirSync(folderPath);
      
      // Check for season folders
      const hasSeasonFolder = contents.some(item => {
        const lower = item.toLowerCase();
        return lower.startsWith('season') || /^s\d+$/i.test(item);
      });
      
      if (hasSeasonFolder) return true;

      // Check for episode patterns in files
      const hasEpisodeFiles = contents.some(item => {
        return /s\d{1,2}e\d{1,2}/i.test(item) || /\d{1,2}x\d{2}/i.test(item);
      });

      return hasEpisodeFiles;
    } catch {
      return false;
    }
  }

  stop(): void {
    console.log('🛑 Stopping folder watcher...');
    
    for (const watcher of this.watchers) {
      watcher.close();
    }
    
    this.watchers = [];
    
    // Clear any pending timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    console.log('✅ Folder watcher stopped');
  }
}
