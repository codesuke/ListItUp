# Build context: client/
#   docker build -t listitup .
#   docker run -p 3000:3000 --env-file .env listitup

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# These build-only placeholders let Next.js evaluate the auth route while
# collecting page data. The runner stage does not inherit them; Dokploy must
# provide real database, Better Auth, and SMTP values at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV BETTER_AUTH_SECRET="build-only-not-a-production-secret"
ENV BETTER_AUTH_URL="http://localhost:3000"
ENV MAIL_PROVIDER="custom"
ENV SMTP_HOST="localhost"
ENV SMTP_PORT="2525"
ENV SMTP_SECURE="false"
ENV SMTP_USER="build"
ENV SMTP_PASSWORD="build"
ENV MAIL_FROM_NAME="ListItUp"
ENV MAIL_FROM_EMAIL="no-reply@listitup.build"
RUN pnpm build

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
