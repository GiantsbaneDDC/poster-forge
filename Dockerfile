# PosterForge - Docker Image
# Similar to rpdb-folders-docker

FROM node:20-alpine AS builder

WORKDIR /app

# Install ALL dependencies (including devDeps for build)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# Production image
FROM node:20-alpine

LABEL maintainer="Matt Beatty"
LABEL description="Generate movie/TV posters with rating overlays for Plex/Jellyfin/Emby"
LABEL org.opencontainers.image.source="https://github.com/GiantsbaneDDC/poster-forge"

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

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
