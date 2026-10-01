FROM node:22-alpine AS base

# ---- Dependencies + build ----
FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Inlined into the client bundle at build time (used by robots.ts/sitemap.ts
# for absolute URLs) — matches where this site is reverse-proxied to.
ARG NEXT_PUBLIC_SITE_URL=https://cincoders.cin.ufpe.br/starter-kit/nestjs
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm ci
RUN npm run build

# ---- Production ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Leverages output file tracing to keep the image small.
# https://nextjs.org/docs/app/api-reference/config/next-config-js/output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3030
ENV PORT=3030
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
