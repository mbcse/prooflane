#!/bin/sh
set -e
if [ -n "$DATABASE_URL" ]; then
  node ./node_modules/prisma/build/index.js migrate deploy
fi
exec "$@"
