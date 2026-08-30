# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN npm i -g pnpm@11

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=1
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Migrations SQL exécutées au démarrage (instrumentation.ts)
COPY --from=build /app/drizzle ./drizzle
# Prompts de l'agent, chargés à l'exécution depuis src/lib/agent/prompts
COPY --from=build /app/src/lib/agent/prompts ./src/lib/agent/prompts
USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
