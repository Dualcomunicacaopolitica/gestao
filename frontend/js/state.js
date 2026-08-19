/* =============================================================
   APPLICATION STATE + SELECTORS  (versão integrada à API)
   -------------------------------------------------------------
   Selectors leem de App.data (cache hidratado pela store).
   Mutations chamam a API e atualizam o cache local.
   ============================================================= */
(function (App) {
  'use strict';

  const data = App.data;
  App.TODAY = data.TODAY;

  const state = { filters: {}, selectedTaskId: null };
  App.state = state;

  // Lookups por busca direta (o cache é pequeno e é substituído no hydrate)
  const find = (arr, id) => (App.data[arr] || []).find((x) => x.id === id);

  const S = {
    users: () => App.data.users,
    campaigns: () => App.data.campaigns,
    tasks: () => App.data.tasks,
    stages: () => App.data.stages,
    statuses: () => App.data.statuses,
    priorities: () => App.data.priorities,
    labels: () => App.data.labels,
    config: () => App.data.config || {},

    user: (id) => find('users', id),
    campaign: (id) => find('campaigns', id),
    stage: (id) => find('stages', id),
    status: (id) => find('statuses', id),
    priority: (id) => find('priorities', id),
    label: (id) => find('labels', id),
    task: (id) => find('tasks', id),

    tasksByCampaign: (cid) => App.data.tasks.filter((t) => t.campaignId === cid),
    tasksByAssignee: (uid) => App.data.tasks.filter((t) => t.assigneeId === uid),
    tasksByStatus: (sid) => App.data.tasks.filter((t) => t.status === sid),
    tasksByStage: (cid, stageId) => App.data.tasks.filter((t) => t.campaignId === cid && t.stageId === stageId),

    isOverdue: (t) => t.status !== 'done' && t.dueDate && t.dueDate < App.TODAY,
    isDueToday: (t) => t.dueDate === App.TODAY,

    overdueTasks: () => App.data.tasks.filter((t) => S.isOverdue(t)),
    dueTodayTasks: () => App.data.tasks.filter((t) => S.isDueToday(t)),
    inProgressTasks: () => App.data.tasks.filter((t) => t.status === 'in_progress'),

    checklistDone: (t) => (t.checklist || []).filter((c) => c.done).length,

    taskSpan: (t) => {
      const end = t.dueDate;
      let start = t.startDate;
      if (!start) {
        const dur = t.priority === 'alta' ? 3 : (t.priority === 'baixa' ? 7 : 5);
        start = addDays(end, -dur);
      }
      if (start > end) start = end;
      return { start: start, end: end };
    },

    campaignsOfUser: (uid) => App.data.campaigns.filter(
      (c) => c.ownerId === uid || (c.teamIds || []).includes(uid)
    ),

    userStats: (uid) => {
      const t = S.tasksByAssignee(uid);
      return {
        total: t.length,
        overdue: t.filter((x) => S.isOverdue(x)).length,
        inProgress: t.filter((x) => x.status === 'in_progress').length,
        done: t.filter((x) => x.status === 'done').length,
        campaigns: S.campaignsOfUser(uid).length,
      };
    },

    campaignStats: (cid) => {
      const t = S.tasksByCampaign(cid);
      return {
        total: t.length,
        overdue: t.filter((x) => S.isOverdue(x)).length,
        dueToday: t.filter((x) => S.isDueToday(x)).length,
        done: t.filter((x) => x.status === 'done').length,
        review: t.filter((x) => x.status === 'review').length,
        inProgress: t.filter((x) => x.status === 'in_progress').length,
      };
    },

    riskOf: (cid) => {
      const t = S.tasksByCampaign(cid);
      const overdue = t.filter((x) => S.isOverdue(x)).length;
      if (overdue >= 2) return 'red';
      const soon = t.filter((x) => x.status !== 'done' && x.dueDate >= App.TODAY && x.dueDate <= addDays(App.TODAY, 4)).length;
      if (overdue === 1 || soon >= 3) return 'yellow';
      return 'green';
    },

    dashboard: () => ({
      activeCampaigns: App.data.campaigns.filter((c) => c.status === 'active').length,
      inProgress: S.inProgressTasks().length,
      overdue: S.overdueTasks().length,
      dueToday: S.dueTodayTasks().length,
    }),
  };

  /* ---------- Mutations (API + atualização do cache) ---------- */
  App.mutations = {
    addCampaign: async (c) => {
      const payload = {
        candidato: c.candidate, cargo: c.office, localizacao: c.location,
        partido: c.party, etapa_id: c.stage, responsavel_id: c.ownerId || null,
        progresso: parseInt(c.progress, 10) || 0, prazo: c.deadline || null,
        status: 'ativa', cor: c.color || '#6366f1', descricao: c.description || null,
      };
      const res = await App.api.criarCampanha(payload);
      const camp = App.store.mapCampaign(res);
      App.data.campaigns.unshift(camp);
      return camp;
    },

    deleteCampaign: async (id) => {
      await App.api.excluirCampanha(id);
      const i = App.data.campaigns.findIndex((c) => c.id === id);
      if (i >= 0) App.data.campaigns.splice(i, 1);
    },

    updateCampaign: async (id, patch) => {
      const payload = {};
      const map = {
        candidate: 'candidato', office: 'cargo', location: 'localizacao', party: 'partido',
        stage: 'etapa_id', ownerId: 'responsavel_id', progress: 'progresso',
        deadline: 'prazo', color: 'cor', description: 'descricao',
        photo: 'foto', notes: 'anotacoes',
      };
      Object.keys(map).forEach((k) => { if (patch[k] !== undefined) payload[map[k]] = patch[k]; });
      if (patch.status) payload.status = App.store.STATUS_CAMP_BACK[patch.status] || patch.status;
      const res = await App.api.atualizarCampanha(id, payload);
      const camp = App.store.mapCampaign(res);
      const i = App.data.campaigns.findIndex((c) => c.id === id);
      if (i >= 0) App.data.campaigns[i] = camp;
      return camp;
    },

    addTask: async (o) => {
      const payload = {
        titulo: o.title, campanha_id: o.campaignId, etapa_id: o.stageId,
        status_id: o.status || 'todo', prioridade_id: o.priority || 'media',
        responsavel_id: o.assigneeId || null, descricao: o.description || null,
        inicio: o.startDate || null, prazo: o.dueDate || null,
        rotina: !!o.rotina,
        etiquetas: o.labels || [],
        checklist: (o.checklist || []).map((c) => ({ texto: c.text, concluido: !!c.done, prazo: c.due || null })),
      };
      const d = await App.api.criarAtividade(payload);
      const t = App.store.taskFromDetalhe(d);
      App.data.tasks.push(t);
      return t;
    },

    updateTask: async (id, patch) => {
      const payload = {};
      const map = {
        title: 'titulo', campaignId: 'campanha_id', stageId: 'etapa_id',
        status: 'status_id', priority: 'prioridade_id', assigneeId: 'responsavel_id',
        dueDate: 'prazo', startDate: 'inicio', description: 'descricao',
      };
      Object.keys(map).forEach((k) => { if (patch[k] !== undefined) payload[map[k]] = patch[k] || null; });
      if (patch.labels) payload.etiquetas = patch.labels;
      if (patch.rotina !== undefined) payload.rotina = !!patch.rotina;
      const d = await App.api.atualizarAtividade(id, payload);
      const t = S.task(id);
      if (t) App.store.mergeDetalhe(t, d);
      return t || App.store.taskFromDetalhe(d);
    },

    deleteTask: async (id) => {
      await App.api.excluirAtividade(id);
      const i = App.data.tasks.findIndex((t) => t.id === id);
      if (i >= 0) App.data.tasks.splice(i, 1);
    },

    setUserPhoto: async (id, dataUrl) => {
      await App.api.atualizarFotoUsuario(id, dataUrl);
      const u = S.user(id);
      if (u) u.photo = dataUrl || '';
      if (App.currentUser && App.currentUser.id === id) App.currentUser.photo = dataUrl || '';
      return u;
    },

    moveTask: async (taskId, newStatus) => {
      const t = S.task(taskId);
      const prev = t ? t.status : null;
      if (t) t.status = newStatus;                     // otimista
      try {
        const d = await App.api.moverAtividade(taskId, newStatus);
        if (t) App.store.mergeDetalhe(t, d);
      } catch (e) {
        if (t) t.status = prev;                         // reverte
        throw e;
      }
    },

    addComment: async (taskId, text) => {
      const c = await App.api.comentar(taskId, text);
      const t = S.task(taskId);
      if (t) { t.comments = t.comments || []; t.comments.push({ id: c.id, at: (c.criado_em || '').slice(0, 10), who: c.autor_id, whoName: c.autor_nome, text: c.texto }); }
      return c;
    },

    toggleChecklist: async (taskId, itemId) => {
      const t = S.task(taskId);
      const item = t && (t.checklist || []).find((c) => c.id === itemId);
      if (!item) return;
      const novo = !item.done;
      item.done = novo;                                 // otimista
      try { await App.api.patchChecklist(itemId, { concluido: novo }); }
      catch (e) { item.done = !novo; throw e; }
    },
  };

  /* ---------- Utilidades de data ---------- */
  function addDays(iso, n) {
    if (!iso) return iso;
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }
  App.addDays = addDays;
  App.select = S;
})(window.App = window.App || {});
