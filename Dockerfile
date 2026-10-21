# ==========================================
# Stage 1: Build the React Frontend (Vite)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app/web

# Install frontend dependencies
COPY web/package*.json ./
RUN npm ci

# Copy frontend source and build static bundle into web/dist
COPY web/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Server Runtime
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data

# Install root production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server and core agent code
COPY core/ ./core/
COPY prompts/ ./prompts/
COPY server/ ./server/
COPY samples/ ./samples/
COPY agent.js ./

# Copy pre-built frontend distribution from builder stage
COPY --from=builder /app/web/dist ./web/dist

# Ensure persistent data directory exists
RUN mkdir -p /app/data

# Expose default application port
EXPOSE 3001

# Start Express server (serves API + static React SPA)
CMD ["node", "server/index.js"]
