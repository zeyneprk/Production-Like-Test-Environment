# PowerShell: clone orders_prodlike -> orders_clone (no bash/WSL)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$script = @'
set -e
psql -U orders -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'orders_clone' AND pid <> pg_backend_pid();"
psql -U orders -d postgres -c "DROP DATABASE IF EXISTS orders_clone;"
psql -U orders -d postgres -c "CREATE DATABASE orders_clone OWNER orders;"
pg_dump -U orders -d orders_prodlike --format=custom --no-owner --no-acl -f /tmp/orders_prodlike.dump
pg_restore -U orders -d orders_clone --no-owner --no-acl --exit-on-error /tmp/orders_prodlike.dump
echo ok
'@

$script | docker compose exec -T postgres sh
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
