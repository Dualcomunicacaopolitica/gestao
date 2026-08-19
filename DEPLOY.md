# Ativar o subdomínio `gestao.dualcomunicacao.com.br`

Guia para publicar o sistema de gestão no subdomínio da Dual.

O sistema é servido pela própria API (a SPA fica em `/app` e a raiz `/`
redireciona para `/app/`). Um **nginx reverse-proxy** (serviço `proxy` do
`docker-compose`, no perfil `proxy`) recebe o subdomínio e encaminha tudo para o
container `gestao-api`.

```
Internet ──▶ gestao.dualcomunicacao.com.br ──▶ nginx (proxy) ──▶ gestao-api:8000 ──▶ Postgres
                                              (portas 80/443)      (SPA em /app + API)
```

Pré-requisitos: um servidor (VPS) com **Docker + Docker Compose**, portas **80 e
443** livres, e acesso ao DNS de `dualcomunicacao.com.br`.

---

## 1. Apontar o DNS

No painel de DNS do domínio `dualcomunicacao.com.br`, crie um registro:

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| `A` | `gestao` | IP público do servidor | 300 |

(Se o servidor tiver IPv6, crie também um `AAAA`.)

Confirme a propagação:

```bash
dig +short gestao.dualcomunicacao.com.br
# deve retornar o IP do servidor
```

> **Usando Cloudflare?** Veja o atalho na seção 6 — nesse caso o TLS fica no
> Cloudflare e você pode pular a emissão de certificado local.

---

## 2. Subir a aplicação

No servidor, dentro de `campanha-2026/gestao`:

```bash
cp .env.example .env
# edite o .env (veja a seção 5): JWT_SECRET, ADMIN_*, CORS_ORIGINS
docker compose up -d --build          # postgres + api (porta interna 8010)
```

Verifique:

```bash
curl -s localhost:8010/health          # {"status":"ok","db":"ok"}
```

---

## 3. Ligar o proxy do subdomínio (HTTP)

```bash
docker compose --profile proxy up -d --build proxy
```

Teste pelo domínio (ainda em HTTP):

```bash
curl -sI http://gestao.dualcomunicacao.com.br/        # 302 → /app/
```

Abrindo `http://gestao.dualcomunicacao.com.br` no navegador já deve aparecer a
tela de **criar o primeiro administrador** (banco vazio).

---

## 4. Emitir o certificado TLS (HTTPS)

Com o DNS apontando e o proxy no ar na porta 80, emita o certificado
Let's Encrypt (webroot). Rode a partir de `campanha-2026/gestao`:

```bash
docker run --rm \
  -v "$PWD/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$PWD/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d gestao.dualcomunicacao.com.br \
  --email equipe@dualcomunicacao.com.br --agree-tos --no-eff-email
```

Depois, em `nginx/gestao.conf`:

1. **descomente** o bloco `server { listen 443 ssl … }`;
2. no bloco da porta 80, **descomente** a linha
   `location / { return 301 https://$host$request_uri; }` (força HTTPS) e
   comente o `location /` de proxy do HTTP.

Recarregue o nginx:

```bash
docker compose --profile proxy restart proxy
curl -sI https://gestao.dualcomunicacao.com.br/       # 302 → /app/ (agora em HTTPS)
```

### Renovação automática

O certificado vale 90 dias. Agende a renovação (ex.: cron semanal):

```bash
# /etc/cron.d/gestao-certbot  (exemplo — ajuste o caminho do projeto)
0 3 * * 1  cd /opt/campanha-2026/gestao && \
  docker run --rm -v "$PWD/nginx/certbot/conf:/etc/letsencrypt" \
    -v "$PWD/nginx/certbot/www:/var/www/certbot" certbot/certbot renew --quiet && \
  docker compose --profile proxy exec -T proxy nginx -s reload
```

---

## 5. Configuração de produção (`.env`)

```env
# Segurança
JWT_SECRET=<gere-um-segredo-forte>            # ex.: openssl rand -hex 32
CORS_ORIGINS=https://gestao.dualcomunicacao.com.br
PUBLIC_URL=https://gestao.dualcomunicacao.com.br

# Primeiro administrador (login por nome + senha). TROQUE a senha!
ADMIN_NOME=yara
ADMIN_SENHA=<senha-forte>

# Banco
DB_PASSWORD=<senha-forte-do-postgres>
```

Após editar, aplique:

```bash
docker compose up -d
```

> O primeiro admin só é criado enquanto o banco estiver **sem usuários**.
> Se preferir, deixe `ADMIN_*` em branco e crie pelo próprio site (tela de
> "criar administrador") no primeiro acesso.

---

## 5b. Publicação na infra da Dual (Traefik) — recomendado neste servidor

O servidor da Dual já roda um **Traefik** (rede `host`, portas 80/443) roteando os
outros domínios (`contatos`, `zapnews`, `painel`, `timetop`…) com TLS automático.
Aqui **não** se usa o serviço `proxy` deste projeto — em vez disso, o
`gestao-api` é publicado por labels do Traefik, já incluídas em
[`docker-compose.override.yml`](docker-compose.override.yml):

```yaml
services:
  api:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.gestao.entrypoints=websecure"
      - "traefik.http.routers.gestao.rule=Host(`gestao.dualcomunicacao.com.br`)"
      - "traefik.http.routers.gestao.tls.certresolver=letsencrypt"
      - "traefik.http.services.gestao.loadbalancer.server.port=8000"
```

Passos no servidor (dentro de `campanha-2026/gestao`):

