# syntax=docker/dockerfile:1

# --- build stage: install everything, generate the client, compile -------------
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
WORKDIR /app

# Dependencies first, so this layer is cached across code changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

# The Prisma client is generated inside the image, so the host toolchain
# (and its query engine cache) never has to match.
RUN pnpm db:generate && pnpm build

# --- migration stage: keeps the prisma CLI (a dev dependency) ---------------
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

# --- production dependencies ------------------------------------------------
FROM build AS prod-deps
RUN pnpm prune --prod

# --- runtime stage ----------------------------------------------------------
FROM node:22-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
RUN apk add --no-cache tini

ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/dist ./dist
COPY --from=prod-deps /app/package.json ./package.json
# Schema + migrations are kept for `prisma db push`-style tooling and inspection.
COPY --from=build /app/src/database/prisma ./src/database/prisma

USER node

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
