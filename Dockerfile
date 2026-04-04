FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked into the static bundle by Vite; must be set at image build time (see docker-compose build.args).
ARG VITE_API_BASE_URL
RUN test -n "$VITE_API_BASE_URL" || (echo "ERROR: VITE_API_BASE_URL build-arg is required. Set it in .env and use docker compose build." >&2 && exit 1)
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
