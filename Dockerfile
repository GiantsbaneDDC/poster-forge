FROM node:20-alpine

WORKDIR /app

# Install dependencies for sharp (native image processing)
RUN apk add --no-cache python3 make g++ vips-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

# Environment
ENV NODE_ENV=production
ENV PORT=8760
ENV MEDIA_FOLDERS=/media/movies,/media/tv

EXPOSE 8760

CMD ["node", "dist/index.js"]
