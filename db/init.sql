-- ═══════════════════════════════════════════════════════════
-- init.sql — Sistema de Gestão Operacional de Campanhas
--            Dual Comunicação · "CampoGestão"
-- Executado automaticamente na primeira inicialização do volume
-- PostgreSQL 16
--
-- Convenções (herdadas do Sistema de Contatos Eleitorais):
--   • Nomenclatura em pt-BR
--   • criado_em / atualizado_em TIMESTAMPTZ DEFAULT NOW()
--   • Enums simples via CHECK; enums com cor/ordem via tabela de apoio
--   • Índices nas colunas usadas em filtros
--   • Views de resumo para dashboards (equivalem ao resumo_contatos)
-- ═══════════════════════════════════════════════════════════

-- gen_random_uuid() faz parte do core do PostgreSQL 13+.

-- ─────────────────────────────────────────────────────────────
-- Gatilho genérico para manter atualizado_em
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_touch_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════
-- 1. TABELAS DE APOIO (lookup) — poucos registros, com cor/ordem
-- ═══════════════════════════════════════════════════════════

-- Etapas do pipeline da campanha (7 fixas, ordenadas)
CREATE TABLE IF NOT EXISTS etapas (
    id       TEXT PRIMARY KEY,          -- slug: 'planejamento', 'estrategia'…
    nome     TEXT NOT NULL,
    apelido  TEXT,                      -- rótulo curto p/ UI ("Estr.")
    ordem    INT  NOT NULL UNIQUE
);

-- Status do Kanban (5 colunas, ordenadas, com cor)
CREATE TABLE IF NOT EXISTS status_kanban (
    id     TEXT PRIMARY KEY,            -- 'backlog','todo','in_progress','review','done'
    nome   TEXT NOT NULL,
    cor    TEXT NOT NULL,
    ordem  INT  NOT NULL UNIQUE,
    e_concluido BOOLEAN NOT NULL DEFAULT FALSE  -- marca o status terminal
);

-- Prioridades (com cor e peso p/ ordenação)
CREATE TABLE IF NOT EXISTS prioridades (
    id    TEXT PRIMARY KEY,             -- 'alta','media','baixa'
    nome  TEXT NOT NULL,
    cor   TEXT NOT NULL,
    peso  INT  NOT NULL                 -- 0 = mais urgente
);

-- Etiquetas (livres, com cor)
CREATE TABLE IF NOT EXISTS etiquetas (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome  TEXT NOT NULL UNIQUE,
    cor   TEXT NOT NULL
);

