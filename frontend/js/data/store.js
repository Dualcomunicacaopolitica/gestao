/* =============================================================
   STORE — cache local hidratado a partir da API.
   Mantém App.data no MESMO formato que o protótipo usava (mock),
   para que todas as views continuem funcionando sem alteração.
   O mapeamento traduz os nomes pt-BR do backend para o shape do
   frontend (candidato→candidate, etapa_id→stage, etc.).
   ============================================================= */
(function (App) {
  'use strict';

  const today = new Date();
  const TODAY = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  // App.data começa vazio; hydrate() preenche a partir da API.
  App.data = {
    stages: [], statuses: [], priorities: [], labels: [],
    users: [], campaigns: [], tasks: [], config: {}, TODAY: TODAY,
  };

  const STATUS_CAMP = { ativa: 'active', pausada: 'paused', encerrada: 'closed' };
  const STATUS_CAMP_BACK = { active: 'ativa', paused: 'pausada', closed: 'encerrada' };
  const RISK = { verde: 'green', amarelo: 'yellow', vermelho: 'red' };

  function mapUser(u) {
    return { id: u.id, name: u.nome, role: u.papel || '', color: u.cor || '#6366f1', perfil: u.perfil_acesso, photo: u.foto || '' };
  }
  function mapCampaign(c) {
    return {
      id: c.id, candidate: c.candidato, office: c.cargo, location: c.localizacao || '',
      party: c.partido || '', stage: c.etapa_id, progress: c.progresso || 0,
      ownerId: c.responsavel_id, deadline: c.prazo, status: STATUS_CAMP[c.status] || 'active',
      risk: RISK[c.risco] || 'green', teamIds: c.membros || [], color: c.cor || '#6366f1',
      description: c.descricao || '', fixed: !!c.fixa,
      photo: c.foto || '', notes: c.anotacoes || '',
    };
  }
  function fakeChecklist(total, done) {
    total = total || 0; done = done || 0;
    const arr = [];
    for (let i = 0; i < total; i++) arr.push({ id: '_c' + i, text: '', done: i < done });
    return arr;
  }
  function mapTask(a) {
    return {
      id: a.id, title: a.titulo, campaignId: a.campanha_id, stageId: a.etapa_id,
      status: a.status_id, assigneeId: a.responsavel_id, priority: a.prioridade_id,
      dueDate: a.prazo, startDate: a.inicio, description: a.descricao || '',
      rotina: !!a.rotina,
      labels: a.etiqueta_ids || [],
      checklist: fakeChecklist(a.checklist_total, a.checklist_feitos),
      comments: [], history: [], _loaded: false,
    };
  }
  // Detalhe completo (drawer): substitui checklist/comments/history reais.
  function mergeDetalhe(t, d) {
    t.title = d.titulo; t.description = d.descricao || '';
    t.stageId = d.etapa_id; t.status = d.status_id; t.priority = d.prioridade_id;
    t.assigneeId = d.responsavel_id; t.dueDate = d.prazo; t.startDate = d.inicio;
    t.rotina = !!d.rotina;
    t.labels = (d.etiquetas || []).map((e) => e.id);
    t.checklist = (d.checklist || []).map((c) => ({ id: c.id, text: c.texto, done: c.concluido, due: c.prazo || null }));
    t.comments = (d.comentarios || []).map((c) => ({ id: c.id, at: (c.criado_em || '').slice(0, 10), who: c.autor_id, whoName: c.autor_nome, text: c.texto }));
    t.history = (d.historico || []).map((h) => ({ at: (h.criado_em || '').slice(0, 10), who: h.autor_id, whoName: h.autor_nome, text: h.descricao }));
    t._loaded = true;
    return t;
  }

  function taskFromDetalhe(d) {
    const t = { id: d.id, campaignId: d.campanha_id };
    return mergeDetalhe(t, d);
  }

  App.store = {
    mapUser, mapCampaign, mapTask, mergeDetalhe, taskFromDetalhe,
    STATUS_CAMP_BACK,

    hydrate: async function () {
      const D = App.data;
      const [meta, usuarios, campanhas, atividades] = await Promise.all([
        App.api.meta(), App.api.usuarios(), App.api.campanhas(), App.api.atividades(),
      ]);
      D.stages = meta.etapas.map((e) => ({ id: e.id, name: e.nome, short: e.apelido || e.nome, order: e.ordem }));
      D.statuses = meta.status.map((s) => ({ id: s.id, name: s.nome, color: s.cor }));
      D.priorities = meta.prioridades.map((p) => ({ id: p.id, name: p.nome, color: p.cor }));
      D.labels = meta.etiquetas.map((l) => ({ id: l.id, name: l.nome, color: l.cor }));
      D.config = meta.config || {};
      D.users = usuarios.map(mapUser);
      D.campaigns = campanhas.map(mapCampaign);
      D.tasks = atividades.map(mapTask);
    },

    // Recarrega só campanhas + atividades (após mutações) mantendo meta/users.
    refresh: async function () {
      const D = App.data;
      const [campanhas, atividades] = await Promise.all([App.api.campanhas(), App.api.atividades()]);
      // preserva detalhes já carregados (checklist/comments/history)
      const loaded = {};
      D.tasks.forEach((t) => { if (t._loaded) loaded[t.id] = t; });
      D.campaigns = campanhas.map(mapCampaign);
      D.tasks = atividades.map((a) => {
        const t = mapTask(a);
        if (loaded[a.id]) { t.comments = loaded[a.id].comments; t.history = loaded[a.id].history; t.checklist = loaded[a.id].checklist; t._loaded = true; }
        return t;
      });
    },
  };
})(window.App = window.App || {});
