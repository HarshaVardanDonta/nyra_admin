FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked into the static bundle by Vite; set at image build time (see docker-compose.yml build.args).
# Without MSG91 widget args, login uses legacy /otp/send + /verify (API must use a real MSG91_TEMPLATE_ID).
ARG VITE_API_BASE_URL
ARG VITE_API_PATH_PREFIX=
ARG VITE_MSG91_WIDGET_ID=
ARG VITE_MSG91_WIDGET_AUTH_TOKEN=
RUN test -n "$VITE_API_BASE_URL" || (echo "ERROR: VITE_API_BASE_URL build-arg is required. Set it in .env and use docker compose build." >&2 && exit 1)
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_PATH_PREFIX=$VITE_API_PATH_PREFIX
ENV VITE_MSG91_WIDGET_ID=$VITE_MSG91_WIDGET_ID
ENV VITE_MSG91_WIDGET_AUTH_TOKEN=$VITE_MSG91_WIDGET_AUTH_TOKEN

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
