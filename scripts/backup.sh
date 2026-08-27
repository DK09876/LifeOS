#!/usr/bin/env bash
# Snapshot the LifeOS database.
#
# Uses sqlite3 .backup rather than cp: it takes a consistent snapshot while
# the app is still writing, where a plain copy can catch a half-written page.
#
# Skips the write entirely when nothing has changed since the last snapshot,
# so a quiet fortnight leaves one file rather than fourteen identical ones.
#
#   scripts/backup.sh            snapshot if changed, then prune
#   scripts/backup.sh --verify   also integrity-check the newest
#   scripts/backup.sh --force    snapshot even if unchanged
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${LIFEOS_DB_PATH:-$ROOT/data/lifeos.db}"
DEST="${LIFEOS_BACKUP_DIR:-$HOME/backups/lifeos}"
KEEP="${LIFEOS_BACKUP_KEEP:-14}"
MAX_MB="${LIFEOS_BACKUP_MAX_MB:-200}"

VERIFY=0; FORCE=0
for arg in "$@"; do
  case "$arg" in
    --verify) VERIFY=1 ;;
    --force)  FORCE=1 ;;
  esac
done

[ -f "$DB" ] || { echo "no database at $DB" >&2; exit 1; }
mkdir -p "$DEST"

# Hash the logical contents, not the file: SQLite rewrites pages and bumps
# mtime for reasons that do not change what is stored.
CURRENT=$(sqlite3 "$DB" ".dump" | sha256sum | cut -d' ' -f1)
MARKER="$DEST/.last-hash"

if [ "$FORCE" -eq 0 ] && [ -f "$MARKER" ] && [ "$(cat "$MARKER")" = "$CURRENT" ]; then
  echo "unchanged since last snapshot - skipping ($(ls -1 "$DEST"/lifeos_*.db.gz 2>/dev/null | wc -l) kept, $(du -sh "$DEST" | cut -f1))"
else
  # Second-resolution names collide if two runs land in the same second.
  OUT="$DEST/lifeos_$(date +%Y%m%d_%H%M%S).db"
  suffix=1
  while [ -e "$OUT.gz" ]; do
    OUT="$DEST/lifeos_$(date +%Y%m%d_%H%M%S)_$suffix.db"
    suffix=$((suffix + 1))
  done
  sqlite3 "$DB" ".backup '$OUT'"
  gzip -f "$OUT"
  echo "$CURRENT" > "$MARKER"
  echo "backed up -> $OUT.gz ($(du -h "$OUT.gz" | cut -f1))"
fi

# Prune by count.
mapfile -t old < <(ls -1t "$DEST"/lifeos_*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)))
if [ ${#old[@]} -gt 0 ]; then
  rm -f "${old[@]}"
  echo "pruned ${#old[@]} beyond the newest $KEEP"
fi

# Prune by total size, oldest first, so growth can never fill the card.
while [ "$(du -sm "$DEST" | cut -f1)" -gt "$MAX_MB" ]; do
  OLDEST=$(ls -1tr "$DEST"/lifeos_*.db.gz 2>/dev/null | head -1)
  [ -z "$OLDEST" ] && break
  rm -f "$OLDEST"
  echo "pruned $OLDEST to stay under ${MAX_MB}MB"
done

echo "store: $(ls -1 "$DEST"/lifeos_*.db.gz 2>/dev/null | wc -l) snapshot(s), $(du -sh "$DEST" | cut -f1)"

if [ "$VERIFY" -eq 1 ]; then
  NEWEST=$(ls -1t "$DEST"/lifeos_*.db.gz 2>/dev/null | head -1)
  [ -z "$NEWEST" ] && { echo "verify: nothing to check" >&2; exit 1; }
  TMP=$(mktemp)
  gunzip -c "$NEWEST" > "$TMP"
  INTEGRITY=$(sqlite3 "$TMP" "PRAGMA integrity_check" 2>/dev/null || echo FAIL)
  USERS=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM users" 2>/dev/null || echo FAIL)
  ROWS=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM records" 2>/dev/null || echo FAIL)
  rm -f "$TMP"
  echo "verify: $(basename "$NEWEST") integrity=$INTEGRITY users=$USERS records=$ROWS"
  [ "$INTEGRITY" = "ok" ] || exit 1
fi
