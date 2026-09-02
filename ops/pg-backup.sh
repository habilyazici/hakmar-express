#!/bin/sh
# Periodic pg_dump of the application database, with a retention window.
#
# Runs as its own container in docker-compose.prod.yml rather than as a cron
# job on the host: the database is only reachable on the compose network, so
# anything outside it would need Postgres published to the host — which is
# exactly what that file goes out of its way not to do.
#
# `pg_dump -Fc` (custom format) rather than plain SQL: it is compressed, and
# pg_restore can read it selectively, which is what you want at 3am when one
# table needs to come back and the rest must not.
#
# Failures are loud and non-fatal. A backup that cannot be taken must be
# visible in the logs, and it must not be a reason the container stops trying
# tomorrow — an exiting backup service is a backup service nobody notices is
# gone.
set -u

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_INTERVAL_SECONDS:=86400}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${POSTGRES_HOST:=postgres}"

log() { echo "[backup] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

mkdir -p "$BACKUP_DIR"

log "starting: every ${BACKUP_INTERVAL_SECONDS}s, keeping ${BACKUP_RETENTION_DAYS} days in ${BACKUP_DIR}"

while true; do
  stamp=$(date -u '+%Y%m%dT%H%M%SZ')
  # Written under a .part name and renamed only on success, so a dump
  # interrupted halfway can never be mistaken for a complete one — which is
  # the failure that turns a backup into a false sense of security.
  partial="${BACKUP_DIR}/hakmar-${stamp}.dump.part"
  final="${BACKUP_DIR}/hakmar-${stamp}.dump"

  if pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      --format=custom --file="$partial"; then
    mv "$partial" "$final"
    log "wrote $(basename "$final") ($(wc -c < "$final") bytes)"

    # Pruned only after a successful dump. Doing it unconditionally would
    # let a fortnight of failures quietly delete the last good backup.
    deleted=$(find "$BACKUP_DIR" -name 'hakmar-*.dump' -type f \
      -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete | wc -l)
    [ "$deleted" -gt 0 ] && log "pruned ${deleted} backup(s) older than ${BACKUP_RETENTION_DAYS} days"
  else
    rm -f "$partial"
    log "ERROR: pg_dump failed; retrying at the next interval"
  fi

  sleep "$BACKUP_INTERVAL_SECONDS"
done
