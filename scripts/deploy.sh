#!/usr/bin/env sh
# Usage: deploy.sh [APP_DIR] [COMPOSE_FILE] [SERVICE ...]
# Optional Compose service names limit "up --build", e.g. admin admin_dev
# Omit services to build/start every service in the compose file.
set -eu

APP_DIR="${1:-/opt/nyra_admin}"
COMPOSE_FILE="${2:-docker-compose.yml}"

cd "$APP_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: compose file $COMPOSE_FILE not found in $APP_DIR"
  exit 1
fi

echo "Deploying from $APP_DIR using $COMPOSE_FILE"
docker compose -f "$COMPOSE_FILE" pull || true
if [ "$#" -gt 2 ]; then
  shift 2
  echo "Targeting services: $*"
  docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans "$@"
else
  docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans
fi
docker image prune -f

echo "Compose status:"
docker compose -f "$COMPOSE_FILE" ps -a

echo "Deploy complete"
