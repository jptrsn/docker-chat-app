# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install TypeScript and build dependencies
RUN npm install -g typescript

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies and source files to reduce image size
RUN npm prune --production && \
    rm -rf src tsconfig.json

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S chatserver -u 1001

# Change ownership of the working directory
RUN chown -R chatserver:nodejs /app

# Switch to non-root user
USER chatserver

# Expose the port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]