#!/bin/sh
# ═══════════════════════════════════════════════════════════
# 02-security.sh — cria a role de APLICAÇÃO com privilégios só DML
# (SELECT/INSERT/UPDATE/DELETE) e garante a tabela tokens_revogados.
#
# • Em bancos NOVOS: roda automaticamente após 01-init.sql.
# • Em bancos EXISTENTES: rode uma vez manualmente
#     docker compose exec postgres sh /docker-entrypoint-initdb.d/02-security.sh
#
# A API conecta como esta role (APP_DB_USER) — não mais como dono do banco.
# Requer APP_DB_USER / APP_DB_PASSWORD no ambiente do container postgres.
# Evite aspas simples na senha.
# ═══════════════════════════════════════════════════════════
set -e
APP_USER="${APP_DB_USER:-gestao_app}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD não definido no ambiente}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
-- garante a tabela de tokens revogados (idempotente, p/ bancos já existentes)
CREATE TABLE IF NOT EXISTS tokens_revogados (
    jti        TEXT PRIMARY KEY,
    expira_em  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tokens_exp ON tokens_revogados(expira_em);

-- role de aplicação: LOGIN, sem SUPERUSER, sem CREATE (não faz DDL)
DO \$do\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_USER}') THEN
    CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_DB_PASSWORD}';
  ELSE
    ALTER ROLE ${APP_USER} LOGIN PASSWORD '${APP_DB_PASSWORD}';
  END IF;
END \$do\$;

GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_USER};
GRANT USAGE ON SCHEMA public TO ${APP_USER};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_USER};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_USER};
-- objetos futuros criados pelo dono também já saem com DML para a role
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${APP_USER};
SQL

echo "[init] role de aplicação '${APP_USER}' (só DML) e tokens_revogados prontos."
