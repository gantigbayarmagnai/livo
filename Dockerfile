# Livo production image.
# Same container runs on Render today and on AWS (ECS/Fargate) or anywhere else later.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# One small file that applies database migrations at start-up.
RUN npx esbuild scripts/migrate.ts --bundle --platform=node --target=node22 --external:pg-native --outfile=dist/migrate.js

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=10000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S livo && adduser -S livo -G livo
COPY --from=build --chown=livo:livo /app/.next/standalone ./
COPY --from=build --chown=livo:livo /app/.next/static ./.next/static
COPY --from=build --chown=livo:livo /app/public ./public
COPY --from=build --chown=livo:livo /app/drizzle ./drizzle
COPY --from=build --chown=livo:livo /app/dist/migrate.js ./migrate.js
USER livo
EXPOSE 10000
# Bring the database up to date, then serve.
CMD ["sh", "-c", "node migrate.js && exec node server.js"]
