"""
models.py — schemas pydantic de entrada/saída da API.
"""
from typing import Optional
from datetime import date
from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    """Login por NOME + senha (sem e-mail)."""
    nome: str = Field(min_length=1)
    senha: str = Field(min_length=1)


class TokenOut(BaseModel):
    token: str
    usuario: dict


class BootstrapIn(BaseModel):
    """Criação do PRIMEIRO administrador (só quando o banco está sem usuários)."""
    nome: str = Field(min_length=1)
    senha: str = Field(min_length=1)


class UsuarioIn(BaseModel):
    """Criação de usuários pelo admin — nome + senha (e-mail opcional)."""
    nome: str = Field(min_length=1)
    senha: str = Field(min_length=1)
    papel: Optional[str] = None
    email: Optional[str] = None
    cor: Optional[str] = "#6366f1"
    perfil_acesso: str = Field(default="membro", pattern="^(admin|gestor|membro)$")


class CampanhaIn(BaseModel):
    candidato: str = Field(min_length=1)
    cargo: str = Field(min_length=1)
    localizacao: Optional[str] = None
    partido: Optional[str] = None
    etapa_id: str
    responsavel_id: Optional[str] = None
    progresso: int = Field(default=0, ge=0, le=100)
    prazo: Optional[date] = None
    status: str = Field(default="ativa", pattern="^(ativa|pausada|encerrada)$")
    cor: Optional[str] = "#6366f1"
    descricao: Optional[str] = None
    foto: Optional[str] = None          # data URL (miniatura do candidato)
    anotacoes: Optional[str] = None     # texto livre: notas, links, etc.


class CampanhaUpdate(BaseModel):
    candidato: Optional[str] = None
    cargo: Optional[str] = None
    localizacao: Optional[str] = None
    partido: Optional[str] = None
    etapa_id: Optional[str] = None
    responsavel_id: Optional[str] = None
    progresso: Optional[int] = Field(default=None, ge=0, le=100)
    prazo: Optional[date] = None
    status: Optional[str] = Field(default=None, pattern="^(ativa|pausada|encerrada)$")
    cor: Optional[str] = None
    descricao: Optional[str] = None
    foto: Optional[str] = None
    anotacoes: Optional[str] = None


class CredencialIn(BaseModel):
    titulo: str = Field(min_length=1)
    login: Optional[str] = None
    url: Optional[str] = None
    senha: str = Field(min_length=1)


# ─────────────────── Anotações (pastas / notas / arquivos) ───────────────────
class PastaIn(BaseModel):
    nome: str = Field(min_length=1)


class NotaIn(BaseModel):
    titulo: Optional[str] = "Sem título"
    pasta_id: Optional[str] = None
    blocos: list = []


class NotaUpdate(BaseModel):
    titulo: Optional[str] = None
    pasta_id: Optional[str] = None
    blocos: Optional[list] = None


class ArquivoIn(BaseModel):
    nome: str = Field(min_length=1)
    mime: Optional[str] = None
    pasta_id: Optional[str] = None
    dados_base64: str = Field(min_length=1)


class ArquivoUpdate(BaseModel):
    nome: Optional[str] = None
    pasta_id: Optional[str] = None


class CredencialUpdate(BaseModel):
    titulo: Optional[str] = None
    login: Optional[str] = None
    url: Optional[str] = None
    senha: Optional[str] = None


class MembrosIn(BaseModel):
    usuario_ids: list[str]


class EtiquetaIn(BaseModel):
    nome: str = Field(min_length=1)
    cor: Optional[str] = "#6366f1"


class UsuarioFotoIn(BaseModel):
    """Foto pessoal (data URL) do usuário."""
    foto: Optional[str] = None


# ─────────────────────────── Atividades ───────────────────────────
class ChecklistItemIn(BaseModel):
    texto: str = Field(min_length=1)
    concluido: bool = False
    prazo: Optional[date] = None


class AtividadeIn(BaseModel):
    titulo: str = Field(min_length=1)
    campanha_id: str
    etapa_id: str
    status_id: str = "todo"
    prioridade_id: str = "media"
    responsavel_id: Optional[str] = None
    descricao: Optional[str] = None
    inicio: Optional[date] = None
    prazo: Optional[date] = None
    rotina: bool = False
    etiquetas: list[str] = []                 # ids de etiquetas
    checklist: list[ChecklistItemIn] = []


class AtividadeUpdate(BaseModel):
    titulo: Optional[str] = None
    campanha_id: Optional[str] = None
    etapa_id: Optional[str] = None
    status_id: Optional[str] = None
    prioridade_id: Optional[str] = None
    responsavel_id: Optional[str] = None
    descricao: Optional[str] = None
    inicio: Optional[date] = None
    prazo: Optional[date] = None
    rotina: Optional[bool] = None
    etiquetas: Optional[list[str]] = None     # se enviado, substitui o conjunto


class StatusIn(BaseModel):
    status_id: str
    ordem_coluna: Optional[int] = None


class ComentarioIn(BaseModel):
    texto: str = Field(min_length=1)


class ChecklistIn(BaseModel):
    texto: str = Field(min_length=1)
    prazo: Optional[date] = None


class ChecklistUpdate(BaseModel):
    texto: Optional[str] = None
    concluido: Optional[bool] = None
    prazo: Optional[date] = None
