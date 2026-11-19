#!/bin/bash
set -euo pipefail

# POSTGRES_DB (orders_clean) already exists from the image entrypoint.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE DATABASE orders_prodlike OWNER \"${POSTGRES_USER}\";"

# Empty clone DB so api-clone can boot; scripts/clone-prodlike.* replace it
# with a pg_dump/pg_restore of orders_prodlike.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE DATABASE orders_clone OWNER \"${POSTGRES_USER}\";"

for db in "$POSTGRES_DB" orders_prodlike orders_clone; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" -f /sql/schema.sql
done

for db in "$POSTGRES_DB" orders_prodlike; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" -f /sql/seed.sql
done

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname orders_prodlike \
  -f /sql/prodlike-nulls.sql
