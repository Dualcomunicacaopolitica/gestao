/* =============================================================
   COMPONENTES REUTILIZÁVEIS
   -------------------------------------------------------------
   Blocos de interface usados por várias telas: sidebar, topbar,
   cards de campanha/tarefa, pipeline de etapas, barra de
   progresso e o drawer de detalhe da atividade.
   Cada componente retorna string HTML (render) e, quando
   necessário, expõe uma função de "mount" para os eventos.
   ============================================================= */
(function (App) {
  'use strict';
  const S = App.select, ui = App.ui;

  // Namespace das views (preenchido pelos arquivos em js/views/*)
  App.views = App.views || {};

  /* ---------- SIDEBAR ---------- */
  const NAV = [
    { id: 'campaigns',  label: 'Campanhas',   icon: 'campaigns', route: '#/campaigns' },
    { id: 'kanban',     label: 'Kanban',      icon: 'kanban',    route: '#/kanban' },
    { id: 'super',      label: 'Super Cronograma', icon: 'calendar', route: '#/super-cronograma' },
    { id: 'team',       label: 'Equipe',      icon: 'team',      route: '#/equipe' },
    { id: 'settings',   label: 'Configurações', icon: 'settings', route: '#/configuracoes' }
  ];

  function sidebar(activeId) {
    const items = NAV.map((n) =>
      '<a class="nav-item ' + (n.id === activeId ? 'active' : '') + '" href="' + n.route + '">' +
        ui.icon(n.icon, 19) + '<span>' + n.label + '</span></a>'
    ).join('');
    return '' +
      '<aside class="sidebar" id="sidebar">' +
        '<div class="brand">' +
          '<img class="brand-logo" src="assets/logo-dual.svg" alt="Dual Comunicação">' +
          '<div class="brand-name">Gestão <span>Dual</span><small>Dual Comunicação</small></div>' +
        '</div>' +
        '<nav class="nav">' + items + '</nav>' +
      '</aside>' +
      '<div class="sidebar-scrim" id="sidebar-scrim"></div>';
  }

  /* ---------- TOPBAR ---------- */
  function topbar(title, subtitle) {
    const overdue = S.overdueTasks().length;
    const u = App.currentUser || { name: 'Usuário', role: '', color: '#6366f1' };
    const perfil = { admin: 'Administrador', gestor: 'Gestor', membro: 'Membro' }[u.perfil] || (u.role || '');
    return '' +
      '<header class="topbar">' +
        '<button class="icon-btn only-mobile" id="menu-toggle" aria-label="Menu">' + ui.icon('menu', 20) + '</button>' +
        '<div class="topbar-title"><h1>' + ui.escapeHtml(title) + '</h1>' +
          (subtitle ? '<p>' + ui.escapeHtml(subtitle) + '</p>' : '') + '</div>' +
        '<div class="topbar-actions" style="margin-left:auto">' +
          '<button class="icon-btn" id="notif-btn" aria-label="Notificações">' + ui.icon('bell', 19) +
            (overdue ? '<span class="badge-count">' + overdue + '</span>' : '') + '</button>' +
          '<div class="user-chip" id="user-chip">' +
            (u.photo
              ? '<span class="avatar avatar-photo" style="width:30px;height:30px"><img src="' + u.photo + '" alt=""></span>'
              : '<span class="avatar" style="background:' + u.color + ';width:30px;height:30px">' + ui.initials(u.name) + '</span>') +
            '<div class="user-meta"><strong>' + ui.escapeHtml(u.name) + '</strong><span>' + ui.escapeHtml(perfil) + '</span></div>' +
            ui.icon('chevronRight', 16) +
          '</div>' +
        '</div>' +
      '</header>';
  }

  /* ---------- BARRA DE PROGRESSO ---------- */
  function progressBar(pct, color) {
    return '<div class="progress"><div class="progress-fill" style="width:' + pct + '%;background:' +
      (color || 'var(--primary)') + '"></div></div>';
  }

  /* ---------- CARD DE CAMPANHA ---------- */
  function campaignCard(c) {
    const st = S.campaignStats(c.id);
    const stage = S.stage(c.stage);
    const owner = S.user(c.ownerId);
    const risk = S.riskOf(c.id);
    return '' +
      '<a class="camp-card card-hover" href="#/campanha/' + c.id + '">' +
        '<div class="camp-card-top">' +
          ui.campAvatar(c) +
          '<div class="camp-id"><strong>' + ui.escapeHtml(c.candidate) +
            (c.fixed ? ' <span class="camp-fixed-badge">Interno</span>' : '') + '</strong>' +
            '<span>' + ui.escapeHtml(c.office) + ' — ' + ui.escapeHtml(c.location) + '</span></div>' +
          ui.riskDot(risk) +
        '</div>' +
        '<div class="camp-stage"><span class="stage-tag">' + ui.icon('flag', 14) + stage.name + '</span></div>' +
        '<div class="camp-progress"><div class="camp-progress-head"><span>Progresso</span><strong>' + c.progress + '%</strong></div>' +
          progressBar(c.progress, c.color) + '</div>' +
        '<div class="camp-card-foot">' +
          '<span>' + st.total + ' atividades</span>' +
          (st.overdue ? '<span class="danger-text">' + st.overdue + ' atrasada' + (st.overdue > 1 ? 's' : '') + '</span>' : '<span class="ok-text">em dia</span>') +
          '<span class="camp-owner">' + (owner ? ui.avatar(c.ownerId, 22) + owner.name.split(' ')[0] : '—') + '</span>' +
        '</div>' +
      '</a>';
  }

  /* ---------- PIPELINE DE ETAPAS ---------- */
  function pipeline(currentStageId, compact) {
    const stages = S.stages();
    const curOrder = S.stage(currentStageId).order;
    const steps = stages.map((s) => {
      let cls = 'pipe-step';
      if (s.order < curOrder) cls += ' done';
      else if (s.order === curOrder) cls += ' current';
      else cls += ' future';
      const mark = s.order < curOrder ? ui.icon('check', 14) : (s.order === curOrder ? '●' : (compact ? '' : s.order));
      return '<div class="' + cls + '"><span class="pipe-mark">' + mark + '</span>' +
        '<span class="pipe-name">' + (compact ? s.short : s.name) + '</span></div>';
    }).join('<span class="pipe-arrow">' + ui.icon('chevronRight', 14) + '</span>');
    return '<div class="pipeline ' + (compact ? 'pipeline-compact' : '') + '">' + steps + '</div>';
  }

  /* ---------- CARD DE TAREFA (Kanban) ---------- */
  function taskCard(t, opts) {
    opts = opts || {};
    const c = S.campaign(t.campaignId);
    const done = S.checklistDone(t), total = (t.checklist || []).length;
    const overdue = S.isOverdue(t), today = S.isDueToday(t);
    const dueCls = overdue ? 'due-over' : (today ? 'due-today' : '');
    const labelsHtml = (t.labels || []).slice(0, 3).map(ui.labelChip).join('');
    const canDel = !!App.currentUser;   // qualquer usuário logado pode excluir tarefas
    return '' +
      '<div class="task-card card-hover" draggable="true" data-task="' + t.id + '" data-status="' + t.status + '">' +
        (canDel ? '<button class="task-del" data-del="' + t.id + '" title="Excluir tarefa" aria-label="Excluir">' + ui.icon('trash', 14) + '</button>' : '') +
        (opts.showCampaign ? '<div class="task-camp"><span class="camp-pip" style="background:' + c.color + '"></span>' +
          ui.escapeHtml(c.candidate) + '</div>' : '') +
        (t.rotina ? '<div class="task-rotina">' + ui.icon('repeat', 12) + 'Rotina</div>' : '') +
        '<div class="task-title">' + ui.escapeHtml(t.title) + '</div>' +
        (labelsHtml ? '<div class="task-labels">' + labelsHtml + '</div>' : '') +
        '<div class="task-meta">' +
          ui.priorityBadge(t.priority) +
          '<span class="due ' + dueCls + '">' + ui.icon('clock', 13) + ui.fmtDate(t.dueDate) + '</span>' +
        '</div>' +
        '<div class="task-foot">' +
          (total ? '<span class="checklist-mini">' + ui.icon('check', 13) + done + '/' + total + '</span>' : '<span></span>') +
          ui.avatar(t.assigneeId, 24) +
        '</div>' +
      '</div>';
  }

  /* ---------- DRAWER DE DETALHE DA ATIVIDADE ---------- */
  async function openTaskDrawer(taskId) {
    const t = S.task(taskId);
    if (!t) return;
    if (!t._loaded) {
      try { const d = await App.api.atividade(taskId); App.store.mergeDetalhe(t, d); }
      catch (e) { ui.toast('Erro ao carregar atividade', 'error'); return; }
    }
    const c = S.campaign(t.campaignId);
    const stage = S.stage(t.stageId);
    const done = S.checklistDone(t), total = (t.checklist || []).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    const checklistHtml = (t.checklist || []).map(ckItemHtml).join('');

    const commentsHtml = (t.comments || []).length
      ? t.comments.map((cm) => {
          const u = S.user(cm.who);
          return '<div class="comment">' + ui.avatar(cm.who, 28) +
            '<div class="comment-body"><div class="comment-head"><strong>' + u.name + '</strong>' +
            '<span>' + ui.fmtDate(cm.at) + '</span></div><p>' + ui.escapeHtml(cm.text) + '</p></div></div>';
        }).join('')
      : '<p class="empty-mini">Nenhum comentário ainda.</p>';

    const historyHtml = (t.history || []).slice().reverse().map((h) =>
      '<div class="hist-item"><span class="hist-dot"></span><div><p>' + ui.escapeHtml(h.text) + '</p>' +
      '<span>' + ui.fmtDate(h.at) + '</span></div></div>'
    ).join('');

    const labelsHtml = (t.labels || []).map(ui.labelChip).join('') || '<span class="empty-mini">—</span>';

    const html = '' +
      '<div class="drawer-head">' +
        '<div class="drawer-crumbs"><span class="camp-pip" style="background:' + c.color + '"></span>' +
          ui.escapeHtml(c.candidate) + ui.icon('chevronRight', 13) + stage.name + '</div>' +
        '<div class="drawer-head-actions">' +
          '<button class="btn btn-sm" data-edit-task aria-label="Editar">' + ui.icon('edit', 15) + 'Editar</button>' +
          '<button class="icon-btn" data-close-drawer aria-label="Fechar">' + ui.icon('x', 20) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="drawer-scroll">' +
        '<h2 class="drawer-title">' + ui.escapeHtml(t.title) + '</h2>' +
        '<div class="drawer-props">' +
          prop('Status', ui.statusBadge(t.status)) +
          prop('Prioridade', ui.priorityBadge(t.priority)) +
          prop('Responsável', '<span class="prop-user">' + ui.avatar(t.assigneeId, 24) + S.user(t.assigneeId).name + '</span>') +
          prop('Prazo', '<span class="' + (S.isOverdue(t) ? 'danger-text' : '') + '">' + ui.icon('calendar', 14) + ' ' + ui.fmtDate(t.dueDate, true) + '</span>') +
          prop('Campanha', '<a href="#/campanha/' + c.id + '" data-close-drawer-nav>' + ui.escapeHtml(c.candidate) + '</a>') +
          prop('Etiquetas', labelsHtml) +
        '</div>' +
        section('Descrição', '<p class="drawer-desc">' + (t.description ? ui.escapeHtml(t.description) : '<span class="empty-mini">Sem descrição. Use “Editar” para adicionar.</span>') + '</p>') +
        section('Checklist <span class="sec-count">' + done + '/' + total + '</span>',
          '<div class="ck-progress">' + progressBar(pct, 'var(--success)') + '</div>' +
          '<div class="checklist">' + (checklistHtml || '<p class="empty-mini">Sem itens.</p>') + '</div>' +
          '<div class="ck-add">' +
            '<input type="text" id="ck-add-input" placeholder="Adicionar item ao checklist…" maxlength="200">' +
            '<input type="date" id="ck-add-date" title="Data (opcional)">' +
            '<button class="btn btn-sm btn-primary" id="ck-add-btn" title="Adicionar item">' + ui.icon('plus', 15) + '</button>' +
          '</div>') +
        section('Comentários', '<div class="comments">' + commentsHtml + '</div>' +
          '<div class="comment-add"><span class="avatar" style="background:#6366f1;width:28px;height:28px">AS</span>' +
          '<input type="text" id="comment-input" placeholder="Escreva um comentário…">' +
          '<button class="btn btn-sm btn-primary" id="comment-send">Enviar</button></div>') +
        section('Histórico', '<div class="history">' + historyHtml + '</div>') +
      '</div>';

    ui.openDrawer(html);
    mountTaskDrawer(t);

    function prop(label, val) {
      return '<div class="prop"><span class="prop-label">' + label + '</span><span class="prop-val">' + val + '</span></div>';
    }
    function section(title, body) {
      return '<div class="drawer-section"><h3>' + title + '</h3>' + body + '</div>';
    }
  }

  /* ---------- Checklist do drawer (adicionar / marcar / remover) ---------- */
  function ckItemHtml(ck) {
    return '<label class="ck-item ' + (ck.done ? 'checked' : '') + '">' +
      '<input type="checkbox" data-ck="' + ck.id + '" ' + (ck.done ? 'checked' : '') + '>' +
      '<span class="ck-box">' + ui.icon('check', 12) + '</span>' +
      '<span class="ck-text">' + ui.escapeHtml(ck.text) + '</span>' +
      (ck.due ? '<span class="ck-date">' + ui.icon('calendar', 12) + ui.fmtDate(ck.due) + '</span>' : '') +
      '<button type="button" class="ck-del" data-ck-del="' + ck.id + '" title="Remover item">' + ui.icon('trash', 13) + '</button>' +
      '</label>';
  }
  function ckUpdateCounts(root, t) {
    const items = t.checklist || [];
    const done = items.filter((c) => c.done).length, total = items.length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const cnt = root.querySelector('.sec-count'); if (cnt) cnt.textContent = done + '/' + total;
    const fill = root.querySelector('.ck-progress .progress-fill'); if (fill) fill.style.width = pct + '%';
    const card = document.querySelector('.task-card[data-task="' + t.id + '"] .checklist-mini');
    if (card) card.innerHTML = total ? ui.icon('check', 13) + done + '/' + total : '';
  }
  function wireChecklist(root, t) {
    root.querySelectorAll('[data-ck]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        try { await App.mutations.toggleChecklist(t.id, cb.getAttribute('data-ck')); }
        catch (e) { cb.checked = !cb.checked; ui.toast('Erro ao salvar', 'error'); return; }
        cb.closest('.ck-item').classList.toggle('checked', cb.checked);
        ckUpdateCounts(root, t);
      });
    });
    root.querySelectorAll('[data-ck-del]').forEach((b) => {
      b.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = b.getAttribute('data-ck-del');
        try { await App.api.delChecklist(id); }
        catch (err) { ui.toast('Erro ao remover', 'error'); return; }
        t.checklist = (t.checklist || []).filter((c) => c.id !== id);
        renderChecklist(root, t);
      });
    });
  }
  function renderChecklist(root, t) {
    const host = root.querySelector('.checklist');
    if (!host) return;
    host.innerHTML = (t.checklist || []).map(ckItemHtml).join('') || '<p class="empty-mini">Sem itens.</p>';
    ckUpdateCounts(root, t);
    wireChecklist(root, t);
  }

  function mountTaskDrawer(t) {
    const root = document.getElementById('drawer');
    if (!root) return;
    root.querySelectorAll('[data-close-drawer]').forEach((b) => b.addEventListener('click', ui.closeDrawer));
    root.querySelectorAll('[data-close-drawer-nav]').forEach((a) => a.addEventListener('click', ui.closeDrawer));

    // Editar tarefa
    const editBtn = root.querySelector('[data-edit-task]');
    if (editBtn) editBtn.addEventListener('click', () => openTaskForm({
      taskId: t.id,
      onSaved: (saved) => { if (App.render) App.render(); openTaskDrawer(saved.id); }
    }));

    // Checklist: marcar / remover / adicionar (vários itens, sem limite)
    wireChecklist(root, t);
    const ckInput = root.querySelector('#ck-add-input');
    const ckDate = root.querySelector('#ck-add-date');
    const ckBtn = root.querySelector('#ck-add-btn');
    async function addCk() {
      const txt = (ckInput.value || '').trim();
      if (!txt) { ckInput.focus(); return; }
      ckBtn.disabled = true;
      let item;
      try { item = await App.api.addChecklist(t.id, txt, ckDate.value || null); }
      catch (e) { ckBtn.disabled = false; ui.toast('Erro ao adicionar item', 'error'); return; }
      t.checklist = t.checklist || [];
      t.checklist.push({ id: item.id, text: item.texto, done: !!item.concluido, due: item.prazo || null });
      ckInput.value = ''; ckDate.value = ''; ckBtn.disabled = false;
      renderChecklist(root, t);
      ckInput.focus();
    }
    if (ckBtn) ckBtn.addEventListener('click', addCk);
    if (ckInput) ckInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCk(); } });

    // Comentário
    const input = root.querySelector('#comment-input');
    const send = root.querySelector('#comment-send');
    async function submit() {
      const v = input.value.trim();
      if (!v) return;
      send.disabled = true;
      try { await App.mutations.addComment(t.id, v); }
      catch (e) { send.disabled = false; ui.toast('Erro ao comentar', 'error'); return; }
      const u = App.currentUser || { id: null, name: 'Você', color: '#6366f1' };
      const list = root.querySelector('.comments');
      if (list.querySelector('.empty-mini')) list.innerHTML = '';
      const el = document.createElement('div');
      el.className = 'comment';
      el.innerHTML = (u.id ? ui.avatar(u.id, 28) : '<span class="avatar" style="width:28px;height:28px;background:' + u.color + '">' + ui.initials(u.name) + '</span>') +
        '<div class="comment-body"><div class="comment-head"><strong>' + ui.escapeHtml(u.name) + '</strong><span>Agora</span></div><p>' +
        ui.escapeHtml(v) + '</p></div>';
      list.appendChild(el);
      input.value = ''; send.disabled = false;
      ui.toast('Comentário adicionado', 'success');
    }
    if (send) send.addEventListener('click', submit);
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  /* ---------- FORMULÁRIO DE ATIVIDADE (criar / editar) ---------- */
  function openTaskForm(opts) {
    opts = opts || {};
    const editing = !!opts.taskId;
    const t = editing ? S.task(opts.taskId) : null;
    const preset = opts.preset || {};
    // valores iniciais
    const v = {
      title: t ? t.title : '',
      campaignId: t ? t.campaignId : (preset.campaignId || S.campaigns()[0].id),
      stageId: t ? t.stageId : (preset.stageId || S.campaign(preset.campaignId || S.campaigns()[0].id).stage),
      status: t ? t.status : (preset.status || 'todo'),
      assigneeId: t ? t.assigneeId : (preset.assigneeId || S.users()[0].id),
      priority: t ? t.priority : (preset.priority || 'media'),
      dueDate: t ? t.dueDate : (preset.dueDate || App.TODAY),
      startDate: t ? (t.startDate || '') : '',
      labels: t ? (t.labels || []).slice() : [],
      description: t ? t.description : '',
      rotina: t ? !!t.rotina : !!preset.rotina,
      checklist: t ? (t.checklist || []).map((c) => ({ text: c.text, done: c.done, due: c.due || '' })) : []
    };

    const opt = (arr, val, fn) => arr.map((x) => {
      const o = fn(x);
      return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + ui.escapeHtml(o[1]) + '</option>';
    }).join('');

    const labelChips = S.labels().map((l) =>
      '<button type="button" class="lbl-toggle ' + (v.labels.includes(l.id) ? 'on' : '') + '" data-lbl="' + l.id +
      '" style="--c:' + l.color + '">' + l.name + '</button>'
    ).join('');

    const ckRows = v.checklist.map((c) => ckRow(c.text, c.done, c.due)).join('');

    const html = '' +
      '<div class="modal-head"><h2>' + ui.icon(editing ? 'edit' : 'plus', 18) + ' ' +
        (editing ? 'Editar atividade' : 'Nova atividade') + '</h2>' +
        '<button class="icon-btn" data-close aria-label="Fechar">' + ui.icon('x', 20) + '</button></div>' +
      '<form id="tf-form" class="modal-body form-grid">' +
        '<label class="field form-full"><span>Título *</span>' +
          '<input name="title" required placeholder="Ex.: Produzir vídeo institucional" value="' + ui.escapeHtml(v.title) + '"></label>' +
        '<label class="field"><span>Campanha *</span><select name="campaignId">' +
          opt(S.campaigns(), v.campaignId, (c) => [c.id, c.candidate + ' — ' + c.office]) + '</select></label>' +
        '<label class="field"><span>Etapa</span><select name="stageId">' +
          opt(S.stages(), v.stageId, (s) => [s.id, s.name]) + '</select></label>' +
        '<label class="field"><span>Responsável</span><select name="assigneeId">' +
          opt(S.users(), v.assigneeId, (u) => [u.id, u.name]) + '</select></label>' +
        '<label class="field"><span>Status</span><select name="status">' +
          opt(S.statuses(), v.status, (s) => [s.id, s.name]) + '</select></label>' +
        '<label class="field"><span>Prioridade</span><select name="priority">' +
          opt(S.priorities(), v.priority, (p) => [p.id, p.name]) + '</select></label>' +
        '<div class="field form-full"><span>Rotina</span>' +
          '<label class="tf-rotina"><input type="checkbox" name="rotina" ' + (v.rotina ? 'checked' : '') + '>' +
            '<span class="sc-check-box">' + ui.icon('check', 12) + '</span>' +
            ' Tarefa de rotina (vai para a coluna <b>Rotina</b> do Kanban)</label></div>' +
        '<label class="field"><span>Início (opcional)</span><input type="date" name="startDate" value="' + v.startDate + '"></label>' +
        '<label class="field"><span>Prazo *</span><input type="date" name="dueDate" required value="' + v.dueDate + '"></label>' +
        '<div class="field form-full"><span>Etiquetas</span><div class="lbl-toggles" id="tf-labels">' + labelChips +
          '<button type="button" class="lbl-new" id="tf-lbl-new">' + ui.icon('plus', 13) + 'Nova etiqueta</button>' +
          '</div>' +
          '<div class="lbl-creator" id="tf-lbl-creator" hidden>' +
            '<input type="text" id="tf-lbl-nome" placeholder="Nome da etiqueta" maxlength="40">' +
            '<input type="color" id="tf-lbl-cor" value="#6366f1" title="Cor">' +
            '<button type="button" class="btn btn-sm btn-primary" id="tf-lbl-save">Criar</button>' +
            '<button type="button" class="btn btn-sm" id="tf-lbl-cancel">Cancelar</button>' +
          '</div></div>' +
        '<label class="field form-full"><span>Descrição</span>' +
          '<textarea name="description" rows="3" placeholder="Detalhe o que precisa ser feito…">' + ui.escapeHtml(v.description) + '</textarea></label>' +
        '<div class="field form-full"><span>Checklist</span>' +
          '<div class="ckedit" id="tf-ck">' + ckRows + '</div>' +
          '<button type="button" class="btn btn-sm btn-ghost ckedit-add" id="tf-ck-add">' + ui.icon('plus', 14) + 'Adicionar item</button></div>' +
        '<div class="form-full modal-foot">' +
          '<button type="button" class="btn" data-close>Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">' + ui.icon(editing ? 'check' : 'plus', 16) +
            (editing ? 'Salvar alterações' : 'Criar atividade') + '</button></div>' +
      '</form>';

    const overlay = ui.openModal(html, { size: 'modal-lg' });
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', ui.closeModal));

    // etiquetas toggle
    overlay.querySelectorAll('[data-lbl]').forEach((b) =>
      b.addEventListener('click', () => b.classList.toggle('on')));

    // criar nova etiqueta (inline — não empilha modal)
    const lblNewBtn = overlay.querySelector('#tf-lbl-new');
    const lblCreator = overlay.querySelector('#tf-lbl-creator');
    const lblNome = overlay.querySelector('#tf-lbl-nome');
    const lblCor = overlay.querySelector('#tf-lbl-cor');
    if (lblNewBtn) {
      lblNewBtn.addEventListener('click', () => {
        lblCreator.hidden = false; lblNewBtn.hidden = true; lblNome.focus();
      });
      overlay.querySelector('#tf-lbl-cancel').addEventListener('click', () => {
        lblCreator.hidden = true; lblNewBtn.hidden = false; lblNome.value = '';
      });
      const saveBtn = overlay.querySelector('#tf-lbl-save');
      const doSave = async () => {
        const nome = lblNome.value.trim();
        if (!nome) { lblNome.focus(); return; }
        saveBtn.disabled = true;
        let nova;
        try { nova = await App.api.criarEtiqueta(nome, lblCor.value); }
        catch (err) { saveBtn.disabled = false; ui.toast('Erro: ' + (err.message || 'não foi possível criar'), 'error'); return; }
        // atualiza cache global de etiquetas
        App.data.labels.push({ id: nova.id, name: nova.nome, color: nova.cor });
        // injeta o chip (já ativado) antes do botão "Nova etiqueta"
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'lbl-toggle on';
        chip.setAttribute('data-lbl', nova.id);
        chip.style.setProperty('--c', nova.cor);
        chip.textContent = nova.nome;
        chip.addEventListener('click', () => chip.classList.toggle('on'));
        lblNewBtn.parentNode.insertBefore(chip, lblNewBtn);
        lblNome.value = ''; saveBtn.disabled = false;
        lblCreator.hidden = true; lblNewBtn.hidden = false;
        ui.toast('Etiqueta “' + nova.nome + '” criada', 'success');
      };
      saveBtn.addEventListener('click', doSave);
      lblNome.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
    }

    // checklist editor
    const ckHost = overlay.querySelector('#tf-ck');
    overlay.querySelector('#tf-ck-add').addEventListener('click', () => {
      ckHost.insertAdjacentHTML('beforeend', ckRow('', false, ''));
      const rows = ckHost.querySelectorAll('.ckedit-row input[type="text"]');
      rows[rows.length - 1].focus();
      wireCkRemove();
    });
    function wireCkRemove() {
      ckHost.querySelectorAll('[data-ck-remove]').forEach((b) => {
        b.onclick = () => b.closest('.ckedit-row').remove();
      });
    }
    wireCkRemove();

    overlay.querySelector('#tf-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const labels = [].slice.call(overlay.querySelectorAll('.lbl-toggle.on')).map((b) => b.getAttribute('data-lbl'));
      const checklist = [].slice.call(ckHost.querySelectorAll('.ckedit-row')).map((row) => ({
        text: row.querySelector('input[type="text"]').value.trim(),
        done: row.querySelector('input[type="checkbox"]').checked,
        due: (row.querySelector('.ckedit-date').value || '') || null
      })).filter((c) => c.text);
      const payload = {
        title: fd.get('title').trim(),
        campaignId: fd.get('campaignId'),
        stageId: fd.get('stageId'),
        status: fd.get('status'),
        assigneeId: fd.get('assigneeId') || null,
        priority: fd.get('priority'),
        dueDate: fd.get('dueDate') || null,
        startDate: fd.get('startDate') || null,
        description: fd.get('description').trim(),
        rotina: overlay.querySelector('input[name="rotina"]').checked,
        labels: labels,
        checklist: checklist
      };
      const btn = overlay.querySelector('#tf-form button[type="submit"]');
      if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
      let saved;
      try {
        if (editing) saved = await App.mutations.updateTask(opts.taskId, payload);
        else saved = await App.mutations.addTask(payload);
      } catch (err) {
        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
        ui.toast('Erro ao salvar: ' + (err.message || ''), 'error');
        return;
      }
      ui.closeModal();
      ui.toast(editing ? 'Atividade atualizada' : 'Atividade “' + saved.title + '” criada', 'success');
      if (opts.onSaved) opts.onSaved(saved);
      else if (App.render) App.render();
    });

    function ckRow(text, done, due) {
      return '<div class="ckedit-row">' +
        '<label class="ckedit-check"><input type="checkbox" ' + (done ? 'checked' : '') + '>' +
          '<span class="sc-check-box">' + ui.icon('check', 11) + '</span></label>' +
        '<input type="text" class="ckedit-text" placeholder="Item do checklist" value="' + ui.escapeHtml(text) + '">' +
        '<input type="date" class="ckedit-date" title="Data do item" value="' + (due || '') + '">' +
        '<button type="button" class="icon-btn ckedit-del" data-ck-remove aria-label="Remover">' + ui.icon('trash', 15) + '</button>' +
      '</div>';
    }
  }

  App.components = {
    sidebar, topbar, progressBar, campaignCard, pipeline, taskCard,
    openTaskDrawer, openTaskForm, NAV
  };
})(window.App = window.App || {});
