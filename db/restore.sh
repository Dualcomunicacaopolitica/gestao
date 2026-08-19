#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# restore.sh — restaura um dump para o banco da gestão.
# USO (a partir de gestao/):
#   ./db/restore.sh backups/gestao-YYYYmmdd-HHMMSS.dump
#
# ⚠️  DESTRUTIVO: sobrescreve os dados atuais do banco.
# Executa via container postgres (não precisa da porta exposta).
# ═══════════════════════════════════════════════════════════
set -euo pipefail

FILE="${1:-}"
DB_USER="${DB_USER:-dual}"
DB_NAME="${DB_NAME:-gestao}"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Uso: ./db/restore.sh <arquivo.dump>"
  echo "Dumps disponíveis:"; ls -1 backups/gestao-*.dump 2>/dev/null || echo "  (nenhum em ./backups)"
  exit 1
fi

echo "⚠️  Isto vai SOBRESCREVER o banco '$DB_NAME' com: $FILE"
printf "Digite 'restaurar' para confirmar: "
read -r ans
[ "$ans" = "restaurar" ] || { echo "Cancelado."; exit 1; }

echo "→ copiando dump para o container…"
docker compose cp "$FILE" postgres:/tmp/restore.dump

echo "→ restaurando (pg_restore --clean --if-exists)…"
docker compose exec -T postgres \
  pg_restore --clean --if-exists --no-owner -U "$DB_USER" -d "$DB_NAME" /tmp/restore.dump

docker compose exec -T postgres rm -f /tmp/restore.dump
echo "✅ Restauração concluída em '$DB_NAME'."
