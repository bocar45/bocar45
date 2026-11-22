#!/usr/bin/env bash
# Apply all Supabase migrations + seed on a throwaway local Postgres, then run the RLS tests.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
cleanup() { "${AS[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMP"; }
AS=()
trap cleanup EXIT
# Postgres refuses to run as root: use the postgres system user in that case (e.g. containers).
AS=()
if [ "$(id -u)" = "0" ]; then chown postgres "$TMP"; AS=(runuser -u postgres --); fi
"${AS[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" start -w >/dev/null
PSQL=("$PGBIN/psql" -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$ROOT/supabase/tests/supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "migration: $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql" # seed must be re-runnable
"${PSQL[@]}" -t -f "$ROOT/supabase/tests/rls.test.sql"
# E24b: the rate limiter under concurrency — 40 simultaneous hits on a limit of 10 must let exactly 10 through.
for i in $(seq 1 40); do
  ( "${PSQL[@]}" -t -A -c "set role service_role; select public.rate_limit_hit('charge:concurrence', 10, 3600);" >> "$TMP/hits" ) &
done
wait
ALLOWED=$(grep -c '^t$' "$TMP/hits" || true)
if [ "$ALLOWED" != "10" ]; then echo "FAIL rate limiter under concurrency: $ALLOWED allowed instead of 10"; exit 1; fi
echo "rate limiter under concurrency: 10 / 40 allowed (OK)"