```bash
# 1) DNS: registro A de "gestao" apontando para o IP do servidor (já feito)
dig +short gestao.dualcomunicacao.com.br A

# 2) porta de host livre para a API (o override não depende dela; é só p/ acesso direto)
echo "API_PORT=8090" >> .env    # ou edite o .env

# 3) sobe/recria o gestao-api já com as labels do Traefik
docker compose up -d

# 4) aguarde ~30s (emissão do certificado) e teste
curl -sI https://gestao.dualcomunicacao.com.br/     # 302 → /app/
```

O Traefik detecta o container, cria a rota e emite o certificado Let's Encrypt
automaticamente (mesmo `certresolver=letsencrypt` dos demais serviços).

## 5c. Backup e restauração

O stack inclui um serviço **`backup`** que roda `pg_dump` (formato custom,
comprimido) a cada `BACKUP_INTERVAL` e mantém os dumps dos últimos
`RETENTION_DAYS` em `gestao/backups/`. Sobe junto com o resto:

```bash
docker compose up -d
docker compose logs -f backup      # acompanha; o 1º dump sai logo na subida
ls -lh backups/                    # gestao-YYYYmmdd-HHMMSS.dump
```

Ajuste no `.env` (padrão: 24h / 14 dias):

```env
BACKUP_INTERVAL=86400   # segundos entre dumps
RETENTION_DAYS=14       # retenção
```

> **Leve os dumps para fora do servidor.** Um backup no mesmo disco não protege
> contra perda do disco. Sincronize `gestao/backups/` para outro local
> (ex.: `rclone`/`rsync` para storage externo) via cron.

### Restaurar

```bash
./db/restore.sh backups/gestao-20260812-030000.dump
```

O script copia o dump para o container e roda
`pg_restore --clean --if-exists` (⚠️ **sobrescreve** o banco atual; pede
confirmação). Restauração validada em PostgreSQL 16 — tanto para um banco novo
quanto por cima do banco existente, com as views voltando a funcionar.

Backup avulso, sob demanda:

```bash
docker compose exec backup sh -c 'pg_dump -Fc -f /backups/gestao-manual-$(date +%F).dump'
```

## 5d. Endurecimento: role restrita, CORS e sessões

A API passa a conectar no banco com uma **role de aplicação só-DML**
(`gestao_app`) — não mais como dono do banco. Também: **CORS travado** no
domínio, **TTL do JWT** reduzido para 8h e **logout com revogação** (o token
fica inválido no servidor até expirar).

Em **instalação nova** nada precisa ser feito — `02-security.sh` roda sozinho.

Em **servidor já existente** (o volume do banco já existe, então o script não
roda automático), aplique uma vez:

```bash
cd ~/campanha-2026
git fetch origin
git checkout origin/claude/campaign-management-mvp-prototype-zszx9l -- gestao

cd gestao
# defina a senha da role de aplicação (e, idealmente, os outros segredos) no .env
grep -q '^APP_DB_PASSWORD=' .env || echo 'APP_DB_PASSWORD=uma_senha_forte_sem_aspas' >> .env

docker compose up -d postgres        # recria o banco com a nova env/mount (dados preservados)
docker compose exec postgres sh /docker-entrypoint-initdb.d/02-security.sh   # cria a role + tabela
API_PORT=8090 docker compose up -d   # a API sobe já conectando como gestao_app
```

Confira:

```bash
curl -s localhost:8090/health        # {"status":"ok","db":"ok"}  → API conecta como gestao_app
# a role NÃO pode fazer DDL:
docker compose exec postgres psql -U gestao_app -d gestao -c 'CREATE TABLE x(i int);'  # permission denied ✅
```

> Se um dia adicionar novas tabelas no `init.sql`, rode o `02-security.sh` de
> novo (é idempotente) para conceder DML nelas à role.

## 6. Alternativas de publicação

### A) Atrás do Cloudflare (TLS no edge)
1. DNS `gestao` no Cloudflare com o **proxy laranja ligado**.
2. Suba só até a seção 3 (HTTP). Não precisa de certbot.
3. Em Cloudflare → SSL/TLS, use o modo **Full**. O Cloudflare fala HTTPS com o
   visitante e HTTP com o proxy nginx (porta 80).

### B) Já existe um reverse proxy no host (nginx/Traefik/Caddy)
Não use o serviço `proxy` daqui. Aponte o proxy existente para a porta da API
(`API_PORT`, padrão `8010`). Exemplo de bloco nginx no host:

```nginx
server {
    server_name gestao.dualcomunicacao.com.br;
    location / {
        proxy_pass http://127.0.0.1:8010;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    listen 443 ssl;  # certificados gerenciados pelo host
}
```

> Atenção a conflitos de porta: se o sistema `/2026` já usa 80/443 no mesmo
> host, use **um único** reverse proxy na frente (opção B) roteando por
> `server_name` para cada sistema, em vez de dois proxies disputando as portas.

---

## 7. Checklist de verificação

- [ ] `dig +short gestao.dualcomunicacao.com.br` retorna o IP do servidor
- [ ] `curl -sI https://gestao.dualcomunicacao.com.br/` responde `302 → /app/`
- [ ] O site abre em `https://gestao.dualcomunicacao.com.br/app/`
- [ ] Primeiro acesso cria o administrador (ou entra com `ADMIN_*` do `.env`)
- [ ] `JWT_SECRET` e as senhas foram trocados dos valores padrão
- [ ] Renovação do certificado agendada (cron)
