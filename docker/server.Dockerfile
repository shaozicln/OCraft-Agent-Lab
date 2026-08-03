FROM node:20-bookworm-slim AS shared-build
WORKDIR /repo
COPY packages/shared/package.json packages/shared/package-lock.json ./packages/shared/
RUN cd packages/shared && npm ci
COPY packages/shared ./packages/shared
RUN cd packages/shared && npm run build

FROM node:20-bookworm-slim AS server-deps
WORKDIR /repo
COPY package.json ./
COPY --from=shared-build /repo/packages/shared ./packages/shared
WORKDIR /repo/server
COPY server/package.json server/package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS server-build
WORKDIR /repo
COPY --from=server-deps /repo /repo
COPY server/tsconfig.json server/tsconfig.build.json server/nest-cli.json ./server/
COPY server/src ./server/src
WORKDIR /repo/server
RUN npx nest build \
  && (test -f dist/main.js || test -f dist/src/main.js)

FROM node:20-bookworm-slim AS server-runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*
COPY --from=server-deps /repo/server/node_modules ./node_modules
COPY --from=shared-build /repo/packages/shared /packages/shared
RUN rm -rf ./node_modules/@ocraft/shared \
  && mkdir -p ./node_modules/@ocraft \
  && ln -sf /packages/shared ./node_modules/@ocraft/shared
COPY --from=server-build /repo/server/dist ./dist
COPY server/package.json server/drizzle.config.ts ./
COPY server/drizzle ./drizzle
COPY docker/server-entrypoint.sh /entrypoint.sh
ENV STORY_PACKS_ROOT=/app/story-packs
EXPOSE 4400
ENTRYPOINT ["dumb-init", "--", "sh", "/entrypoint.sh"]