-- Configurações da agência (chave/valor) — ex.: nome da agência
CREATE TABLE IF NOT EXISTS configuracoes (
    chave         TEXT PRIMARY KEY,
    valor         TEXT,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════
-- 2. EQUIPE
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS usuarios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          TEXT NOT NULL UNIQUE, -- identificador de login (nome + senha)
    papel         TEXT,                 -- cargo na agência (ex.: "Social Media")
    email         TEXT,                 -- opcional (não usado no login)
    cor           TEXT DEFAULT '#6366f1',
    foto          TEXT,                 -- foto pessoal (data URL) — opcional
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    -- Campos reservados p/ futura autenticação (não usados nesta fase)
    senha_hash    TEXT,
    perfil_acesso TEXT DEFAULT 'membro'
                  CHECK (perfil_acesso IN ('admin','gestor','membro')),
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios(ativo);

CREATE TRIGGER trg_usuarios_touch BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_touch_atualizado_em();

-- Tokens JWT revogados (logout com revogação). Purgados quando expiram.
CREATE TABLE IF NOT EXISTS tokens_revogados (
    jti        TEXT PRIMARY KEY,
    expira_em  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tokens_exp ON tokens_revogados(expira_em);


-- ═══════════════════════════════════════════════════════════
-- 3. CAMPANHAS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS campanhas (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidato      TEXT NOT NULL,
    cargo          TEXT NOT NULL,            -- "Prefeito", "Vereador"…
    localizacao    TEXT,                     -- "São Paulo — SP"
    partido        TEXT,                     -- partido/coligação
    etapa_id       TEXT NOT NULL REFERENCES etapas(id),
    responsavel_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    progresso      INT  NOT NULL DEFAULT 0
                   CHECK (progresso BETWEEN 0 AND 100),
    prazo          DATE,
    status         TEXT NOT NULL DEFAULT 'ativa'
                   CHECK (status IN ('ativa','pausada','encerrada')),
    fixa           BOOLEAN NOT NULL DEFAULT FALSE,  -- campanha de sistema (ex.: Dual)
    cor            TEXT DEFAULT '#6366f1',
    descricao      TEXT,
    foto           TEXT,                     -- data URL: miniatura do candidato
    anotacoes      TEXT,                     -- texto livre: notas, links, etc.
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campanhas_status      ON campanhas(status);
CREATE INDEX IF NOT EXISTS idx_campanhas_etapa       ON campanhas(etapa_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_responsavel ON campanhas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_prazo       ON campanhas(prazo);

CREATE TRIGGER trg_campanhas_touch BEFORE UPDATE ON campanhas
    FOR EACH ROW EXECUTE FUNCTION fn_touch_atualizado_em();

-- Cofre de senhas/acessos por campanha. A senha é gravada CIFRADA pela API
-- (módulo vault.py); o banco nunca guarda a senha em texto puro.
CREATE TABLE IF NOT EXISTS campanha_credenciais (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id    UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    titulo         TEXT NOT NULL,            -- "Instagram", "Gerenciador de anúncios"…
    login          TEXT,                     -- usuário/e-mail de acesso
    url            TEXT,                     -- link do painel/login
    senha_cifrada  TEXT NOT NULL,            -- senha cifrada (nunca em texto puro)
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cred_campanha ON campanha_credenciais(campanha_id);

-- ─── Anotações da campanha: pastas, notas (blocos estilo Notion) e arquivos ───
CREATE TABLE IF NOT EXISTS campanha_pastas (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id  UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    nome         TEXT NOT NULL,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pastas_campanha ON campanha_pastas(campanha_id);

CREATE TABLE IF NOT EXISTS campanha_notas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id   UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    pasta_id      UUID REFERENCES campanha_pastas(id) ON DELETE SET NULL,
    titulo        TEXT NOT NULL DEFAULT 'Sem título',
    blocos        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{tipo, texto, feito?}]
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notas_campanha ON campanha_notas(campanha_id);

CREATE TRIGGER trg_notas_touch BEFORE UPDATE ON campanha_notas
    FOR EACH ROW EXECUTE FUNCTION fn_touch_atualizado_em();

CREATE TABLE IF NOT EXISTS campanha_arquivos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id  UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    pasta_id     UUID REFERENCES campanha_pastas(id) ON DELETE SET NULL,
    nome         TEXT NOT NULL,
    mime         TEXT,
    tamanho      INT NOT NULL DEFAULT 0,
    dados        BYTEA NOT NULL,                        -- conteúdo do arquivo
    enviado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_arquivos_campanha ON campanha_arquivos(campanha_id);


-- Membros da campanha (N:N campanhas ↔ usuarios) — o "teamIds" do protótipo
CREATE TABLE IF NOT EXISTS campanha_membros (
    campanha_id      UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    usuario_id       UUID NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
    papel_campanha   TEXT,                 -- opcional: função nesta campanha
    adicionado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (campanha_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_membros_usuario ON campanha_membros(usuario_id);


-- ═══════════════════════════════════════════════════════════
-- 4. ATIVIDADES (tarefas)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS atividades (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo         TEXT NOT NULL,
    campanha_id    UUID NOT NULL REFERENCES campanhas(id)     ON DELETE CASCADE,
    etapa_id       TEXT NOT NULL REFERENCES etapas(id),
    status_id      TEXT NOT NULL REFERENCES status_kanban(id),
    prioridade_id  TEXT NOT NULL REFERENCES prioridades(id)   DEFAULT 'media',
    responsavel_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    descricao      TEXT,
    inicio         DATE,                    -- opcional (barra da timeline)
    prazo          DATE,
    rotina         BOOLEAN NOT NULL DEFAULT FALSE,  -- tarefa de rotina (coluna Rotina)
    ordem_coluna   INT NOT NULL DEFAULT 0,  -- posição dentro da coluna do Kanban
    concluida_em   TIMESTAMPTZ,             -- preenchido ao entrar em status concluído
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ativ_campanha    ON atividades(campanha_id);
CREATE INDEX IF NOT EXISTS idx_ativ_status      ON atividades(status_id);
CREATE INDEX IF NOT EXISTS idx_ativ_responsavel ON atividades(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_ativ_prazo       ON atividades(prazo);
CREATE INDEX IF NOT EXISTS idx_ativ_etapa       ON atividades(etapa_id);
CREATE INDEX IF NOT EXISTS idx_ativ_prioridade  ON atividades(prioridade_id);

CREATE TRIGGER trg_atividades_touch BEFORE UPDATE ON atividades
    FOR EACH ROW EXECUTE FUNCTION fn_touch_atualizado_em();

-- Mantém concluida_em coerente com o status terminal
CREATE OR REPLACE FUNCTION fn_atividade_concluida()
RETURNS TRIGGER AS $$
DECLARE terminal BOOLEAN;
BEGIN
    SELECT e_concluido INTO terminal FROM status_kanban WHERE id = NEW.status_id;
    IF terminal AND NEW.concluida_em IS NULL THEN
        NEW.concluida_em = NOW();
    ELSIF NOT terminal THEN
        NEW.concluida_em = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atividades_concluida BEFORE INSERT OR UPDATE ON atividades
    FOR EACH ROW EXECUTE FUNCTION fn_atividade_concluida();


-- Etiquetas da atividade (N:N)
CREATE TABLE IF NOT EXISTS atividade_etiquetas (
    atividade_id UUID NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
    etiqueta_id  UUID NOT NULL REFERENCES etiquetas(id)  ON DELETE CASCADE,
    PRIMARY KEY (atividade_id, etiqueta_id)
);
CREATE INDEX IF NOT EXISTS idx_ativ_etiq_etiqueta ON atividade_etiquetas(etiqueta_id);


-- Itens de checklist da atividade
CREATE TABLE IF NOT EXISTS checklist_itens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atividade_id UUID NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
    texto        TEXT NOT NULL,
    concluido    BOOLEAN NOT NULL DEFAULT FALSE,
    prazo        DATE,                       -- data opcional por item
    ordem        INT NOT NULL DEFAULT 0,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checklist_ativ ON checklist_itens(atividade_id);


-- Comentários da atividade
CREATE TABLE IF NOT EXISTS comentarios (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atividade_id UUID NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
    autor_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    texto        TEXT NOT NULL,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comentarios_ativ ON comentarios(atividade_id);


-- Histórico / log de eventos da atividade
CREATE TABLE IF NOT EXISTS atividade_historico (
    id           BIGSERIAL PRIMARY KEY,
    atividade_id UUID NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
    autor_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo         TEXT NOT NULL,          -- 'criada','status','responsavel','prazo','editada'…
    descricao    TEXT NOT NULL,
    dados        JSONB,                  -- payload livre (de/para, campos alterados)
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hist_ativ ON atividade_historico(atividade_id, criado_em DESC);


-- ═══════════════════════════════════════════════════════════
-- 5. VIEWS DE RESUMO (dashboards)
-- ═══════════════════════════════════════════════════════════

-- Uma atividade está atrasada quando não está concluída e o prazo já passou.
-- Risco da campanha (mesma regra do protótipo):
--   ≥2 atrasadas → vermelho | 1 atrasada ou ≥3 vencendo em 4 dias → amarelo | senão verde

-- Resumo por campanha
CREATE OR REPLACE VIEW vw_campanha_resumo AS
SELECT
    c.id                                                          AS campanha_id,
    COUNT(a.id)                                                   AS total_atividades,
    COUNT(*) FILTER (WHERE sk.e_concluido)                        AS concluidas,
    COUNT(*) FILTER (WHERE a.status_id = 'in_progress')           AS em_andamento,
    COUNT(*) FILTER (WHERE a.status_id = 'review')                AS em_revisao,
    COUNT(*) FILTER (WHERE NOT sk.e_concluido
                       AND a.prazo < CURRENT_DATE)                AS atrasadas,
    COUNT(*) FILTER (WHERE a.prazo = CURRENT_DATE)                AS entregas_hoje,
    CASE
        WHEN COUNT(*) FILTER (WHERE NOT sk.e_concluido AND a.prazo < CURRENT_DATE) >= 2
            THEN 'vermelho'
        WHEN COUNT(*) FILTER (WHERE NOT sk.e_concluido AND a.prazo < CURRENT_DATE) = 1
          OR COUNT(*) FILTER (WHERE NOT sk.e_concluido
                                AND a.prazo BETWEEN CURRENT_DATE AND CURRENT_DATE + 4) >= 3
            THEN 'amarelo'
        ELSE 'verde'
    END                                                           AS risco
FROM campanhas c
LEFT JOIN atividades a    ON a.campanha_id = c.id
LEFT JOIN status_kanban sk ON sk.id = a.status_id
GROUP BY c.id;

-- Resumo global (cards do topo do dashboard)
CREATE OR REPLACE VIEW vw_dashboard AS
SELECT
    (SELECT COUNT(*) FROM campanhas WHERE status = 'ativa')                       AS campanhas_ativas,
    COUNT(*) FILTER (WHERE a.status_id = 'in_progress')                           AS atividades_em_andamento,
    COUNT(*) FILTER (WHERE NOT sk.e_concluido AND a.prazo < CURRENT_DATE)         AS atividades_atrasadas,
    COUNT(*) FILTER (WHERE a.prazo = CURRENT_DATE)                                AS entregas_hoje
FROM atividades a
JOIN status_kanban sk ON sk.id = a.status_id;

-- Carga de trabalho por membro da equipe
CREATE OR REPLACE VIEW vw_carga_equipe AS
SELECT
    u.id                                                          AS usuario_id,
    COUNT(a.id)                                                   AS total_tarefas,
    COUNT(*) FILTER (WHERE NOT sk.e_concluido
                       AND a.prazo < CURRENT_DATE)                AS atrasadas,
    COUNT(*) FILTER (WHERE a.status_id = 'in_progress')           AS em_andamento,
    (SELECT COUNT(DISTINCT cm.campanha_id)
       FROM campanha_membros cm WHERE cm.usuario_id = u.id)       AS campanhas
FROM usuarios u
LEFT JOIN atividades a     ON a.responsavel_id = u.id
LEFT JOIN status_kanban sk ON sk.id = a.status_id
GROUP BY u.id;


-- ═══════════════════════════════════════════════════════════
-- 6. SEED — dados de apoio (etapas, status, prioridades)
-- ═══════════════════════════════════════════════════════════
INSERT INTO etapas (id, nome, apelido, ordem) VALUES
    ('planejamento', 'Planejamento', 'Plan.', 1),
    ('diagnostico',  'Diagnóstico',  'Diag.', 2),
    ('estrategia',   'Estratégia',   'Estr.', 3),
    ('producao',     'Produção',     'Prod.', 4),
    ('execucao',     'Execução',     'Exec.', 5),
    ('reta_final',   'Reta Final',   'Reta',  6),
    ('encerramento', 'Encerramento', 'Enc.',  7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO status_kanban (id, nome, cor, ordem, e_concluido) VALUES
    ('todo',        'A Fazer',      '#6366f1', 1, FALSE),
    ('in_progress', 'Em Andamento', '#0ea5e9', 2, FALSE),
    ('review',      'Em Revisão',   '#f59e0b', 3, FALSE),
    ('done',        'Concluído',    '#22c55e', 4, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO prioridades (id, nome, cor, peso) VALUES
    ('alta',  'Alta',  '#ef4444', 0),
    ('media', 'Média', '#f59e0b', 1),
    ('baixa', 'Baixa', '#22c55e', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO etiquetas (nome, cor) VALUES
    ('ManyChat',   '#2563eb'),
    ('ZapNews',    '#14b8a6'),
    ('Estratégia', '#6366f1'),
    ('Whatsapp',   '#25D366')
ON CONFLICT (nome) DO NOTHING;

-- Configurações iniciais da agência
INSERT INTO configuracoes (chave, valor) VALUES
    ('agencia_nome', 'Dual Comunicação'),
    ('ciclo', '2026 — Eleições Municipais')
ON CONFLICT (chave) DO NOTHING;

-- Campanha fixa da própria agência (atividades internas da Dual)
INSERT INTO campanhas (candidato, cargo, localizacao, etapa_id, status, cor, fixa, descricao)
SELECT 'Dual', 'Agência', 'Interno', 'execucao', 'ativa', '#4f46e5', TRUE,
       'Atividades internas da própria agência (Dual Comunicação).'
WHERE NOT EXISTS (SELECT 1 FROM campanhas WHERE fixa AND candidato = 'Dual');
