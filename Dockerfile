# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# Runtime stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Don't run as root.
USER node

EXPOSE 3000

# Migrations are applied on boot so a new deploy brings the schema with it.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
