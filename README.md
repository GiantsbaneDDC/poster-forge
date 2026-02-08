# 🎬 PosterForge

Generate movie and TV show posters with rating overlays for Plex, Jellyfin, Emby, and other media centers.

**Free alternative to RPDB** - uses free TMDB and OMDB APIs.

![Badges Style](https://img.shields.io/badge/Style-Badges-blue)
![TMDB](https://img.shields.io/badge/TMDB-Posters-01D277)
![IMDB](https://img.shields.io/badge/IMDB-Ratings-F5C518)
![RT](https://img.shields.io/badge/Rotten_Tomatoes-Scores-FA320A)

## ✨ Features

- 🎬 Fetches high-quality posters from TMDB
- ⭐ Overlays ratings from IMDB, Rotten Tomatoes, Metacritic
- 📁 Scans your media folders automatically
- 🎨 Multiple overlay styles (badges, bar, minimal)
- 🌐 Web UI for easy management
- 🔄 Watch mode for new content
- 💾 Saves `poster.jpg` for Plex/Jellyfin/Emby

## 🚀 Quick Start

### 1. Get API Keys (Free)

- **TMDB**: https://www.themoviedb.org/settings/api (free, instant)
- **OMDB**: https://www.omdbapi.com/apikey.aspx (free tier: 1000/day)

### 2. Install

```bash
git clone https://github.com/GiantsbaneDDC/poster-forge.git
cd poster-forge
npm install
```

### 3. Configure

```bash
cp .env.example .env
nano .env
```

Set your API keys and media folders:
```env
TMDB_API_KEY=your_key_here
OMDB_API_KEY=your_key_here
MEDIA_FOLDERS=/path/to/movies,/path/to/tv-shows
```

### 4. Run

```bash
# Scan to see what will be processed
npm run scan

# Generate all posters
npm run process

# Or use the web UI
npm run dev
# Open http://localhost:8760
```

## 📁 Folder Structure

PosterForge expects your media to be organized like:

```
/Movies/
  Avengers Endgame (2019)/
    movie.mkv
  The Matrix (1999)/
    movie.mkv

/TV Shows/
  Breaking Bad (2008)/
    Season 1/
    Season 2/
  The Office (2005)/
    Season 1/
```

### Folder Naming Tips

- Include the year: `Movie Name (2020)` ✅
- IDs help matching: `Movie Name (2020) [imdb-tt1234567]` ✅

## 🎨 Poster Styles

### Badges (default)
Rating badges in the top-left corner:
```
┌──────────────────┐
│ IMDB 8.5         │
│ RT   92%         │
│ MC   85          │
│                  │
│     [POSTER]     │
│                  │
└──────────────────┘
```

### Bar
Rating bar at the bottom:
```
┌──────────────────┐
│                  │
│     [POSTER]     │
│                  │
│ IMDb 8.5 | RT 92%│
└──────────────────┘
```

### Minimal
Small badges, less intrusive:
```
┌──────────────────┐
│ 8.5 92%          │
│                  │
│     [POSTER]     │
│                  │
└──────────────────┘
```

## ⚙️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `TMDB_API_KEY` | TMDB API key (required) | - |
| `OMDB_API_KEY` | OMDB API key (required) | - |
| `MEDIA_FOLDERS` | Comma-separated paths | - |
| `POSTER_STYLE` | badges, bar, minimal | badges |
| `RATINGS` | imdb,rt,metacritic,tmdb | imdb,rt,metacritic |
| `OVERWRITE` | Replace existing posters | false |
| `PORT` | Web UI port | 8760 |

## 🐳 Docker

```bash
docker build -t poster-forge .
docker run -d \
  -p 8760:8760 \
  -v /path/to/movies:/media/movies \
  -v /path/to/tv:/media/tv \
  -e TMDB_API_KEY=xxx \
  -e OMDB_API_KEY=xxx \
  -e MEDIA_FOLDERS=/media/movies,/media/tv \
  poster-forge
```

## 📄 License

MIT

## 🙏 Credits

- [TMDB](https://www.themoviedb.org/) - Movie/TV metadata and posters
- [OMDB](https://www.omdbapi.com/) - IMDB, Rotten Tomatoes, Metacritic ratings
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing
