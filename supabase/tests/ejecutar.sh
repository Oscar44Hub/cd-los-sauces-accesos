#!/usr/bin/env bash
# Prueba el esquema en un PostgreSQL local temporal: ./supabase/tests/ejecutar.sh
set -euo pipefail
cd "$(dirname "$0")"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"
PORT="${PORT:-54329}"
trap '"$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT
"$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -w start >/dev/null
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -t -A)
"${PSQL[@]}" -f stubs_supabase.sql
for f in ../migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f pruebas.sql
