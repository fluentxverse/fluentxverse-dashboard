# Build stage
FROM docker.io/oven/bun:1-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=https://api.fluentxverse.com
ARG VITE_SOCKET_URL=https://ws.fluentxverse.com
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Copy package files
COPY package.json bun.lock* ./

# Install ALL dependencies (including dev for vite)
RUN bun install

# Copy source code
COPY . .

# Build the app
RUN bun run build

# Production stage - use nginx to serve static files
FROM docker.io/library/nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location /assets/ { \
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always; \
        try_files $uri =404; \
    } \
    location / { \
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
