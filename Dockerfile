FROM node:20-bookworm-slim AS frontend
WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
ARG VITE_BASE_PATH=/galeria
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build

FROM node:20-bookworm-slim AS backend-deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=backend-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js db.js ./
COPY --from=frontend /build/client/dist ./public
RUN mkdir -p /app/persist/uploads /app/persist/thumbs /app/persist/db
EXPOSE 3002
CMD ["node", "server.js"]
