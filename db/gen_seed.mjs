/* ---------------------------------------------------------------
   gen_seed.mjs — OPCIONAL (somente para ambiente de TESTE).
   Gera dados fictícios do protótipo (prototype/js/data/mock.js) como
   INSERTs, preservando integridade referencial. NÃO é carregado
   automaticamente pelo docker-compose — o banco de produção começa vazio.
   Uso: node gestao/db/gen_seed.mjs > gestao/db/seed_demo.sql
        depois: psql -d gestao -f gestao/db/seed_demo.sql
   --------------------------------------------------------------- */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK = path.resolve(__dirname, '../../prototype/js/data/mock.js');

// Carrega o mock num shim de browser
const src = fs.readFileSync(MOCK, 'utf8');
const window = {};
new Function('window', src)(window);
const D = window.App.data;

// UUID determinístico (v5-like) a partir de um rótulo estável
function uuid(label) {
  const h = crypto.createHash('sha1').update('campogestao:' + label).digest('hex');
  return (
    h.slice(0, 8) + '-' + h.slice(8, 12) + '-5' + h.slice(13, 16) + '-' +
    ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + h.slice(18, 20) + '-' + h.slice(20, 32)
  );
}

// Hash de senha PBKDF2-HMAC-SHA256 no formato pbkdf2_sha256$iter$salt_b64$hash_b64
function hashPassword(pw, saltHex) {
  const iters = 120000, keylen = 32;
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const dk = crypto.pbkdf2Sync(pw, salt, iters, keylen, 'sha256');
  return `pbkdf2_sha256$${iters}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

const q = (s) => s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
const dt = (s) => s == null ? 'NULL' : `'${s}'`;               // date/timestamp literal
const out = [];
const P = (s) => out.push(s);

// Senha de demonstração igual para todos os usuários semeados
const DEMO_PASSWORD = 'dual2026';
const DEMO_SALT = '0011223344556677889aabbccddeeff0';
const DEMO_HASH = hashPassword(DEMO_PASSWORD, DEMO_SALT);

// Papel de acesso por usuário (demo)
const ACCESS = { u1: 'admin', u9: 'gestor', u5: 'gestor' };

// e-mail a partir do nome
function email(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().split(/\s+/).slice(0, 2).join('.') + '@dualcomunicacao.com.br';
}
// mapa label-id -> nome (para resolver etiqueta por nome no banco)
const labelName = {}; D.labels.forEach((l) => labelName[l.id] = l.name);

P('-- ═══════════════════════════════════════════════════════════');
P('-- seed_demo.sql — dados de demonstração (gerado de mock.js)');
P('-- Senha de todos os usuários: ' + DEMO_PASSWORD);
P('-- NÃO editar à mão: rode  node backend/db/gen_seed.mjs > seed_demo.sql');
P('-- ═══════════════════════════════════════════════════════════');
P('BEGIN;');

// ---------- usuarios ----------
P('\n-- Equipe');
D.users.forEach((u) => {
  P(`INSERT INTO usuarios (id, nome, papel, email, cor, perfil_acesso, senha_hash) VALUES (` +
    `'${uuid('user:' + u.id)}', ${q(u.name)}, ${q(u.role)}, ${q(email(u.name))}, ${q(u.color)}, ` +
    `'${ACCESS[u.id] || 'membro'}', ${q(DEMO_HASH)}) ON CONFLICT (id) DO NOTHING;`);
});

// ---------- campanhas ----------
P('\n-- Campanhas');
D.campaigns.forEach((c) => {
  P(`INSERT INTO campanhas (id, candidato, cargo, localizacao, partido, etapa_id, responsavel_id, progresso, prazo, status, cor, descricao) VALUES (` +
    `'${uuid('camp:' + c.id)}', ${q(c.candidate)}, ${q(c.office)}, ${q(c.location)}, ${q(c.party)}, ` +
    `'${c.stage}', '${uuid('user:' + c.ownerId)}', ${c.progress}, ${dt(c.deadline)}, 'ativa', ${q(c.color)}, ${q(c.description)}) ` +
    `ON CONFLICT (id) DO NOTHING;`);
});

// ---------- campanha_membros ----------
P('\n-- Equipe alocada por campanha');
D.campaigns.forEach((c) => {
  const ids = Array.from(new Set([c.ownerId, ...(c.teamIds || [])]));
  ids.forEach((uid) => {
    P(`INSERT INTO campanha_membros (campanha_id, usuario_id) VALUES ('${uuid('camp:' + c.id)}', '${uuid('user:' + uid)}') ON CONFLICT DO NOTHING;`);
  });
});

// ---------- atividades + filhas ----------
P('\n-- Atividades');
D.tasks.forEach((t, i) => {
  const tid = uuid('task:' + t.id);
  P(`INSERT INTO atividades (id, titulo, campanha_id, etapa_id, status_id, prioridade_id, responsavel_id, descricao, inicio, prazo, ordem_coluna) VALUES (` +
    `'${tid}', ${q(t.title)}, '${uuid('camp:' + t.campaignId)}', '${t.stageId}', '${t.status}', '${t.priority}', ` +
    `'${uuid('user:' + t.assigneeId)}', ${q(t.description)}, ${dt(t.startDate)}, ${dt(t.dueDate)}, ${i}) ON CONFLICT (id) DO NOTHING;`);
  // etiquetas (resolve por nome)
  (t.labels || []).forEach((lid) => {
    P(`INSERT INTO atividade_etiquetas (atividade_id, etiqueta_id) SELECT '${tid}', id FROM etiquetas WHERE nome = ${q(labelName[lid])} ON CONFLICT DO NOTHING;`);
  });
  // checklist
  (t.checklist || []).forEach((ck, j) => {
    P(`INSERT INTO checklist_itens (id, atividade_id, texto, concluido, ordem) VALUES ('${uuid('ck:' + ck.id)}', '${tid}', ${q(ck.text)}, ${ck.done}, ${j}) ON CONFLICT (id) DO NOTHING;`);
  });
  // comentarios
  (t.comments || []).forEach((cm, j) => {
    P(`INSERT INTO comentarios (id, atividade_id, autor_id, texto, criado_em) VALUES ('${uuid('cm:' + t.id + ':' + j)}', '${tid}', '${uuid('user:' + cm.who)}', ${q(cm.text)}, ${dt(cm.at)}) ON CONFLICT (id) DO NOTHING;`);
  });
  // historico
  (t.history || []).forEach((h) => {
    const tipo = /criada/i.test(h.text) ? 'criada' : (/status/i.test(h.text) ? 'status' : 'evento');
    P(`INSERT INTO atividade_historico (atividade_id, autor_id, tipo, descricao, criado_em) VALUES ('${tid}', '${uuid('user:' + h.who)}', '${tipo}', ${q(h.text)}, ${dt(h.at)});`);
  });
});

P('\nCOMMIT;');
process.stdout.write(out.join('\n') + '\n');
