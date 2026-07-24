# syntax=docker/dockerfile:1

# ── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Non-root user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs clearway

# Only the standalone output, static assets, migrations, and scripts.
COPY --from=build --chown=clearway:nodejs /app/.next/standalone ./
COPY --from=build --chown=clearway:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=clearway:nodejs /app/public ./public
COPY --from=build --chown=clearway:nodejs /app/migrations ./migrations
COPY --from=build --chown=clearway:nodejs /app/scripts ./scripts

USER clearway
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
