FROM oven/bun:1.4.4 AS bun

FROM node:22.23.4-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bubblewrap util-linux curl ca-certificates xz-utils perl \
        fontconfig fonts-liberation libfontconfig1 libfreetype6 libicu72 \
        libharfbuzz0b libgraphite2-3 libpng16-16 libzstd1 libteckit0 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN bun run setup:tex && rm -f .tools/tinytex-v2026.11.tar.xz
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_CONVEX_SITE_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL} \
    NEXT_PUBLIC_CONVEX_SITE_URL=${NEXT_PUBLIC_CONVEX_SITE_URL}
RUN bun run build \
    && bun --eval 'const { default: config } = await import("./next.config.ts"); await Bun.write("next.config.mjs", "export default " + JSON.stringify(config) + ";\n");'

FROM base AS production-dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS runtime
RUN groupadd --gid 10001 resume \
    && useradd --uid 10001 --gid 10001 --home-dir /app --no-create-home \
        --shell /usr/sbin/nologin resume \
    && mkdir -p /app/.data \
    && chown 10001:10001 /app/.data
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/.tools ./.tools
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --chmod=555 deploy/start.sh /app/deploy/start.sh
ENV NODE_ENV=production \
    DATA_DIR=/app/.data \
    TEX_TOOLS_DIR=/app/.tools \
    PDF_NODE_BINARY=/usr/local/bin/node \
    PORT=3000
USER 10001:10001
EXPOSE 3000
CMD ["/app/deploy/start.sh"]
