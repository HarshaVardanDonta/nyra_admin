#!/usr/bin/env sh
set -eu

APP_DIR="${1:-/opt/nyra_admin}"
COMPOSE_FILE="${2:-docker-compose.yml}"

cd "$APP_DIR"

if [ ! -f ".env" ]; then
  echo "ERROR: .env file not found in $APP_DIR"
  echo "Create it first with production values."
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: compose file $COMPOSE_FILE not found in $APP_DIR"
  exit 1
fi

echo "Deploying from $APP_DIR using $COMPOSE_FILE"
docker compose -f "$COMPOSE_FILE" pull || true
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans
docker image prune -f

echo "Deploy complete"
