"""
main.py — Gestão API v0.1 (esqueleto)
=====================================
Backend FastAPI do sistema de gestão operacional de campanhas da Dual.
Mesma stack/estilo do sistema de contatos (/2026): FastAPI + psycopg2 + CORS.

Endpoints desta fase (esqueleto para validação):
  infra   : GET /health, GET /meta
  auth    : POST /auth/login, GET /auth/me
  painel  : GET /dashboard
  campanhas: GET/POST /campanhas, GET/PUT/DELETE /campanhas/{id},
             GET /campanhas/{id}/atividades, GET /campanhas/{id}/equipe,
             PUT /campanhas/{id}/membros
  equipe  : GET /usuarios, GET /usuarios/{id}

Próxima fase: CRUD completo de atividades (checklist, comentários, mover Kanban).
"""
import os
import json
import base64
import logging
from typing import Optional

import psycopg2

from fastapi import FastAPI, Depends, HTTPException, Query, Path, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from db import query, execute
from auth import (verify_password, hash_password, create_token, get_current_user,
                  require_roles, decode_token, revoke_token)
import vault
from models import (
    LoginIn, TokenOut, BootstrapIn, UsuarioIn, EtiquetaIn, UsuarioFotoIn,
    CampanhaIn, CampanhaUpdate, MembrosIn, CredencialIn, CredencialUpdate,
    AtividadeIn, AtividadeUpdate, StatusIn, ComentarioIn, ChecklistIn, ChecklistUpdate,
    PastaIn, NotaIn, NotaUpdate, ArquivoIn, ArquivoUpdate,
)

MAX_ARQUIVO_BYTES = int(os.getenv("MAX_ARQUIVO_MB", "8")) * 1024 * 1024

# Quem pode EXCLUIR campanhas (por nome de login). Configurável via env.
PODEM_EXCLUIR_CAMPANHA = {n.strip().lower() for n in
                          os.getenv("CAMPANHA_DELETE_USERS", "yara,lucas,lari").split(",") if n.strip()}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("gestao-api")

