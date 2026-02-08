# PosterForge - Docker Image
# Similar to rpdb-folders-docker

FROM node:20-alpine

LABEL maintainer="Matt Beatty"
LABEL description="Generate movie/TV posters with rating overlays for Plex/Jellyfin/Emby"

# Create app directory
WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Create config and media mount points
RUN mkdir -p /posterforge/config /posterforge/media

# Default environment
ENV NODE_ENV=production
ENV PORT=8750
ENV MEDIA_FOLDERS=/posterforge/media
ENV POSTER_STYLE=badges
ENV RATINGS=imdb,rt,metacritic
ENV OVERWRITE=false

# Expose web UI port (same as RPDB for familiarity)
EXPOSE 8750

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8750/ || exit 1

# Volume for persistent config
VOLUME ["/posterforge/config", "/posterforge/media"]

# Start the web UI
CMD ["node", "dist/index.js"]
