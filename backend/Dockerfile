FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install sqlite3 dependencies
RUN apk add --no-cache python3 make g++

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.env.example ./

# Rebuild sqlite3 for alpine
RUN npm rebuild sqlite3

EXPOSE 3001
CMD ["node", "dist/main.js"]
