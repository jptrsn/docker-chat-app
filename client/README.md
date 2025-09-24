# Complete Dockerfile Explanation for Docker Bootcamp

This Dockerfile demonstrates a **multi-stage build** pattern for a Next.js application. Multi-stage builds help create smaller, more secure production images by separating the build environment from the runtime environment.

## Stage 1: Base Image Setup

```dockerfile
# Use Node.js 24 Alpine as base image
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
```

**What it does:**
- Uses Node.js version 24 with Alpine Linux (a minimal, security-focused Linux distribution)
- Names this stage "base" so other stages can reference it
- Installs `libc6-compat` which provides compatibility libraries needed by some Node.js packages

**Why Alpine?** Alpine images are much smaller (~5MB base) compared to full Ubuntu images (~70MB+), making your final image faster to download and deploy.

## Stage 2: Dependencies Installation

```dockerfile
# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files and install all dependencies
COPY package.json package-lock.json ./
RUN npm ci
```

**What it does:**
- Creates a new stage called "deps" based on our "base" stage
- Sets the working directory to `/app`
- Copies only the package files (not the entire source code yet)
- Runs `npm ci` for a clean, reproducible installation

**Why separate this stage?** Docker caches layers. If your source code changes but dependencies don't, Docker can reuse this cached layer, speeding up builds significantly.

**Why `npm ci` instead of `npm install`?** `npm ci` is designed for automated environments - it's faster, more reliable, and ensures exact dependency versions from package-lock.json.

## Stage 3: Application Builder

```dockerfile
# Build the application
FROM base AS builder
WORKDIR /app

# Copy package files and install dependencies (including dev dependencies for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Build the Next.js application
RUN npm run build
```

**What it does:**
- Creates a "builder" stage for compiling the application
- Installs ALL dependencies (including devDependencies needed for building)
- Copies the entire source code
- Disables Next.js telemetry (data collection) for privacy/compliance
- Builds the optimized production version of the Next.js app

**Why a separate builder stage?** The build process needs devDependencies (like TypeScript, Webpack plugins) that we don't want in the final production image.

## Stage 4: Production Runtime

```dockerfile
# Production image - run the application
FROM base AS runner
WORKDIR /app
RUN apk add --no-cache curl
```

**What it does:**
- Creates the final "runner" stage for the production container
- Installs `curl` (needed for health checks)
- This stage will become our final image

### Security Setup

```dockerfile
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create nextjs user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
```

**What it does:**
- Sets NODE_ENV to "production" for optimized Node.js performance
- Creates a non-root user "nextjs" with UID 1001
- Creates a "nodejs" group with GID 1001

**Why create a user?** Running containers as root is a security risk. If someone compromises your container, they shouldn't have root privileges.

### Production Dependencies

```dockerfile
# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production
```

**What it does:**
- Installs ONLY production dependencies (no devDependencies)
- This keeps the final image smaller and more secure

### Copy Built Application

```dockerfile
# Copy built application from builder stage
COPY --from=builder /app/public ./public

# Create .next directory and set permissions
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy the built Next.js application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
```

**What it does:**
- Copies the built application from the "builder" stage (not the source code!)
- Sets proper file ownership to the "nextjs" user
- Copies static assets and the standalone server bundle

**Key concept:** We're only copying the compiled, optimized application - not the source code or build tools.

### Runtime Configuration

```dockerfile
# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
```

**What it does:**
- Switches to run as the "nextjs" user (security best practice)
- Exposes port 3000 (documentation - doesn't actually open the port)
- Sets environment variables for the Next.js server

**Why HOSTNAME "0.0.0.0"?** Inside a container, you need to bind to all interfaces (0.0.0.0) rather than just localhost (127.0.0.1) so external traffic can reach your app.

### Health Check

```dockerfile
# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

**What it does:**
- Checks every 30 seconds if the app is healthy
- Waits 5 seconds after startup before first check
- Times out after 3 seconds
- Retries 3 times before marking as unhealthy
- Calls a health endpoint and exits with code 1 if it fails

**Why health checks?** Orchestrators like Docker Compose and Kubernetes can automatically restart unhealthy containers.

### Application Startup

```dockerfile
# Start the application
CMD ["node", "server.js"]
```

**What it does:**
- Starts the Next.js application by running the standalone server
- Uses exec form (array syntax) which is more efficient than shell form

## Key Benefits of This Multi-Stage Approach

1. **Smaller final image**: Only contains production dependencies and built code
2. **Better caching**: Dependencies are cached separately from source code
3. **Security**: Runs as non-root user, minimal attack surface
4. **Performance**: Optimized for production with health checks
5. **Reproducibility**: Uses exact dependency versions and clean installs

## Build Commands for Your Bootcamp

To build this image:
```bash
docker build -t my-nextjs-app .
```

To run the container:
```bash
docker run -p 3000:3000 my-nextjs-app
```

This Dockerfile demonstrates production-ready containerization patterns that your bootcamp participants can apply to their own Next.js applications!