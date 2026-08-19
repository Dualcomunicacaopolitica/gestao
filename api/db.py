"""
db.py — conexão e helpers de acesso ao PostgreSQL.
Mesma abordagem do sistema de contatos (/2026): psycopg2 + variáveis de ambiente.
"""
import os
import logging
import psycopg2
import psycopg2.extras
from fastapi import HTTPException

log = logging.getLogger("gestao-api.db")

DB = dict(
    host=os.getenv("DB_HOST", "postgres"),
    port=int(os.getenv("DB_PORT", 5432)),
    dbname=os.getenv("DB_NAME", "gestao"),
    user=os.getenv("DB_USER", "dual"),
    password=os.getenv("DB_PASSWORD", "gestao2026"),
)


def get_conn():
    """Abre conexão com o PostgreSQL. Erro claro (503) se indisponível."""
    try:
        return psycopg2.connect(**DB)
    except psycopg2.OperationalError as exc:
        log.error("Falha ao conectar ao banco: %s", exc)
        raise HTTPException(503, f"Banco de dados indisponível: {exc}")


def query(sql, params=None, *, one=False, commit=False):
    """Executa SQL e devolve dict(s). one=True → 1 registro (ou None)."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            if commit:
                conn.commit()
            if cur.description is None:      # comando sem retorno
                return None
            rows = cur.fetchall()
            return (rows[0] if rows else None) if one else rows
    finally:
        conn.close()


def execute(sql, params=None):
    """Executa comando de escrita e devolve RETURNING (se houver)."""
    return query(sql, params, one=True, commit=True)
