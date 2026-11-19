#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Prefer plain docker; fall back to sudo when the socket is root-only
# (common in fresh CI / cloud agent VMs before the user joins the docker group).
if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
elif sudo -n docker info >/dev/null 2>&1; then
  DOCKER=(sudo docker)
else
  DOCKER=(docker)
fi

"${DOCKER[@]}" compose exec -T postgres bash -s <<'EOS'
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'orders_clone' AND pid <> pg_backend_pid();"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -c "DROP DATABASE IF EXISTS orders_clone;"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -c "CREATE DATABASE orders_clone OWNER \"${POSTGRES_USER}\";"

pg_dump --username "$POSTGRES_USER" --dbname orders_prodlike \
  --format=custom --no-owner --no-acl --file=/tmp/orders_prodlike.dump

pg_restore --username "$POSTGRES_USER" --dbname orders_clone \
  --no-owner --no-acl --exit-on-error /tmp/orders_prodlike.dump

echo "pg_dump orders_prodlike -> pg_restore orders_clone"
EOS
