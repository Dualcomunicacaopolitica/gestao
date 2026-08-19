"""
auth.py — autenticação sem dependências externas de compilação.

  • Senha: PBKDF2-HMAC-SHA256 (hashlib) no formato
        pbkdf2_sha256$<iteracoes>$<salt_b64>$<hash_b64>
  • Token: JWT HS256 implementado com hmac/hashlib (stdlib).

Compatível com os hashes gerados pelo seed (backend/db/gen_seed.mjs).
"""
import os
import time
import hmac
import json
import base64
import hashlib
from typing import Optional

from fastapi import Depends, HTTPException, Header

from db import query

PBKDF2_ITERS = 120_000
PBKDF2_KEYLEN = 32
JWT_SECRET = os.getenv("JWT_SECRET", "troque-este-segredo-em-producao")
JWT_TTL = int(os.getenv("JWT_TTL_SECONDS", 60 * 60 * 8))    # 8h (jornada)


# ─────────────────────────── Senha ───────────────────────────
def hash_password(pw: str) -> str:
    # base64 padrão (igual ao node toString('base64') usado no seed)
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, PBKDF2_ITERS, PBKDF2_KEYLEN)
    return (f"pbkdf2_sha256${PBKDF2_ITERS}$"
            f"{base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}")


def verify_password(pw: str, stored: Optional[str]) -> bool:
    if not stored:
        return False
    try:
        algo, iters, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, int(iters), len(expected))
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


# ─────────────────────────── JWT HS256 ───────────────────────────
def _sign(msg: bytes) -> bytes:
    return hmac.new(JWT_SECRET.encode(), msg, hashlib.sha256).digest()


def create_token(sub: str, extra: Optional[dict] = None) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {"sub": sub, "iat": now, "exp": now + JWT_TTL, "jti": b64(os.urandom(9))}
    if extra:
        payload.update(extra)
    seg = b64(json.dumps(header, separators=(",", ":")).encode()) + "." + \
          b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = b64(_sign(seg.encode()))
    return seg + "." + sig


def decode_token(token: str) -> dict:
    try:
        seg, sig = token.rsplit(".", 1)
        if not hmac.compare_digest(b64(_sign(seg.encode())), sig):
            raise ValueError("assinatura inválida")
        payload = json.loads(ub64(seg.split(".", 1)[1]))
        if payload.get("exp", 0) < int(time.time()):
            raise ValueError("token expirado")
        return payload
    except Exception as exc:
        raise HTTPException(401, f"Token inválido: {exc}")


# ─────────────────────── Dependências FastAPI ───────────────────────
def revoke_token(payload: dict) -> None:
    """Registra o token como revogado (logout) e limpa os expirados."""
    jti, exp = payload.get("jti"), payload.get("exp")
    if not jti or not exp:
        return
    from db import execute
    execute("INSERT INTO tokens_revogados (jti, expira_em) VALUES (%s, to_timestamp(%s)) "
            "ON CONFLICT (jti) DO NOTHING", (jti, exp))
    execute("DELETE FROM tokens_revogados WHERE expira_em < now()")


def _is_revoked(jti: str) -> bool:
    return bool(jti and query("SELECT 1 FROM tokens_revogados WHERE jti = %s", (jti,), one=True))


def get_current_user(authorization: str = Header(default="")) -> dict:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Credenciais ausentes")
    payload = decode_token(authorization.split(" ", 1)[1].strip())
    if _is_revoked(payload.get("jti")):
        raise HTTPException(401, "Sessão encerrada")
    user = query(
        "SELECT id, nome, papel, email, cor, perfil_acesso, ativo, foto FROM usuarios WHERE id = %s",
        (payload["sub"],), one=True,
    )
    if not user or not user["ativo"]:
        raise HTTPException(401, "Usuário inválido ou inativo")
    return user


def require_roles(*roles):
    def dep(user: dict = Depends(get_current_user)) -> dict:
        if roles and user["perfil_acesso"] not in roles:
            raise HTTPException(403, "Permissão insuficiente")
        return user
    return dep


# ─────────────────────────── base64url ───────────────────────────
def b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def ub64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
