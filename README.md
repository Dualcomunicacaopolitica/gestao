# gestao - 

Novo sistema de gestão operacional de campanhas da Dual, na subpasta `gestao/`
do repositório. Frontend do protótipo em [`../prototype`](../prototype); backend
aqui, seguindo a mesma stack e convenções do sistema existente (`../2026`):
**PostgreSQL 16 + FastAPI + Docker**.

- **Endereço de produção:** **https://gestao.dualcomunicacao.com.br** → como ativar em [`DEPLOY.md`](DEPLOY.md)
- **Arquitetura de dados:** [`DATA_ARCHITECTURE.md`](DATA_ARCHITECTURE.md)
- **Esquema do banco (validado no PG16):** [`db/init.sql`](db/init.sql)

> **O banco começa ZERADO** — sem usuários e sem campanhas. Só os dados de
> referência (etapas, status, prioridades, etiquetas) são criados. Tudo o mais
> é criado do zero pela agência, começando pelo primeiro administrador.

## Status

| Etapa | Situação |
|---|---|
| Modelagem de dados + DDL (`init.sql`) | validado no PG16 |
| API — infra, **auth (JWT)**, criação do 1º admin, dashboard, campanhas, equipe | pronto |
| API — CRUD completo de **atividades** (checklist, comentários, mover Kanban) | pronto (34 casos testados via HTTP) |
| `docker-compose.yml` (Postgres separado + API + frontend) | pronto |
| **Frontend integrado à API** (login por nome+senha, dados reais, sem mock) | pronto (15 casos e2e no navegador) |

O sistema completo (login → criar do zero → campanhas, Kanban com drag&drop,
atividades com checklist/comentários) roda contra o banco real. Toda a interface
foi validada ponta a ponta com Playwright (bootstrap do admin pela tela, criação,
mover no Kanban persistindo no backend e persistência após logout/login).

## Como rodar

```bash
cd gestao
cp .env.example .env          # ajuste segredos e (opcional) o 1º admin
docker compose up --build     # postgres (5433) + api (8010)
```

- **Produção:** <https://gestao.dualcomunicacao.com.br>  (ativação em [`DEPLOY.md`](DEPLOY.md))
- **Local (SPA):** <http://localhost:8010/app/>  ·  a raiz `/` redireciona para `/app/`
- API: <http://localhost:8010>  ·  Docs: <http://localhost:8010/docs>

O frontend é servido pela própria API (mesma origem, sem CORS). Na primeira vez,
como o banco está vazio, a tela pede para **criar o primeiro administrador**
(ou já usa `yara` / `1234` se você mantiver o padrão do `.env`).

Para publicar no subdomínio, suba também o reverse proxy:

```bash
docker compose --profile proxy up -d --build   # nginx nas portas 80/443
```

Passo a passo completo (DNS + TLS) em **[`DEPLOY.md`](DEPLOY.md)**.

## Primeiro acesso (criar do zero)

O login é por **nome + senha** (sem e-mail). Como o banco nasce vazio, o
primeiro administrador já vem configurado no `docker-compose`/`.env`:

| Campo | Valor padrão |
|---|---|
| Nome | **yara** |
| Senha | **1234** |

A API cria esse admin automaticamente na primeira subida, **enquanto não houver
nenhum usuário**. Para mudar, ajuste `ADMIN_NOME`/`ADMIN_SENHA` no `.env` antes
de subir (recomendado trocar a senha em produção).

Alternativa — criar o 1º admin pela API (só funciona com o banco sem usuários):

```bash
curl -s localhost:8010/auth/bootstrap -H 'Content-Type: application/json' \
  -d '{"nome":"yara","senha":"1234"}'
```

Depois, logado como admin, criam-se os demais usuários e as campanhas:

```bash
# login por nome + senha → token
curl -s localhost:8010/auth/login -H 'Content-Type: application/json' \
  -d '{"nome":"yara","senha":"1234"}'

# criar um membro (usa o token do admin)
curl -s localhost:8010/usuarios -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Ana Souza","senha":"...", "papel":"Social Media","perfil_acesso":"membro"}'
```

`GET /setup/status` retorna `{"precisa_bootstrap": true}` enquanto o banco não
tiver nenhum usuário — o frontend usa isso para mostrar a tela de "criar 1º admin".

A **agência** ("Dual Comunicação") e o ciclo eleitoral ficam na tabela
`configuracoes` e são servidos em `GET /meta` (campo `config`) para aparecer em
Configurações.

## Endpoints

```
GET  /health
GET  /setup/status                   # precisa criar o 1º admin?
GET  /meta                           # etapas, status, prioridades, etiquetas
POST /auth/bootstrap                 # cria o 1º admin (só com banco sem usuários)
POST /auth/login                     # {email, senha} → {token, usuario}
GET  /auth/me
GET  /dashboard
GET  /campanhas       ?status&etapa&responsavel&busca
POST /campanhas                      # (admin|gestor)
GET  /campanhas/{id}
PUT  /campanhas/{id}                 # (admin|gestor)
DELETE /campanhas/{id}               # (admin)
GET  /campanhas/{id}/atividades
GET  /campanhas/{id}/equipe
PUT  /campanhas/{id}/membros         # (admin|gestor)
POST /usuarios                       # (admin|gestor) — criar usuário
GET  /usuarios
GET  /usuarios/{id}
```

Autenticação **JWT HS256**; senhas em **PBKDF2-HMAC-SHA256** — ambos só com a
biblioteca padrão do Python (sem dependências de compilação).

## Estrutura

```
gestao/
├── DATA_ARCHITECTURE.md
├── docker-compose.yml
├── .env.example
├── db/
│   ├── init.sql          # schema + dados de referência + views + triggers
│   └── gen_seed.mjs      # (OPCIONAL) gera dados de demonstração do mock do protótipo
├── api/
│   ├── main.py           # FastAPI (endpoints) + serve o frontend em /app
│   ├── db.py             # conexão psycopg2
│   ├── auth.py           # PBKDF2 + JWT HS256 (stdlib)
│   ├── models.py         # schemas pydantic
│   ├── requirements.txt
│   └── Dockerfile
└── frontend/             # SPA (HTML/CSS/JS) integrada à API
    ├── index.html
    ├── js/
    │   ├── api.js        # cliente HTTP (JWT)
    │   ├── auth-view.js  # telas de login / criação do 1º admin
    │   ├── data/store.js # cache local hidratado da API (mapeia pt-BR → shape do front)
    │   ├── state.js      # selectors + mutations (chamam a API)
    │   └── views/…       # Campanhas, Kanban, Cronograma, Super Cronograma, Equipe…
    └── styles/…
```

> `db/gen_seed.mjs` é **opcional** (dados fictícios para demonstração). O banco
> de produção começa vazio; só rode o gerador se quiser popular um ambiente de teste.
