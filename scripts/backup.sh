#!/usr/bin/env bash
# Snapshot the LifeOS database.
#
# Uses sqlite3 .backup rather than cp: it takes a consistent snapshot while
# the app is still writing, where a plain copy can catch a half-written page.
#
#   scripts/backup.sh            snapshot + prune old ones
#   scripts/backup.sh --verify   also check the newest snapshot opens
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${LIFEOS_DB_PATH:-$ROOT/data/lifeos.db}"
DEST="${LIFEOS_BACKUP_DIR:-$HOME/backups/lifeos}"
KEEP="${LIFEOS_BACKUP_KEEP:-14}"

[ -f "$DB" ] || { echo "no database at $DB" >&2; exit 1; }
mkdir -p "$DEST"

STAMP=$(date +%Y%m%d_%H%M%S)
OUT="$DEST/lifeos_$STAMP.db"

sqlite3 "$DB" ".backup '$OUT'"
gzip -f "$OUT"
echo "backed up -> $OUT.gz ($(du -h "$OUT.gz" | cut -f1))"

# Keep the most recent N, drop the rest.
mapfile -t old < <(ls -1t "$DEST"/lifeos_*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)))
if [ ${#old[@]} -gt 0 ]; then
  rm -f "${old[@]}"
  echo "pruned ${#old[@]} old snapshot(s), keeping $KEEP"
fi

if [ "${1:-}" = "--verify" ]; then
  NEWEST=$(ls -1t "$DEST"/lifeos_*.db.gz | head -1)
  TMP=$(mktemp)
  gunzip -c "$NEWEST" > "$TMP"
  ROWS=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM records" 2>/dev/null || echo FAIL)
  USERS=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM users" 2>/dev/null || echo FAIL)
  INTEGRITY=$(sqlite3 "$TMP" "PRAGMA integrity_check" 2>/dev/null || echo FAIL)
  rm -f "$TMP"
  echo "verify: $NEWEST -> integrity=$INTEGRITY users=$USERS records=$ROWS"
  [ "$INTEGRITY" = "ok" ] || exit 1
fi
