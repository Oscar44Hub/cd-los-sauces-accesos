#!/usr/bin/env bash
# Prueba el esquema en un PostgreSQL local temporal: ./supabase/tests/ejecutar.sh
#  1. Base nueva con todas las migraciones + pruebas de la lógica de acceso, perfiles y pagos.
#  2. Base con datos de la versión anterior + migraciones nuevas (como la del club).
set -euo pipefail
cd "$(dirname "$0")"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"
PORT="${PORT:-54329}"
trap '"$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT
"$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -w start >/dev/null
psql_en() { psql -h "$DATA" -p "$PORT" -U postgres -d "$1" -v ON_ERROR_STOP=1 -q -t -A "${@:2}"; }
MIGRACIONES=(../migrations/*.sql)

psql_en postgres -f stubs_supabase.sql
for f in "${MIGRACIONES[@]}"; do psql_en postgres -f "$f"; done
psql_en postgres -f pruebas.sql

psql_en postgres -c 'create database migracion'
psql_en migracion -f stubs_supabase.sql 2>/dev/null || psql_en migracion -f <(grep -v '^create role' stubs_supabase.sql)
psql_en migracion -f "${MIGRACIONES[0]}"
psql_en migracion -f migracion_previa.sql
for f in "${MIGRACIONES[@]:1}"; do psql_en migracion -f "$f"; done
psql_en migracion -f migracion_comprobar.sql
