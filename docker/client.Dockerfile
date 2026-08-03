FROM node:20-bookworm-slim AS shared-build
WORKDIR /repo
COPY packages/shared/package.json packages/shared/package-lock.json ./packages/shared/
RUN cd packages/shared && npm ci
COPY packages/shared ./packages/shared
RUN cd packages/shared && npm run build

FROM node:20-bookworm-slim AS client-deps
WORKDIR /repo/client
COPY client/package.json client/package-lock.json ./
COPY --from=shared-build /repo/packages/shared /repo/packages/shared
RUN npm ci

FROM node:20-bookworm-slim AS client-build
WORKDIR /repo
COPY --from=client-deps /repo/client /repo/client
COPY --from=shared-build /repo/packages/shared /repo/packages/shared
COPY client ./client
WORKDIR /repo/client
ARG NEXT_PUBLIC_GAME_SERVER_URL=http://localhost:4400
ENV NEXT_PUBLIC_GAME_SERVER_URL=$NEXT_PUBLIC_GAME_SERVER_URL
# package.json build 会再编 shared；目录布局需 ../packages/shared
RUN npm run build

FROM node:20-bookworm-slim AS client-runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3300
ENV HOSTNAME=0.0.0.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*
COPY --from=client-build /repo/client/package.json ./
COPY --from=client-build /repo/client/node_modules ./node_modules
COPY --from=client-build /repo/client/.next ./.next
COPY --from=client-build /repo/client/public ./public
COPY --from=shared-build /repo/packages/shared /packages/shared
RUN rm -rf ./node_modules/@ocraft/shared \
  && mkdir -p ./node_modules/@ocraft \
  && ln -sf /packages/shared ./node_modules/@ocraft/shared
EXPOSE 3300
ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3300"]
