# syntax=docker/dockerfile:1

FROM node:24-slim AS base
# OpenSSL is required for Prisma
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g prisma@7 \
  && corepack enable
ENV PNPM_HOME=/pnpm \
  PATH="/pnpm:$PATH"
WORKDIR /app

########## Install dependencies (devDependencies + dependencies) ##########
FROM base AS deps
ENV NODE_ENV=development
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

########## Run Build ##########
FROM base AS build
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

########## Install production dependencies + Manual Prisma generate (not cli) ##########
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --dangerously-allow-all-builds \
  && prisma generate

########## Runner (Copy production files - node_modules, dist, prisma) ##########
FROM base AS runner
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
