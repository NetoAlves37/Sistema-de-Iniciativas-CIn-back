# ---- Development ----
FROM node:22-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# ---- Build ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build

# ---- Production ----
FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate --schema prisma/schema.prisma

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
