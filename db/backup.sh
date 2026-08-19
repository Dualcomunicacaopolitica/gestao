#!/bin/sh
# ═══════════════════════════════════════════════════════════
# backup.sh — laço de backup do serviço "backup" (container).
# Roda pg_dump (formato custom, comprimido) em intervalo fixo e
# aplica retenção por dias. Credenciais vêm de PG* no ambiente.
# ═══════════════════════════════════════════════════════════
set -eu
: "${RETENTION_DAYS:=14}"
: "${BACKUP_INTERVAL:=86400}"     # 24h
DIR=/backups
mkdir -p "$DIR"

log() { echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log "iniciado — intervalo ${BACKUP_INTERVAL}s · retenção ${RETENTION_DAYS}d · destino $DIR"

while :; do
  TS=$(date '+%Y%m%d-%H%M%S')
  OUT="$DIR/gestao-$TS.dump"
  if pg_dump -Fc -f "$OUT.part"; then
    mv "$OUT.part" "$OUT"
    log "ok $OUT ($(du -h "$OUT" | cut -f1))"
  else
    log "FALHA no pg_dump"; rm -f "$OUT.part"
  fi
  # retenção: remove dumps mais antigos que RETENTION_DAYS
  removed=$(find "$DIR" -name 'gestao-*.dump' -type f -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
  [ "$removed" -gt 0 ] && log "retenção: $removed dump(s) antigo(s) removido(s)"
  sleep "$BACKUP_INTERVAL"
done
