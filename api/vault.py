"""
vault.py — cifragem reversível das senhas guardadas por campanha.

Objetivo: as senhas de acesso (redes sociais, etc.) precisam ser REVELADAS,
então não dá para usar hash de mão única. Guardamos cifrado no banco, de forma
que quem tiver acesso só ao banco (ou aos backups do pg_dump) não leia as senhas
em texto puro.

Implementação sem dependências externas (só a stdlib): cifra de fluxo baseada em
HMAC-SHA256 em modo contador (CTR) + autenticação encrypt-then-MAC. A chave vem
de VAULT_KEY (ou, na falta, de JWT_SECRET) — mantenha-a estável em produção,
senão as senhas já gravadas ficam ilegíveis.
"""
import os
import hmac
import hashlib
import base64


def _key() -> bytes:
    raw = os.getenv("VAULT_KEY") or os.getenv("JWT_SECRET") or "gestao-vault-dev"
    return hashlib.sha256(raw.encode("utf-8")).digest()


def _keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < length:
        block = hmac.new(key, nonce + counter.to_bytes(8, "big"), hashlib.sha256).digest()
        out.extend(block)
        counter += 1
    return bytes(out[:length])


def encrypt(plaintext: str) -> str:
    """Cifra e devolve um token base64 (nonce | tag | ciphertext)."""
    key = _key()
    data = (plaintext or "").encode("utf-8")
    nonce = os.urandom(16)
    ct = bytes(a ^ b for a, b in zip(data, _keystream(key, nonce, len(data))))
    tag = hmac.new(key, nonce + ct, hashlib.sha256).digest()[:16]
    return base64.urlsafe_b64encode(nonce + tag + ct).decode("ascii")


def decrypt(token: str) -> str:
    """Decifra o token; ValueError se adulterado ou com chave errada."""
    key = _key()
    blob = base64.urlsafe_b64decode(token.encode("ascii"))
    nonce, tag, ct = blob[:16], blob[16:32], blob[32:]
    expected = hmac.new(key, nonce + ct, hashlib.sha256).digest()[:16]
    if not hmac.compare_digest(tag, expected):
        raise ValueError("Senha cifrada inválida ou chave incorreta")
    data = bytes(a ^ b for a, b in zip(ct, _keystream(key, nonce, len(ct))))
    return data.decode("utf-8")
