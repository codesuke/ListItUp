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
  REDIS_URL="redis://localhost:6379" \
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

# The standalone server bundle does not include the Prisma CLI, so migrations
# get their own minimal install. The runner applies pending migrations on boot
# because a Dokploy Dockerfile deploy has no separate migrate step.
FROM base AS migrator
WORKDIR /migrator
COPY pnpm-lock.yaml ./
# Install the exact Prisma version the app was built against.
RUN PRISMA_VERSION="$(sed -n 's/^  prisma@\([0-9][^:(]*\):$/\1/p' pnpm-lock.yaml)" \
  && npm install --no-save --no-package-lock "prisma@${PRISMA_VERSION}" \
  && rm pnpm-lock.yaml
COPY prisma.config.ts ./
COPY prisma ./prisma

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=migrator --chown=nextjs:nodejs /migrator ./migrator

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "cd migrator && node_modules/.bin/prisma migrate deploy && cd .. && exec node server.js"]
