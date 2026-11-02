# NCVR web app — multi-stage production image
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined at build time
ARG NEXT_PUBLIC_STREAM_URL=""
ARG NEXT_PUBLIC_WEBCAST_URL=""
ARG NEXT_PUBLIC_SHOW_LISTENER_COUNT="false"
ARG NEXT_PUBLIC_CONTACT_EMAIL=""
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Standalone Prisma CLI for running migrations at container start
FROM base AS migrator
WORKDIR /opt/prisma
RUN npm init -y >/dev/null && npm i --omit=dev --no-audit --no-fund prisma@6.19.3

FROM base AS run
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 UPLOAD_DIR=/data/uploads
RUN useradd --system --uid 1001 ncvr && mkdir -p /data/uploads && chown -R ncvr /data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=migrator /opt/prisma /opt/prisma
COPY docker-entrypoint.sh ./
USER ncvr
EXPOSE 3000
VOLUME ["/data"]
ENTRYPOINT ["./docker-entrypoint.sh"]
