-- ═══════════════════════════════════════════════════════════
-- migrate.sql — aplica em bancos JÁ EXISTENTES as mudanças que o
-- init.sql traz para instalações novas. Idempotente (pode rodar 2x).
-- Uso:
--   docker compose cp db/migrate.sql postgres:/tmp/migrate.sql
--   docker compose exec -T postgres psql -U dual -d gestao -f /tmp/migrate.sql
-- ═══════════════════════════════════════════════════════════
BEGIN;

-- data opcional por item de checklist
ALTER TABLE checklist_itens ADD COLUMN IF NOT EXISTS prazo DATE;

-- campanha de sistema (não excluível)
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS fixa BOOLEAN NOT NULL DEFAULT FALSE;

-- foto do candidato (miniatura em data URL) + anotações livres
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS foto TEXT;
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS anotacoes TEXT;

-- foto pessoal do usuário (data URL)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto TEXT;

-- tarefas de rotina (coluna "Rotina" no Kanban)
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS rotina BOOLEAN NOT NULL DEFAULT FALSE;

-- remove o status "Backlog": tarefas nele voltam para "A Fazer" e o status é apagado
UPDATE atividades SET status_id = 'todo' WHERE status_id = 'backlog';
DELETE FROM status_kanban WHERE id = 'backlog';

-- Anotações da campanha: pastas, notas (blocos) e arquivos
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
    blocos        JSONB NOT NULL DEFAULT '[]'::jsonb,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notas_campanha ON campanha_notas(campanha_id);
DROP TRIGGER IF EXISTS trg_notas_touch ON campanha_notas;
CREATE TRIGGER trg_notas_touch BEFORE UPDATE ON campanha_notas
    FOR EACH ROW EXECUTE FUNCTION fn_touch_atualizado_em();

CREATE TABLE IF NOT EXISTS campanha_arquivos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id  UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    pasta_id     UUID REFERENCES campanha_pastas(id) ON DELETE SET NULL,
    nome         TEXT NOT NULL,
    mime         TEXT,
    tamanho      INT NOT NULL DEFAULT 0,
    dados        BYTEA NOT NULL,
    enviado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_arquivos_campanha ON campanha_arquivos(campanha_id);

-- garante DML para a role de aplicação nas tabelas novas
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'gestao_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON campanha_pastas, campanha_notas, campanha_arquivos TO gestao_app;
  END IF;
END $$;

-- cofre de senhas/acessos por campanha (senha cifrada pela API)
CREATE TABLE IF NOT EXISTS campanha_credenciais (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id    UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    titulo         TEXT NOT NULL,
    login          TEXT,
    url            TEXT,
    senha_cifrada  TEXT NOT NULL,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cred_campanha ON campanha_credenciais(campanha_id);
-- garante DML para a role de aplicação (caso as default privileges não cubram)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'gestao_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON campanha_credenciais TO gestao_app;
  END IF;
END $$;

-- novo conjunto de etiquetas
INSERT INTO etiquetas (nome, cor) VALUES
    ('ManyChat',   '#2563eb'),
    ('ZapNews',    '#14b8a6'),
    ('Estratégia', '#6366f1'),
    ('Whatsapp',   '#25D366')
ON CONFLICT (nome) DO UPDATE SET cor = EXCLUDED.cor;
-- remove as etiquetas antigas (e seus vínculos, via cascade)
DELETE FROM etiquetas WHERE nome NOT IN ('ManyChat','ZapNews','Estratégia','Whatsapp');

-- campanha fixa da Dual
INSERT INTO campanhas (candidato, cargo, localizacao, etapa_id, status, cor, fixa, descricao)
SELECT 'Dual', 'Agência', 'Interno', 'execucao', 'ativa', '#4f46e5', TRUE,
       'Atividades internas da própria agência (Dual Comunicação).'
WHERE NOT EXISTS (SELECT 1 FROM campanhas WHERE fixa AND candidato = 'Dual');

COMMIT;
