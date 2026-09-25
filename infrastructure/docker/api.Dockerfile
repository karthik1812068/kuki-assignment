FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/agent/package.json apps/agent/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/indexing/package.json packages/indexing/package.json
COPY packages/github/package.json packages/github/package.json
COPY packages/tools/package.json packages/tools/package.json
COPY packages/security/package.json packages/security/package.json
COPY packages/logger/package.json packages/logger/package.json
RUN npm ci

COPY . .
RUN npm run build:packages && npm run build -w @codepilot/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/agent/package.json apps/agent/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/indexing/package.json packages/indexing/package.json
COPY packages/github/package.json packages/github/package.json
COPY packages/tools/package.json packages/tools/package.json
COPY packages/security/package.json packages/security/package.json
COPY packages/logger/package.json packages/logger/package.json
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/types/dist packages/types/dist
COPY --from=build /app/packages/config/dist packages/config/dist
COPY --from=build /app/packages/database/dist packages/database/dist
COPY --from=build /app/packages/database/migrations packages/database/migrations
COPY --from=build /app/packages/logger/dist packages/logger/dist
COPY --from=build /app/packages/security/dist packages/security/dist
COPY --from=build /app/packages/ai/dist packages/ai/dist
COPY --from=build /app/packages/indexing/dist packages/indexing/dist
COPY --from=build /app/packages/github/dist packages/github/dist
COPY --from=build /app/packages/tools/dist packages/tools/dist

RUN chown -R node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