app = FastAPI(title="Gestão de Campanhas API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════ Infra ═══════════════════════════
@app.get("/", include_in_schema=False)
def _root():
    # Raiz do domínio → aplicação (gestao.dualcomunicacao.com.br → /app/)
    return RedirectResponse(url="/app/")


@app.get("/health")
def health():
    try:
        query("SELECT 1", one=True)
        return {"status": "ok", "db": "ok"}
    except HTTPException:
        return {"status": "degraded", "db": "down"}


def _total_usuarios() -> int:
    row = query("SELECT COUNT(*) AS n FROM usuarios", one=True)
    return int(row["n"]) if row else 0


def _criar_usuario(nome, senha, perfil, papel=None, cor="#6366f1", email=None):
    return execute(
        """
        INSERT INTO usuarios (nome, senha_hash, perfil_acesso, papel, cor, email)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id, nome, papel, email, cor, perfil_acesso, ativo
        """,
        (nome, hash_password(senha), perfil, papel, cor, (email.lower() if email else None)),
    )


@app.on_event("startup")
def bootstrap_admin_env():
    """Cria o primeiro admin a partir do .env (ADMIN_NOME/ADMIN_SENHA) se o banco estiver zerado."""
    nome, senha = (os.getenv("ADMIN_NOME"), os.getenv("ADMIN_SENHA"))
    if not (nome and senha):
        return
    try:
        if _total_usuarios() == 0:
            _criar_usuario(nome, senha, "admin")
            log.info("Primeiro administrador criado a partir do .env: %s", nome)
    except Exception as exc:            # banco ainda subindo / indisponível
        log.warning("Bootstrap de admin adiado: %s", exc)


@app.get("/setup/status")
def setup_status():
    """Frontend usa para saber se precisa criar o primeiro admin."""
    return {"precisa_bootstrap": _total_usuarios() == 0}


@app.get("/meta")
def meta():
    """Tabelas de apoio para popular selects no frontend."""
    cfg = query("SELECT chave, valor FROM configuracoes")
    return {
        "etapas": query("SELECT id, nome, apelido, ordem FROM etapas ORDER BY ordem"),
        "status": query("SELECT id, nome, cor, ordem, e_concluido FROM status_kanban ORDER BY ordem"),
        "prioridades": query("SELECT id, nome, cor, peso FROM prioridades ORDER BY peso"),
        "etiquetas": query("SELECT id, nome, cor FROM etiquetas ORDER BY nome"),
        "config": {c["chave"]: c["valor"] for c in (cfg or [])},
    }


@app.post("/etiquetas", status_code=201)
def criar_etiqueta(body: EtiquetaIn, user: dict = Depends(get_current_user)):
    if query("SELECT 1 FROM etiquetas WHERE lower(nome) = lower(%s)", (body.nome,), one=True):
        raise HTTPException(409, "Já existe uma etiqueta com esse nome")
    return execute("INSERT INTO etiquetas (nome, cor) VALUES (%s, %s) RETURNING id, nome, cor",
                   (body.nome.strip(), body.cor or "#6366f1"))


# ═══════════════════════════ Auth ═══════════════════════════
@app.post("/auth/login", response_model=TokenOut)
def login(body: LoginIn):
    user = query(
        "SELECT id, nome, papel, email, cor, perfil_acesso, ativo, foto, senha_hash "
        "FROM usuarios WHERE lower(nome) = lower(%s)",
        (body.nome,), one=True,
    )
    if not user or not user["ativo"] or not verify_password(body.senha, user["senha_hash"]):
        raise HTTPException(401, "Nome ou senha inválidos")
    user.pop("senha_hash", None)
    token = create_token(str(user["id"]), {"perfil": user["perfil_acesso"]})
    return {"token": token, "usuario": user}


@app.post("/auth/bootstrap", response_model=TokenOut, status_code=201)
def bootstrap(body: BootstrapIn):
    """Cria o PRIMEIRO administrador. Só funciona com o banco sem usuários."""
    if _total_usuarios() > 0:
        raise HTTPException(409, "Já existe usuário cadastrado. Use /auth/login.")
    user = _criar_usuario(body.nome, body.senha, "admin")
    token = create_token(str(user["id"]), {"perfil": user["perfil_acesso"]})
    return {"token": token, "usuario": user}


@app.get("/auth/me")
def me(user: dict = Depends(get_current_user)):
    return user


@app.post("/auth/logout")
def logout(authorization: str = Header(default="")):
    """Revoga o token atual (fica inválido no servidor até expirar)."""
    if authorization.lower().startswith("bearer "):
        try:
            revoke_token(decode_token(authorization.split(" ", 1)[1].strip()))
        except HTTPException:
            pass          # token já inválido/expirado — nada a revogar
    return {"ok": True}


# ═══════════════════════════ Dashboard ═══════════════════════════
@app.get("/dashboard")
def dashboard(user: dict = Depends(get_current_user)):
    resumo = query("SELECT * FROM vw_dashboard", one=True) or {}
    return {
        "indicadores": resumo,
        "campanhas": _campanhas_list(),
    }


# ═══════════════════════════ Campanhas ═══════════════════════════
def _campanhas_list(status=None, etapa=None, responsavel=None, busca=None):
    where, params = [], []
    if status:
        where.append("c.status = %s"); params.append(status)
    if etapa:
        where.append("c.etapa_id = %s"); params.append(etapa)
    if responsavel:
        where.append("(c.responsavel_id = %s OR EXISTS "
                     "(SELECT 1 FROM campanha_membros m WHERE m.campanha_id=c.id AND m.usuario_id=%s))")
        params += [responsavel, responsavel]
    if busca:
        where.append("(c.candidato ILIKE %s OR c.cargo ILIKE %s OR c.localizacao ILIKE %s)")
        like = f"%{busca}%"; params += [like, like, like]
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    return query(
        f"""
        SELECT c.*, u.nome AS responsavel_nome, u.cor AS responsavel_cor,
               r.total_atividades, r.concluidas, r.em_andamento, r.em_revisao,
               r.atrasadas, r.entregas_hoje, r.risco,
               e.nome AS etapa_nome, e.ordem AS etapa_ordem,
               (SELECT array_agg(m.usuario_id::text) FROM campanha_membros m WHERE m.campanha_id=c.id) AS membros
        FROM campanhas c
        LEFT JOIN usuarios u ON u.id = c.responsavel_id
        LEFT JOIN etapas e ON e.id = c.etapa_id
        LEFT JOIN vw_campanha_resumo r ON r.campanha_id = c.id
        {clause}
        ORDER BY c.fixa DESC, c.criado_em DESC
        """,
        params,
    )


@app.get("/campanhas")
def listar_campanhas(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    etapa: Optional[str] = None,
    responsavel: Optional[str] = None,
    busca: Optional[str] = None,
):
    return _campanhas_list(status, etapa, responsavel, busca)


@app.post("/campanhas", status_code=201)
def criar_campanha(body: CampanhaIn, user: dict = Depends(get_current_user)):
    row = execute(
        """
        INSERT INTO campanhas (candidato, cargo, localizacao, partido, etapa_id,
                               responsavel_id, progresso, prazo, status, cor, descricao,
                               foto, anotacoes)
        VALUES (%(candidato)s,%(cargo)s,%(localizacao)s,%(partido)s,%(etapa_id)s,
                %(responsavel_id)s,%(progresso)s,%(prazo)s,%(status)s,%(cor)s,%(descricao)s,
                %(foto)s,%(anotacoes)s)
        RETURNING id
        """,
        body.model_dump(),
    )
    if body.responsavel_id:
        execute("INSERT INTO campanha_membros (campanha_id, usuario_id) VALUES (%s,%s) "
                "ON CONFLICT DO NOTHING", (row["id"], body.responsavel_id))
    return get_campanha(row["id"], user)


@app.get("/campanhas/{cid}")
def get_campanha(cid: str = Path(...), user: dict = Depends(get_current_user)):
    c = query(
        """
        SELECT c.*, u.nome AS responsavel_nome, u.cor AS responsavel_cor,
               r.total_atividades, r.concluidas, r.em_andamento, r.em_revisao,
               r.atrasadas, r.entregas_hoje, r.risco, e.nome AS etapa_nome, e.ordem AS etapa_ordem,
               (SELECT array_agg(m.usuario_id::text) FROM campanha_membros m WHERE m.campanha_id=c.id) AS membros
        FROM campanhas c
        LEFT JOIN usuarios u ON u.id = c.responsavel_id
        LEFT JOIN etapas e ON e.id = c.etapa_id
        LEFT JOIN vw_campanha_resumo r ON r.campanha_id = c.id
        WHERE c.id = %s
        """, (cid,), one=True,
    )
    if not c:
        raise HTTPException(404, "Campanha não encontrada")
    c["equipe"] = _campanha_equipe(cid)
    return c


@app.put("/campanhas/{cid}")
def atualizar_campanha(cid: str, body: CampanhaUpdate, user: dict = Depends(get_current_user)):
    fields = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not fields:
        return get_campanha(cid, user)
    sets = ", ".join(f"{k} = %({k})s" for k in fields)
    fields["_id"] = cid
    execute(f"UPDATE campanhas SET {sets} WHERE id = %(_id)s", fields)
    return get_campanha(cid, user)


@app.delete("/campanhas/{cid}", status_code=204)
def excluir_campanha(cid: str, user: dict = Depends(get_current_user)):
    if (user.get("nome") or "").strip().lower() not in PODEM_EXCLUIR_CAMPANHA:
        raise HTTPException(403, "Você não tem permissão para excluir campanhas.")
    c = query("SELECT fixa FROM campanhas WHERE id = %s", (cid,), one=True)
    if not c:
        raise HTTPException(404, "Campanha não encontrada")
    if c["fixa"]:
        raise HTTPException(400, "Esta é uma campanha fixa do sistema e não pode ser excluída.")
    execute("DELETE FROM campanhas WHERE id = %s", (cid,))
    return None


@app.get("/campanhas/{cid}/atividades")
def atividades_da_campanha(cid: str, user: dict = Depends(get_current_user)):
    return query(
        """
        SELECT a.*, s.nome AS status_nome, s.cor AS status_cor,
               p.nome AS prioridade_nome, p.cor AS prioridade_cor,
               e.nome AS etapa_nome, u.nome AS responsavel_nome, u.cor AS responsavel_cor,
               (SELECT COUNT(*) FROM checklist_itens ci WHERE ci.atividade_id=a.id) AS checklist_total,
               (SELECT COUNT(*) FROM checklist_itens ci WHERE ci.atividade_id=a.id AND ci.concluido) AS checklist_feitos
        FROM atividades a
        JOIN status_kanban s ON s.id = a.status_id
        JOIN prioridades p ON p.id = a.prioridade_id
        JOIN etapas e ON e.id = a.etapa_id
        LEFT JOIN usuarios u ON u.id = a.responsavel_id
        WHERE a.campanha_id = %s
        ORDER BY a.ordem_coluna, a.criado_em
        """, (cid,),
    )


def _campanha_equipe(cid: str):
    return query(
        """
        SELECT u.id, u.nome, u.papel, u.cor, m.papel_campanha,
               (u.id = c.responsavel_id) AS e_responsavel
        FROM campanha_membros m
        JOIN usuarios u ON u.id = m.usuario_id
        JOIN campanhas c ON c.id = m.campanha_id
        WHERE m.campanha_id = %s
        ORDER BY e_responsavel DESC, u.nome
        """, (cid,),
    )


@app.get("/campanhas/{cid}/equipe")
def campanha_equipe(cid: str, user: dict = Depends(get_current_user)):
    return _campanha_equipe(cid)


@app.put("/campanhas/{cid}/membros")
def definir_membros(cid: str, body: MembrosIn, user: dict = Depends(require_roles("admin", "gestor"))):
    execute("DELETE FROM campanha_membros WHERE campanha_id = %s", (cid,))
    for uid in body.usuario_ids:
        execute("INSERT INTO campanha_membros (campanha_id, usuario_id) VALUES (%s,%s) "
                "ON CONFLICT DO NOTHING", (cid, uid))
    return _campanha_equipe(cid)


# ─────────── Credenciais / cofre de senhas da campanha ───────────
# As senhas ficam CIFRADAS no banco (vault). A listagem nunca devolve a senha;
# ela só é revelada, decifrada, pelo endpoint /credenciais/{id}/revelar.
@app.get("/campanhas/{cid}/credenciais")
def listar_credenciais(cid: str, user: dict = Depends(get_current_user)):
    return query(
        "SELECT id, titulo, login, url, criado_em, atualizado_em "
        "FROM campanha_credenciais WHERE campanha_id = %s ORDER BY titulo", (cid,))


@app.post("/campanhas/{cid}/credenciais", status_code=201)
def criar_credencial(cid: str, body: CredencialIn, user: dict = Depends(get_current_user)):
    if not query("SELECT 1 FROM campanhas WHERE id = %s", (cid,), one=True):
        raise HTTPException(404, "Campanha não encontrada")
    return execute(
        "INSERT INTO campanha_credenciais (campanha_id, titulo, login, url, senha_cifrada) "
        "VALUES (%s,%s,%s,%s,%s) RETURNING id, titulo, login, url, criado_em, atualizado_em",
        (cid, body.titulo.strip(), body.login, body.url, vault.encrypt(body.senha)))


@app.get("/credenciais/{cred_id}/revelar")
def revelar_credencial(cred_id: str, user: dict = Depends(get_current_user)):
    row = query("SELECT senha_cifrada FROM campanha_credenciais WHERE id = %s", (cred_id,), one=True)
    if not row:
        raise HTTPException(404, "Credencial não encontrada")
    try:
        senha = vault.decrypt(row["senha_cifrada"])
    except Exception:
        raise HTTPException(500, "Não foi possível decifrar a senha (chave do cofre mudou?)")
    return {"senha": senha}


@app.put("/credenciais/{cred_id}")
def atualizar_credencial(cred_id: str, body: CredencialUpdate, user: dict = Depends(get_current_user)):
    campos = body.model_dump(exclude_unset=True)
    if "senha" in campos:
        campos["senha_cifrada"] = vault.encrypt(campos.pop("senha"))
    if not campos:
        raise HTTPException(400, "Nada para atualizar")
    sets = ", ".join(f"{k} = %({k})s" for k in campos) + ", atualizado_em = NOW()"
    campos["_id"] = cred_id
    row = execute(f"UPDATE campanha_credenciais SET {sets} WHERE id = %(_id)s "
                  "RETURNING id, titulo, login, url, criado_em, atualizado_em", campos)
    if not row:
        raise HTTPException(404, "Credencial não encontrada")
    return row


@app.delete("/credenciais/{cred_id}", status_code=204)
def excluir_credencial(cred_id: str, user: dict = Depends(get_current_user)):
    execute("DELETE FROM campanha_credenciais WHERE id = %s", (cred_id,))
    return None


# ─────────────── Anotações: pastas ───────────────
@app.get("/campanhas/{cid}/pastas")
def listar_pastas(cid: str, user: dict = Depends(get_current_user)):
    return query("SELECT id, nome, criado_em FROM campanha_pastas WHERE campanha_id = %s ORDER BY nome", (cid,))


@app.post("/campanhas/{cid}/pastas", status_code=201)
def criar_pasta(cid: str, body: PastaIn, user: dict = Depends(get_current_user)):
    if not query("SELECT 1 FROM campanhas WHERE id = %s", (cid,), one=True):
        raise HTTPException(404, "Campanha não encontrada")
    return execute("INSERT INTO campanha_pastas (campanha_id, nome) VALUES (%s,%s) RETURNING id, nome, criado_em",
                   (cid, body.nome.strip()))


@app.put("/pastas/{pid}")
def renomear_pasta(pid: str, body: PastaIn, user: dict = Depends(get_current_user)):
    row = execute("UPDATE campanha_pastas SET nome = %s WHERE id = %s RETURNING id, nome, criado_em",
                  (body.nome.strip(), pid))
    if not row:
        raise HTTPException(404, "Pasta não encontrada")
    return row


@app.delete("/pastas/{pid}", status_code=204)
def excluir_pasta(pid: str, user: dict = Depends(get_current_user)):
    # notas/arquivos da pasta voltam para a raiz (ON DELETE SET NULL)
    execute("DELETE FROM campanha_pastas WHERE id = %s", (pid,))
    return None


# ─────────────── Anotações: notas (blocos) ───────────────
def _preview(blocos):
    for b in (blocos or []):
        t = (b.get("texto") or "").strip() if isinstance(b, dict) else ""
        if t:
            return t[:160]
    return ""


@app.get("/campanhas/{cid}/notas")
def listar_notas(cid: str, pasta: Optional[str] = None, user: dict = Depends(get_current_user)):
    if pasta:
        rows = query("SELECT id, titulo, pasta_id, blocos, atualizado_em FROM campanha_notas "
                     "WHERE campanha_id = %s AND pasta_id = %s ORDER BY atualizado_em DESC", (cid, pasta))
    else:
        rows = query("SELECT id, titulo, pasta_id, blocos, atualizado_em FROM campanha_notas "
                     "WHERE campanha_id = %s AND pasta_id IS NULL ORDER BY atualizado_em DESC", (cid,))
    for r in rows or []:
        r["preview"] = _preview(r.pop("blocos", None))
    return rows


@app.get("/notas/{nid}")
def get_nota(nid: str, user: dict = Depends(get_current_user)):
    n = query("SELECT id, campanha_id, pasta_id, titulo, blocos, atualizado_em FROM campanha_notas WHERE id = %s",
              (nid,), one=True)
    if not n:
        raise HTTPException(404, "Nota não encontrada")
    return n


@app.post("/campanhas/{cid}/notas", status_code=201)
def criar_nota(cid: str, body: NotaIn, user: dict = Depends(get_current_user)):
    if not query("SELECT 1 FROM campanhas WHERE id = %s", (cid,), one=True):
        raise HTTPException(404, "Campanha não encontrada")
    return execute(
        "INSERT INTO campanha_notas (campanha_id, pasta_id, titulo, blocos) VALUES (%s,%s,%s,%s) "
        "RETURNING id, campanha_id, pasta_id, titulo, blocos, atualizado_em",
        (cid, body.pasta_id, (body.titulo or "Sem título").strip() or "Sem título", json.dumps(body.blocos or [])))


@app.put("/notas/{nid}")
def atualizar_nota(nid: str, body: NotaUpdate, user: dict = Depends(get_current_user)):
    campos = body.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(400, "Nada para atualizar")
    if "blocos" in campos:
        campos["blocos"] = json.dumps(campos["blocos"] or [])
    sets = ", ".join(f"{k} = %({k})s" for k in campos)
    campos["_id"] = nid
    row = execute(f"UPDATE campanha_notas SET {sets} WHERE id = %(_id)s "
                  "RETURNING id, campanha_id, pasta_id, titulo, blocos, atualizado_em", campos)
    if not row:
        raise HTTPException(404, "Nota não encontrada")
    return row


@app.delete("/notas/{nid}", status_code=204)
def excluir_nota(nid: str, user: dict = Depends(get_current_user)):
    execute("DELETE FROM campanha_notas WHERE id = %s", (nid,))
    return None


# ─────────────── Anotações: arquivos ───────────────
@app.get("/campanhas/{cid}/arquivos")
def listar_arquivos(cid: str, pasta: Optional[str] = None, user: dict = Depends(get_current_user)):
    base = ("SELECT a.id, a.nome, a.mime, a.tamanho, a.pasta_id, a.criado_em, "
            "a.enviado_por, u.nome AS enviado_por_nome "
            "FROM campanha_arquivos a LEFT JOIN usuarios u ON u.id = a.enviado_por "
            "WHERE a.campanha_id = %s ")
    if pasta:
        return query(base + "AND a.pasta_id = %s ORDER BY a.criado_em DESC", (cid, pasta))
    return query(base + "AND a.pasta_id IS NULL ORDER BY a.criado_em DESC", (cid,))


@app.post("/campanhas/{cid}/arquivos", status_code=201)
def enviar_arquivo(cid: str, body: ArquivoIn, user: dict = Depends(get_current_user)):
    if not query("SELECT 1 FROM campanhas WHERE id = %s", (cid,), one=True):
        raise HTTPException(404, "Campanha não encontrada")
    raw = body.dados_base64
    if "," in raw[:64] and raw[:5].lower() == "data:":
        raw = raw.split(",", 1)[1]                       # tira o prefixo data:...;base64,
    try:
        blob = base64.b64decode(raw)
    except Exception:
        raise HTTPException(400, "Arquivo inválido (base64)")
    if len(blob) > MAX_ARQUIVO_BYTES:
        raise HTTPException(413, f"Arquivo muito grande. Limite de {MAX_ARQUIVO_BYTES // (1024*1024)} MB por arquivo.")
    return execute(
        "INSERT INTO campanha_arquivos (campanha_id, pasta_id, nome, mime, tamanho, dados, enviado_por) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id, nome, mime, tamanho, pasta_id, criado_em, enviado_por",
        (cid, body.pasta_id, body.nome.strip(), body.mime, len(blob), psycopg2.Binary(blob), user["id"]))


@app.get("/arquivos/{aid}/download")
def baixar_arquivo(aid: str, user: dict = Depends(get_current_user)):
    row = query("SELECT nome, mime, dados FROM campanha_arquivos WHERE id = %s", (aid,), one=True)
    if not row:
        raise HTTPException(404, "Arquivo não encontrado")
    dados = row["dados"]
    if isinstance(dados, memoryview):
        dados = dados.tobytes()
    return Response(
        content=bytes(dados),
        media_type=row["mime"] or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{row["nome"]}"'},
    )


@app.put("/arquivos/{aid}")
def atualizar_arquivo(aid: str, body: ArquivoUpdate, user: dict = Depends(get_current_user)):
    campos = body.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(400, "Nada para atualizar")
    sets = ", ".join(f"{k} = %({k})s" for k in campos)
    campos["_id"] = aid
    row = execute(f"UPDATE campanha_arquivos SET {sets} WHERE id = %(_id)s "
                  "RETURNING id, nome, mime, tamanho, pasta_id, criado_em, enviado_por", campos)
    if not row:
        raise HTTPException(404, "Arquivo não encontrado")
    return row


@app.delete("/arquivos/{aid}", status_code=204)
def excluir_arquivo(aid: str, user: dict = Depends(get_current_user)):
    execute("DELETE FROM campanha_arquivos WHERE id = %s", (aid,))
    return None


# ═══════════════════════════ Atividades ═══════════════════════════
_ATIV_BASE = """
    SELECT a.*, s.nome AS status_nome, s.cor AS status_cor,
           p.nome AS prioridade_nome, p.cor AS prioridade_cor,
           e.nome AS etapa_nome, e.ordem AS etapa_ordem,
           u.nome AS responsavel_nome, u.cor AS responsavel_cor,
           c.candidato AS campanha_nome, c.cor AS campanha_cor,
           (SELECT COUNT(*) FROM checklist_itens ci WHERE ci.atividade_id=a.id) AS checklist_total,
           (SELECT COUNT(*) FROM checklist_itens ci WHERE ci.atividade_id=a.id AND ci.concluido) AS checklist_feitos,
           (SELECT array_agg(ae.etiqueta_id::text) FROM atividade_etiquetas ae WHERE ae.atividade_id=a.id) AS etiqueta_ids,
           (a.status_id <> 'done' AND a.prazo < CURRENT_DATE) AS atrasada
    FROM atividades a
    JOIN status_kanban s ON s.id = a.status_id
    JOIN prioridades p ON p.id = a.prioridade_id
    JOIN etapas e ON e.id = a.etapa_id
    JOIN campanhas c ON c.id = a.campanha_id
    LEFT JOIN usuarios u ON u.id = a.responsavel_id
"""


def _hist(ativ_id, autor_id, tipo, descricao, dados=None):
    execute(
        "INSERT INTO atividade_historico (atividade_id, autor_id, tipo, descricao, dados) "
        "VALUES (%s,%s,%s,%s,%s)",
        (ativ_id, autor_id, tipo, descricao, json.dumps(dados) if dados is not None else None),
    )


def _set_etiquetas(ativ_id, etiqueta_ids):
    execute("DELETE FROM atividade_etiquetas WHERE atividade_id = %s", (ativ_id,))
    for eid in etiqueta_ids or []:
        execute("INSERT INTO atividade_etiquetas (atividade_id, etiqueta_id) VALUES (%s,%s) "
                "ON CONFLICT DO NOTHING", (ativ_id, eid))


@app.get("/atividades")
def listar_atividades(
    user: dict = Depends(get_current_user),
    campanha: Optional[str] = None, responsavel: Optional[str] = None,
    status: Optional[str] = None, prioridade: Optional[str] = None,
    etiqueta: Optional[str] = None, de: Optional[str] = None, ate: Optional[str] = None,
):
    where, params = [], []
    if campanha:
        where.append("a.campanha_id = %s"); params.append(campanha)
    if responsavel:
        where.append("a.responsavel_id = %s"); params.append(responsavel)
    if status:
        where.append("a.status_id = %s"); params.append(status)
    if prioridade:
        where.append("a.prioridade_id = %s"); params.append(prioridade)
    if etiqueta:
        where.append("EXISTS (SELECT 1 FROM atividade_etiquetas ae WHERE ae.atividade_id=a.id AND ae.etiqueta_id=%s)")
        params.append(etiqueta)
    if de:
        where.append("a.prazo >= %s"); params.append(de)
    if ate:
        where.append("a.prazo <= %s"); params.append(ate)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    return query(_ATIV_BASE + clause + " ORDER BY a.ordem_coluna, a.criado_em", params)


def _atividade_detalhe(aid: str):
    a = query(_ATIV_BASE + " WHERE a.id = %s", (aid,), one=True)
    if not a:
        raise HTTPException(404, "Atividade não encontrada")
    a["etiquetas"] = query(
        "SELECT e.id, e.nome, e.cor FROM atividade_etiquetas ae "
        "JOIN etiquetas e ON e.id = ae.etiqueta_id WHERE ae.atividade_id = %s ORDER BY e.nome", (aid,))
    a["checklist"] = query(
        "SELECT id, texto, concluido, prazo, ordem FROM checklist_itens WHERE atividade_id = %s ORDER BY ordem, criado_em", (aid,))
    a["comentarios"] = query(
        "SELECT c.id, c.texto, c.criado_em, c.autor_id, u.nome AS autor_nome, u.cor AS autor_cor "
        "FROM comentarios c LEFT JOIN usuarios u ON u.id = c.autor_id "
        "WHERE c.atividade_id = %s ORDER BY c.criado_em", (aid,))
    a["historico"] = query(
        "SELECT h.id, h.tipo, h.descricao, h.criado_em, h.autor_id, u.nome AS autor_nome "
        "FROM atividade_historico h LEFT JOIN usuarios u ON u.id = h.autor_id "
        "WHERE h.atividade_id = %s ORDER BY h.criado_em DESC", (aid,))
    return a


@app.get("/atividades/{aid}")
def get_atividade(aid: str, user: dict = Depends(get_current_user)):
    return _atividade_detalhe(aid)


@app.post("/atividades", status_code=201)
def criar_atividade(body: AtividadeIn, user: dict = Depends(get_current_user)):
    row = execute(
        """
        INSERT INTO atividades (titulo, campanha_id, etapa_id, status_id, prioridade_id,
                                responsavel_id, descricao, inicio, prazo, rotina,
                                ordem_coluna)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                COALESCE((SELECT MAX(ordem_coluna)+1 FROM atividades WHERE status_id=%s AND campanha_id=%s), 0))
        RETURNING id
        """,
        (body.titulo, body.campanha_id, body.etapa_id, body.status_id, body.prioridade_id,
         body.responsavel_id, body.descricao, body.inicio, body.prazo, body.rotina,
         body.status_id, body.campanha_id),
    )
    aid = row["id"]
    _set_etiquetas(aid, body.etiquetas)
    for i, ck in enumerate(body.checklist):
        execute("INSERT INTO checklist_itens (atividade_id, texto, concluido, prazo, ordem) VALUES (%s,%s,%s,%s,%s)",
                (aid, ck.texto, ck.concluido, ck.prazo, i))
    _hist(aid, user["id"], "criada", "Atividade criada")
    return _atividade_detalhe(aid)


@app.put("/atividades/{aid}")
def atualizar_atividade(aid: str, body: AtividadeUpdate, user: dict = Depends(get_current_user)):
    atual = query("SELECT * FROM atividades WHERE id = %s", (aid,), one=True)
    if not atual:
        raise HTTPException(404, "Atividade não encontrada")
    campos = body.model_dump(exclude_unset=True)
    etiquetas = campos.pop("etiquetas", None)
    notas = []
    rotulos = {"status_id": "Status", "responsavel_id": "Responsável", "prazo": "Prazo",
               "etapa_id": "Etapa", "prioridade_id": "Prioridade", "titulo": "Título", "rotina": "Rotina"}
    if campos:
        sets = ", ".join(f"{k} = %({k})s" for k in campos)
        for k, v in campos.items():
            if str(atual.get(k)) != str(v) and k in rotulos:
                notas.append(f"{rotulos[k]} alterado")
        campos["_id"] = aid
        execute(f"UPDATE atividades SET {sets} WHERE id = %(_id)s", campos)
    if etiquetas is not None:
        _set_etiquetas(aid, etiquetas)
        notas.append("Etiquetas atualizadas")
    _hist(aid, user["id"], "editada", " · ".join(notas) if notas else "Atividade atualizada")
    return _atividade_detalhe(aid)


@app.patch("/atividades/{aid}/status")
def mover_atividade(aid: str, body: StatusIn, user: dict = Depends(get_current_user)):
    atual = query("SELECT status_id FROM atividades WHERE id = %s", (aid,), one=True)
    if not atual:
        raise HTTPException(404, "Atividade não encontrada")
    de = query("SELECT nome FROM status_kanban WHERE id = %s", (atual["status_id"],), one=True)
    para = query("SELECT nome FROM status_kanban WHERE id = %s", (body.status_id,), one=True)
    if not para:
        raise HTTPException(400, "Status inválido")
    execute("UPDATE atividades SET status_id = %s, ordem_coluna = COALESCE(%s, ordem_coluna) WHERE id = %s",
            (body.status_id, body.ordem_coluna, aid))
    if atual["status_id"] != body.status_id:
        _hist(aid, user["id"], "status", f"Status: {de['nome']} → {para['nome']}",
              {"de": atual["status_id"], "para": body.status_id})
    return _atividade_detalhe(aid)


@app.delete("/atividades/{aid}", status_code=204)
def excluir_atividade(aid: str, user: dict = Depends(get_current_user)):
    execute("DELETE FROM atividades WHERE id = %s", (aid,))
    return None


@app.post("/atividades/{aid}/comentarios", status_code=201)
def comentar(aid: str, body: ComentarioIn, user: dict = Depends(get_current_user)):
    if not query("SELECT 1 FROM atividades WHERE id = %s", (aid,), one=True):
        raise HTTPException(404, "Atividade não encontrada")
    row = execute(
        "INSERT INTO comentarios (atividade_id, autor_id, texto) VALUES (%s,%s,%s) "
        "RETURNING id, texto, criado_em, autor_id", (aid, user["id"], body.texto))
    row["autor_nome"] = user["nome"]
    row["autor_cor"] = user["cor"]
    return row


@app.post("/atividades/{aid}/checklist", status_code=201)
def add_checklist(aid: str, body: ChecklistIn, user: dict = Depends(get_current_user)):
    if not query("SELECT 1 FROM atividades WHERE id = %s", (aid,), one=True):
        raise HTTPException(404, "Atividade não encontrada")
    return execute(
        "INSERT INTO checklist_itens (atividade_id, texto, prazo, ordem) "
        "VALUES (%s,%s,%s,COALESCE((SELECT MAX(ordem)+1 FROM checklist_itens WHERE atividade_id=%s),0)) "
        "RETURNING id, texto, concluido, prazo, ordem", (aid, body.texto, body.prazo, aid))


@app.patch("/checklist/{item_id}")
def upd_checklist(item_id: str, body: ChecklistUpdate, user: dict = Depends(get_current_user)):
    campos = body.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(400, "Nada para atualizar")
    sets = ", ".join(f"{k} = %({k})s" for k in campos)
    campos["_id"] = item_id
    row = execute(f"UPDATE checklist_itens SET {sets} WHERE id = %(_id)s "
                  "RETURNING id, texto, concluido, prazo, ordem", campos)
    if not row:
        raise HTTPException(404, "Item não encontrado")
    return row


@app.delete("/checklist/{item_id}", status_code=204)
def del_checklist(item_id: str, user: dict = Depends(get_current_user)):
    execute("DELETE FROM checklist_itens WHERE id = %s", (item_id,))
    return None


# ═══════════════════════════ Equipe ═══════════════════════════
@app.post("/usuarios", status_code=201)
def criar_usuario(body: UsuarioIn, user: dict = Depends(require_roles("admin", "gestor"))):
    if query("SELECT 1 FROM usuarios WHERE lower(nome)=lower(%s)", (body.nome,), one=True):
        raise HTTPException(409, "Já existe um usuário com esse nome")
    return _criar_usuario(body.nome, body.senha, body.perfil_acesso, body.papel,
                          body.cor or "#6366f1", body.email)


@app.get("/usuarios")
def listar_usuarios(user: dict = Depends(get_current_user)):
    return query(
        """
        SELECT u.id, u.nome, u.papel, u.email, u.cor, u.perfil_acesso, u.ativo, u.foto,
               g.total_tarefas, g.atrasadas, g.em_andamento, g.campanhas
        FROM usuarios u
        LEFT JOIN vw_carga_equipe g ON g.usuario_id = u.id
        WHERE u.ativo
        ORDER BY u.nome
        """
    )


@app.get("/usuarios/{uid}")
def get_usuario(uid: str, user: dict = Depends(get_current_user)):
    u = query(
        """
        SELECT u.id, u.nome, u.papel, u.email, u.cor, u.perfil_acesso, u.ativo, u.foto,
               g.total_tarefas, g.atrasadas, g.em_andamento, g.campanhas
        FROM usuarios u
        LEFT JOIN vw_carga_equipe g ON g.usuario_id = u.id
        WHERE u.id = %s
        """, (uid,), one=True,
    )
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    u["campanhas_lista"] = query(
        """
        SELECT DISTINCT c.id, c.candidato, c.cargo, c.cor, r.risco
        FROM campanhas c
        JOIN campanha_membros m ON m.campanha_id = c.id
        LEFT JOIN vw_campanha_resumo r ON r.campanha_id = c.id
        WHERE m.usuario_id = %s
        ORDER BY c.candidato
        """, (uid,),
    )
    return u


@app.patch("/usuarios/{uid}/foto")
def atualizar_foto_usuario(uid: str, body: UsuarioFotoIn, user: dict = Depends(get_current_user)):
    """Foto pessoal do usuário. O próprio usuário ou um admin/gestor pode alterar."""
    if str(user["id"]) != str(uid) and user.get("perfil_acesso") not in ("admin", "gestor"):
        raise HTTPException(403, "Sem permissão para alterar a foto deste usuário")
    row = execute("UPDATE usuarios SET foto = %s WHERE id = %s RETURNING id, nome, cor, foto",
                  (body.foto, uid))
    if not row:
        raise HTTPException(404, "Usuário não encontrado")
    return row


# ═══════════════════════════ Frontend (estático) ═══════════════════════════
# Serve a SPA integrada em /app (mesma origem da API → sem CORS).
_FRONT = os.getenv("FRONTEND_DIR", os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.isdir(_FRONT):
    app.mount("/app", StaticFiles(directory=_FRONT, html=True), name="frontend")
    log.info("Frontend servido de %s em /app", _FRONT)
