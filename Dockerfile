FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
RUN addgroup -S sveltekit && adduser -S sveltekit -G sveltekit

COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/static ./static
RUN chown -R sveltekit:sveltekit /app
USER sveltekit
EXPOSE ${PORT:-5178}

ENV NODE_ENV=production

CMD ["node", "build"]
