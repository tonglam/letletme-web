# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22.23.1-bookworm-slim

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM dependencies AS builder
WORKDIR /app
COPY . .

ARG RELEASE_SHA
ENV NODE_ENV=production \
	LETLETME_ORIGIN=overseas \
	LETLETME_RELEASE_SHA=${RELEASE_SHA} \
	BETTER_AUTH_URL=https://letletme.top \
	GRAPHQL_ENDPOINT=https://api.letletme.top/graphql \
	DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN --mount=type=secret,id=web_build_env,required=true \
	set -eu; \
	test -n "$LETLETME_RELEASE_SHA"; \
	test -s /run/secrets/web_build_env; \
	set -a; . /run/secrets/web_build_env; set +a; \
	test -n "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:-}"; \
	npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ARG RELEASE_SHA
LABEL org.opencontainers.image.source="https://github.com/tonglam/letletme-web" \
	org.opencontainers.image.revision=${RELEASE_SHA}

ENV NODE_ENV=production \
	HOSTNAME=0.0.0.0 \
	PORT=3000

RUN groupadd --system --gid 1001 nodejs \
	&& useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
