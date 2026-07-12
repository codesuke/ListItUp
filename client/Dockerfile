# Build context: client/
#   docker build -t listitup .
#   docker run -p 3000:3000 --env-file .env listitup

FROM node:26-alpine AS base
RUN npm install -g corepack@latest && corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-only placeholders let Next.js evaluate auth routes while collecting
# page data. They exist only for this command; Dokploy supplies real values at
# runtime and Docker does not persist them in the image configuration.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
  BETTER_AUTH_SECRET="build-only-not-a-production-secret" \
  BETTER_AUTH_URL="http://localhost:3000" \
  MAIL_PROVIDER="custom" \
  SMTP_HOST="localhost" \
  SMTP_PORT="2525" \
  SMTP_SECURE="false" \
  SMTP_USER="build" \
  SMTP_PASSWORD="build" \
  MAIL_FROM_NAME="ListItUp" \
  MAIL_FROM_EMAIL="no-reply@listitup.build" \
  pnpm build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
