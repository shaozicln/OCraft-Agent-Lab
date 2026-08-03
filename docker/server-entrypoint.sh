#!/bin/sh
set -e

echo "[ocraft-server] waiting for database…"
# drizzle-kit migrate 会自己连；先简单重试几次
i=0
until node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(() => c.end()).catch((e) => { console.error(e.message); process.exit(1); });
" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[ocraft-server] database not ready after 30s"
    exit 1
  fi
  sleep 1
done

echo "[ocraft-server] running migrations…"
npx drizzle-kit migrate

MAIN=dist/main.js
if [ ! -f "$MAIN" ]; then
  MAIN=dist/src/main.js
fi
echo "[ocraft-server] starting $MAIN on PORT=${PORT:-4400}"
exec node "$MAIN"
