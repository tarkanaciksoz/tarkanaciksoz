#!/usr/bin/env bash
# Deploys the latest main into this checkout. Run on the server, as root:
#
#   /var/www/html/tarkanaciksoz.com/scripts/deploy.sh
#
# git, composer and npm run as the checkout's owner; artisan runs as the web server's
# user, which owns the caches it writes. Content is synced from the seed files, so a
# change to the stack, systems, flows or rules ships with the code.
set -euo pipefail

cd "$(dirname "$0")/.."

[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }

owner=$(stat -c %U .)
php=${PHP_BIN:-php8.2}
as_owner() { sudo -u "$owner" -H "$@"; }
artisan() { sudo -u www-data "$php" artisan "$@"; }

as_owner git pull --ff-only
as_owner composer install --no-dev --optimize-autoloader --no-interaction --no-progress
as_owner npm ci --no-audit --no-fund
as_owner npm run build
# npm ci starts from nothing on every deploy anyway, and the disk is small.
as_owner rm -rf node_modules

artisan migrate --force
artisan db:seed --class=PortfolioSeeder --force
artisan optimize:clear >/dev/null
artisan optimize >/dev/null

echo "Deployed $(as_owner git rev-parse --short HEAD)."
