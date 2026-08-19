/* =============================================================
   VIEW: CAMPANHA (detalhe) — abas internas
   Abas: visao | kanban | atividades | equipe | historico
   Rota: #/campanha/:id  ou  #/campanha/:id/:tab
   ============================================================= */
(function (App) {
  'use strict';
  const S = App.select, ui = App.ui, C = App.components;

  const TABS = [
    ['visao', 'Visão geral'],
    ['anotacoes', 'Anotações'],
    ['kanban', 'Kanban'],
    ['atividades', 'Atividades'],
    ['equipe', 'Equipe'],
    ['historico', 'Histórico']
  ];

  App.views.campaign = function (params) {
    const c = S.campaign(params.id);
    if (!c) return { title: 'Campanha', html: notFound(), mount: function () {} };
    const tab = params.tab && TABS.some((t) => t[0] === params.tab) ? params.tab : 'visao';
    const st = S.campaignStats(c.id);
    const risk = S.riskOf(c.id);

    const cur = App.currentUser || {};
    // Só estes usuários podem excluir campanhas (mesma lista do backend)
    const PODEM_EXCLUIR = ['yara', 'lucas', 'lari'];
    const canDelete = PODEM_EXCLUIR.indexOf((cur.name || '').trim().toLowerCase()) >= 0 && !c.fixed;
    const header = '' +
      '<div class="camp-topbar">' +
        '<a class="back-link" href="#/campaigns">' + ui.icon('arrowLeft', 16) + 'Campanhas</a>' +
        '<div class="camp-header-actions">' +
          '<button class="btn btn-sm" id="camp-edit-info">' + ui.icon('edit', 14) + 'Editar informações</button>' +
          (canDelete ? '<button class="btn-trash" id="camp-delete" title="Excluir campanha" aria-label="Excluir campanha">' + ui.icon('trash', 16) + '</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="camp-header">' +
        '<div class="camp-avatar-wrap" id="camp-photo" title="Clique para alterar a foto">' +
          (c.photo
            ? '<img class="camp-avatar lg" id="camp-photo-img" src="' + c.photo + '" alt="' + ui.escapeHtml(c.candidate) + '">'
            : '<span class="camp-avatar lg" id="camp-photo-img" style="background:' + c.color + '">' + ui.initials(c.candidate) + '</span>') +
        '</div>' +
        '<div class="camp-header-main">' +
          '<div class="camp-header-title"><h1>' + ui.escapeHtml(c.candidate) + '</h1>' + ui.riskDot(risk, true) + '</div>' +
          '<p>' + ui.icon('flag', 14) + ui.escapeHtml(c.office) + ' — ' + ui.escapeHtml(c.location) +
            ' · ' + ui.escapeHtml(c.party) + '</p>' +
        '</div>' +
        '<div class="camp-header-stats">' +
          hstat('Status', statusPill(c)) +
          hstat('Progresso', '<strong>' + c.progress + '%</strong>') +
          hstat('Responsável', '<span class="prop-user">' + (S.user(c.ownerId) ? ui.avatar(c.ownerId, 22) + S.user(c.ownerId).name : '<span class="muted">Sem responsável</span>') + '</span>') +
        '</div>' +
      '</div>' +
      '<div class="camp-tabs">' + TABS.map((t) =>
        '<a class="camp-tab ' + (t[0] === tab ? 'active' : '') + '" href="#/campanha/' + c.id + '/' + t[0] + '">' + t[1] + '</a>'
      ).join('') + '</div>';

    return {
      title: c.candidate,
      subtitle: c.office + ' — ' + c.location,
      html: header + '<div class="camp-tab-body" id="camp-tab-body"></div>',
      mount: function (root) {
        renderTab(root, c, tab); wirePhoto(root, c);
        root.querySelector('#camp-edit-info').addEventListener('click', () => openHeaderEdit(c));
        const del = root.querySelector('#camp-delete');
        if (del) del.addEventListener('click', () => excluirCampanha(c));
      }
    };

    function hstat(l, v) { return '<div class="hstat"><span>' + l + '</span>' + v + '</div>'; }
  };

  const STATUS_INFO = { active: ['#22c55e', 'Ativa'], paused: ['#f59e0b', 'Pausada'], closed: ['#94a3b8', 'Encerrada'] };
  function statusPill(c) {
    const s = STATUS_INFO[c.status] || STATUS_INFO.active;
    return '<span class="pill" style="--c:' + s[0] + '"><span class="pill-dot"></span>' + s[1] + '</span>';
  }

  /* ---------- Editar Status / Progresso / Responsável ---------- */
  function openHeaderEdit(c) {
    const statusOpts = [['active', 'Ativa'], ['paused', 'Pausada'], ['closed', 'Encerrada']];
    const ownerOpts = [['', '— Sem responsável —']].concat(S.users().map((u) => [u.id, u.name]));
    const opt = (arr, val) => arr.map((o) => '<option value="' + o[0] + '"' + (String(o[0]) === String(val || '') ? ' selected' : '') + '>' + ui.escapeHtml(o[1]) + '</option>').join('');
    const html = '' +
      '<div class="modal-head"><h2>' + ui.icon('edit', 18) + ' Editar informações</h2>' +
        '<button class="icon-btn" data-close aria-label="Fechar">' + ui.icon('x', 20) + '</button></div>' +
      '<form id="ce-form" class="modal-body form-grid">' +
        '<label class="field"><span>Status</span><select name="status">' + opt(statusOpts, c.status) + '</select></label>' +
        '<label class="field"><span>Responsável</span><select name="ownerId">' + opt(ownerOpts, c.ownerId) + '</select></label>' +
        '<label class="field form-full"><span>Progresso — <b id="ce-prog-val">' + c.progress + '%</b></span>' +
          '<input type="range" name="progress" min="0" max="100" step="5" value="' + c.progress + '" id="ce-prog"></label>' +
        '<div class="form-full modal-foot"><button type="button" class="btn" data-close>Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">' + ui.icon('check', 16) + 'Salvar</button></div>' +
      '</form>';
    const ov = ui.openModal(html, { size: 'modal-lg' });
    ov.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', ui.closeModal));
    const range = ov.querySelector('#ce-prog'), pval = ov.querySelector('#ce-prog-val');
    range.addEventListener('input', () => { pval.textContent = range.value + '%'; });
    ov.querySelector('#ce-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = ov.querySelector('#ce-form button[type="submit"]'); btn.disabled = true;
      try {
        await App.mutations.updateCampaign(c.id, {
          status: fd.get('status'),
          ownerId: fd.get('ownerId') || null,
          progress: parseInt(fd.get('progress'), 10) || 0,
        });
      } catch (err) { btn.disabled = false; ui.toast('Erro ao salvar: ' + (err.message || ''), 'error'); return; }
      ui.closeModal();
      ui.toast('Informações atualizadas', 'success');
      if (App.render) App.render();
    });
  }

  function excluirCampanha(c) {
    if (!confirm('Excluir a campanha “' + c.candidate + '”?\n\nIsto remove TODAS as atividades, anotações, arquivos e senhas dela. Esta ação não pode ser desfeita.')) return;
    App.mutations.deleteCampaign(c.id)
      .then(() => { ui.toast('Campanha excluída', 'success'); location.hash = '#/campaigns'; })
      .catch((err) => ui.toast('Erro ao excluir: ' + (err.message || ''), 'error'));
  }

  function renderTab(root, c, tab) {
    const body = root.querySelector('#camp-tab-body');
    if (tab === 'visao') return renderVisao(body, c);
    if (tab === 'anotacoes') return App.anotacoes.render(body, c);
    if (tab === 'kanban') return renderKanban(body, c);
    if (tab === 'atividades') return renderAtividades(body, c);
    if (tab === 'equipe') return renderEquipe(body, c);
    if (tab === 'historico') return renderHistorico(body, c);
  }

  /* ---------- Aba: Visão geral ---------- */
  function renderVisao(body, c) {
    const st = S.campaignStats(c.id);
    const cards = [
      ['Atividades', st.total, 'kanban', 'primary'],
      ['Em andamento', st.inProgress, 'clock', 'info'],
      ['Aguardando revisão', st.review, 'alert', 'warning'],
      ['Atrasadas', st.overdue, 'alert', 'danger']
    ].map((s) => '<div class="mini-stat tone-' + s[3] + '">' + ui.icon(s[2], 18) +
      '<div><span class="ms-value">' + s[1] + '</span><span class="ms-label">' + s[0] + '</span></div></div>').join('');

    const next = S.tasksByCampaign(c.id)
      .filter((t) => t.status !== 'done')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
    const nextRows = next.map((t) => taskRow(t)).join('') || '<p class="empty-mini">Tudo concluído.</p>';

    body.innerHTML = '' +
      '<div class="mini-stat-grid">' + cards + '</div>' +
      '<div class="two-col">' +
        '<section class="panel" id="about-panel">' +
          '<div class="panel-head"><h3>Sobre a campanha</h3>' +
            '<button class="btn btn-sm btn-ghost" id="about-edit">' + ui.icon('edit', 13) + 'Editar</button></div>' +
          '<p class="drawer-desc">' + ui.escapeHtml(c.description) + '</p>' +
          '<div class="about-grid" id="about-view">' +
            about('Cargo', c.office) + about('Localização', c.location) +
            about('Coligação', c.party) +
          '</div>' +
          notesBlock(c) +
        '</section>' +
        '<section class="panel"><div class="panel-head"><h3>Próximas entregas</h3></div>' +
          '<div class="task-list">' + nextRows + '</div></section>' +
      '</div>' +
      '<section class="panel" id="vault-panel">' +
        '<div class="panel-head"><h3>' + ui.icon('settings', 15) + ' Senhas e acessos</h3>' +
          '<button class="btn btn-sm btn-primary" id="vault-add">' + ui.icon('plus', 14) + 'Adicionar acesso</button></div>' +
        '<p class="muted vault-hint">' + ui.icon('alert', 13) + ' As senhas ficam criptografadas. Clique em “Revelar” para ver.</p>' +
        '<div id="vault-list" class="vault-list"><p class="empty-mini">Carregando…</p></div>' +
      '</section>';
    wireRows(body);
    wireAbout(body, c);
    wireNotes(body, c);
    body.querySelector('#vault-add').addEventListener('click', () => openCredForm(body, c, null));
    loadVault(body, c);

    function about(l, v) { return '<div class="about-item"><span>' + l + '</span><strong>' + ui.escapeHtml(v || '—') + '</strong></div>'; }
  }

  /* ---------- Sobre a campanha: edição inline (cargo, cidade, coligação) ---------- */
  function wireAbout(body, c) {
    const panel = body.querySelector('#about-panel');
    if (!panel) return;
    const editBtn = panel.querySelector('#about-edit');
    const view = panel.querySelector('#about-view');
    editBtn.addEventListener('click', () => {
      if (panel.querySelector('#about-form')) return;
      editBtn.hidden = true; view.hidden = true;
      const form = document.createElement('div');
      form.className = 'about-editing'; form.id = 'about-form';
      form.innerHTML =
        ui.cargoField('office', c.office) +
        '<label class="field form-full"><span>Cidade/Estado</span>' +
          '<input name="location" autocomplete="off" value="' + ui.escapeHtml(c.location || '') + '" placeholder="Digite a cidade…"></label>' +
        '<label class="field form-full"><span>Coligação</span>' +
          '<input name="party" value="' + ui.escapeHtml(c.party || '') + '" placeholder="Partido / coligação"></label>' +
        '<div class="about-actions"><button type="button" class="btn btn-sm" id="about-cancel">Cancelar</button>' +
          '<button type="button" class="btn btn-sm btn-primary" id="about-save">Salvar</button></div>';
      view.insertAdjacentElement('afterend', form);
      ui.wireCargoField(form);
      ui.attachCityAutocomplete(form.querySelector('input[name="location"]'));
      const close = () => { form.remove(); view.hidden = false; editBtn.hidden = false; };
      form.querySelector('#about-cancel').addEventListener('click', close);
      form.querySelector('#about-save').addEventListener('click', async () => {
        const sel = form.querySelector('[data-cargo-sel]').value;
        const office = sel === 'Outro' ? (form.querySelector('input[name="office_outro"]').value || '').trim() : sel;
        if (!office) { ui.toast('Informe o cargo', 'error'); return; }
        const saveBtn = form.querySelector('#about-save'); saveBtn.disabled = true;
        try {
          await App.mutations.updateCampaign(c.id, {
            office: office,
            location: form.querySelector('input[name="location"]').value || '',
            party: form.querySelector('input[name="party"]').value || '',
          });
        } catch (e) { saveBtn.disabled = false; ui.toast('Erro ao salvar', 'error'); return; }
        ui.toast('Informações atualizadas', 'success');
        if (App.render) App.render();               // re-renderiza com os dados novos
        else close();
      });
    });
  }

  /* ---------- Sobre a campanha: anotações livres (texto + links) ---------- */
  function notesBlock(c) {
    return '<div class="notes-block" id="notes-block">' +
      '<div class="notes-head"><span class="notes-label">Anotações</span>' +
        '<button type="button" class="btn btn-sm btn-ghost" id="notes-edit">' + ui.icon('edit', 13) + 'Editar</button></div>' +
      '<div class="notes-view" id="notes-view">' + (c.notes ? linkify(c.notes) : '<span class="empty-mini">Sem anotações. Use “Editar” para adicionar textos, links, etc.</span>') + '</div>' +
      '<div class="notes-editor" id="notes-editor" hidden>' +
        '<textarea id="notes-text" rows="5" placeholder="Escreva textos, links, lembretes…">' + ui.escapeHtml(c.notes || '') + '</textarea>' +
        '<div class="notes-actions">' +
          '<button type="button" class="btn btn-sm" id="notes-cancel">Cancelar</button>' +
          '<button type="button" class="btn btn-sm btn-primary" id="notes-save">Salvar</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function wireNotes(body, c) {
    const block = body.querySelector('#notes-block');
    if (!block) return;
    const view = block.querySelector('#notes-view');
    const editor = block.querySelector('#notes-editor');
    const ta = block.querySelector('#notes-text');
    const editBtn = block.querySelector('#notes-edit');
    const show = (editing) => { editor.hidden = !editing; view.hidden = editing; editBtn.hidden = editing; if (editing) ta.focus(); };
    editBtn.addEventListener('click', () => show(true));
    block.querySelector('#notes-cancel').addEventListener('click', () => { ta.value = c.notes || ''; show(false); });
    block.querySelector('#notes-save').addEventListener('click', async () => {
      const val = ta.value;
      const btn = block.querySelector('#notes-save'); btn.disabled = true;
      try { await App.mutations.updateCampaign(c.id, { notes: val }); }
      catch (e) { btn.disabled = false; ui.toast('Erro ao salvar anotações', 'error'); return; }
      c.notes = val;
      view.innerHTML = val ? linkify(val) : '<span class="empty-mini">Sem anotações. Use “Editar” para adicionar textos, links, etc.</span>';
      btn.disabled = false; show(false);
      ui.toast('Anotações salvas', 'success');
    });
  }

  /* escapa HTML e transforma URLs em links clicáveis, preservando quebras */
  function linkify(text) {
    const esc = ui.escapeHtml(text);
    const withLinks = esc.replace(/(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>');
    return '<div class="notes-rendered">' + withLinks.replace(/\n/g, '<br>') + '</div>';
  }

  /* ---------- Cofre de senhas/acessos ---------- */
  function loadVault(body, c) {
    const host = body.querySelector('#vault-list');
    App.api.credenciais(c.id).then((list) => renderVault(body, c, list))
      .catch(() => { host.innerHTML = '<p class="empty-mini">Não foi possível carregar os acessos.</p>'; });
  }

  function renderVault(body, c, list) {
    const host = body.querySelector('#vault-list');
    if (!list.length) { host.innerHTML = '<p class="empty-mini">Nenhum acesso cadastrado ainda.</p>'; return; }
    host.innerHTML = list.map((cr) =>
      '<div class="vault-item" data-cred="' + cr.id + '">' +
        '<div class="vault-main">' +
          '<strong>' + ui.escapeHtml(cr.titulo) + '</strong>' +
          (cr.login ? '<span class="vault-login">' + ui.icon('users', 12) + ui.escapeHtml(cr.login) + '</span>' : '') +
          (cr.url ? '<a class="vault-url" href="' + encodeURI(cr.url) + '" target="_blank" rel="noopener">' + ui.icon('flag', 12) + 'abrir painel</a>' : '') +
        '</div>' +
        '<div class="vault-secret"><span class="vault-pass" data-pass>••••••••</span></div>' +
        '<div class="vault-actions">' +
          '<button type="button" class="btn btn-sm" data-reveal>' + ui.icon('eye', 14) + 'Revelar</button>' +
          '<button type="button" class="icon-btn" data-cred-edit title="Editar">' + ui.icon('edit', 15) + '</button>' +
          '<button type="button" class="icon-btn" data-cred-del title="Excluir">' + ui.icon('trash', 15) + '</button>' +
        '</div>' +
      '</div>'
    ).join('');
    host.querySelectorAll('.vault-item').forEach((row) => {
      const id = row.getAttribute('data-cred');
      const passEl = row.querySelector('[data-pass]');
      const revealBtn = row.querySelector('[data-reveal]');
      let shown = false, real = null;
      revealBtn.addEventListener('click', async () => {
        if (shown) { passEl.textContent = '••••••••'; passEl.classList.remove('on'); revealBtn.innerHTML = ui.icon('eye', 14) + 'Revelar'; shown = false; return; }
        if (real === null) {
          revealBtn.disabled = true;
          try { real = (await App.api.revelarCredencial(id)).senha; }
          catch (e) { revealBtn.disabled = false; ui.toast('Erro ao revelar', 'error'); return; }
          revealBtn.disabled = false;
        }
        passEl.textContent = real; passEl.classList.add('on');
        revealBtn.innerHTML = ui.icon('eyeOff', 14) + 'Ocultar'; shown = true;
      });
      row.querySelector('[data-cred-edit]').addEventListener('click', () => openCredForm(body, c, id));
      row.querySelector('[data-cred-del]').addEventListener('click', async () => {
        if (!confirm('Excluir este acesso?')) return;
        try { await App.api.excluirCredencial(id); } catch (e) { ui.toast('Erro ao excluir', 'error'); return; }
        loadVault(body, c);
        ui.toast('Acesso excluído', 'success');
      });
    });
  }

  function openCredForm(body, c, credId) {
    const editing = !!credId;
    const html = '' +
      '<div class="modal-head"><h2>' + ui.icon(editing ? 'edit' : 'plus', 18) + ' ' +
        (editing ? 'Editar acesso' : 'Novo acesso') + '</h2>' +
        '<button class="icon-btn" data-close aria-label="Fechar">' + ui.icon('x', 20) + '</button></div>' +
      '<form id="cred-form" class="modal-body form-grid">' +
        '<label class="field form-full"><span>Título *</span><input name="titulo" required placeholder="Ex.: Instagram do candidato"></label>' +
        '<label class="field"><span>Login / usuário</span><input name="login" placeholder="e-mail ou @usuário"></label>' +
        '<label class="field"><span>Link do painel</span><input name="url" placeholder="https://…"></label>' +
        '<label class="field form-full"><span>Senha ' + (editing ? '(deixe em branco p/ manter)' : '*') + '</span>' +
          '<input name="senha" type="text" ' + (editing ? '' : 'required') + ' placeholder="senha de acesso"></label>' +
        '<div class="form-full modal-foot"><button type="button" class="btn" data-close>Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">' + ui.icon('check', 16) + 'Salvar</button></div>' +
      '</form>';
    const overlay = ui.openModal(html, { size: 'modal-lg' });
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', ui.closeModal));
    overlay.querySelector('#cred-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        titulo: (fd.get('titulo') || '').trim(),
        login: (fd.get('login') || '').trim() || null,
        url: (fd.get('url') || '').trim() || null,
      };
      const senha = (fd.get('senha') || '').trim();
      const btn = overlay.querySelector('#cred-form button[type="submit"]');
      btn.disabled = true;
      try {
        if (editing) {
          if (senha) payload.senha = senha;
          await App.api.atualizarCredencial(credId, payload);
        } else {
          payload.senha = senha;
          await App.api.criarCredencial(c.id, payload);
        }
      } catch (err) { btn.disabled = false; ui.toast('Erro ao salvar: ' + (err.message || ''), 'error'); return; }
      ui.closeModal();
      loadVault(body, c);
      ui.toast('Acesso salvo', 'success');
    });
  }

  /* ---------- foto do candidato (clicar → menu Substituir/Remover) ---------- */
  function wirePhoto(root, c) {
    const wrap = root.querySelector('#camp-photo');
    if (!wrap) return;
    ui.attachPhotoMenu(wrap, {
      hasPhoto: () => !!c.photo,
      onPick: async (dataUrl) => {
        try { await App.mutations.updateCampaign(c.id, { photo: dataUrl }); }
        catch (e) { ui.toast('Erro ao salvar a foto', 'error'); return; }
        ui.toast('Foto atualizada', 'success');
        if (App.render) App.render();
      },
      onRemove: async () => {
        if (!confirm('Remover a foto desta campanha?')) return;
        try { await App.mutations.updateCampaign(c.id, { photo: null }); }
        catch (e) { ui.toast('Erro ao remover a foto', 'error'); return; }
        ui.toast('Foto removida', 'success');
        if (App.render) App.render();
      }
    });
  }

  /* ---------- Aba: Kanban da campanha ---------- */
  function renderKanban(body, c) {
    body.innerHTML = '<div class="tab-toolbar"><span class="muted">Arraste os cards para mudar o status</span>' +
      '<button class="btn btn-primary btn-sm" id="camp-new-task">' + ui.icon('plus', 15) + 'Nova tarefa</button></div>' +
      '<div id="camp-kb"></div>';
    const addInCol = (key) => {
      const preset = { campaignId: c.id, stageId: c.stage };
      if (key === App.kanban.ROTINA) preset.rotina = true; else preset.status = key;
      C.openTaskForm({ preset: preset, onSaved: () => build() });
    };
    const build = () => App.kanban.buildBoard(body.querySelector('#camp-kb'), () => S.tasksByCampaign(c.id), { showCampaign: false, onAdd: addInCol });
    build();
    body.querySelector('#camp-new-task').addEventListener('click', () => C.openTaskForm({
      preset: { campaignId: c.id, stageId: c.stage },
      onSaved: () => build()
    }));
  }

  /* ---------- Aba: Atividades (lista/tabela) ---------- */
  function renderAtividades(body, c) {
    const list = S.tasksByCampaign(c.id).slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const rows = list.map((t) => {
      const done = S.checklistDone(t), total = (t.checklist || []).length;
      return '<tr class="row-click" data-task="' + t.id + '">' +
        '<td><strong>' + ui.escapeHtml(t.title) + '</strong></td>' +
        '<td><span class="stage-tag sm">' + S.stage(t.stageId).name + '</span></td>' +
        '<td>' + ui.statusBadge(t.status) + '</td>' +
        '<td>' + ui.priorityBadge(t.priority) + '</td>' +
        '<td><span class="cell-owner">' + ui.avatar(t.assigneeId, 22) + S.user(t.assigneeId).name.split(' ')[0] + '</span></td>' +
        '<td class="' + (S.isOverdue(t) ? 'danger-text' : '') + '">' + ui.fmtDate(t.dueDate) + '</td>' +
        '<td>' + (total ? done + '/' + total : '—') + '</td></tr>';
    }).join('');
    body.innerHTML = '<div class="tab-toolbar"><span class="muted">' + list.length + ' atividade' + (list.length !== 1 ? 's' : '') + ' nesta campanha</span>' +
      '<button class="btn btn-primary btn-sm" id="camp-new-task2">' + ui.icon('plus', 15) + 'Nova tarefa</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>Atividade</th><th>Etapa</th><th>Status</th><th>Prioridade</th><th>Responsável</th><th>Prazo</th><th>Checklist</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    body.querySelectorAll('.row-click').forEach((r) =>
      r.addEventListener('click', () => C.openTaskDrawer(r.getAttribute('data-task'))));
    body.querySelector('#camp-new-task2').addEventListener('click', () => C.openTaskForm({
      preset: { campaignId: c.id, stageId: c.stage },
      onSaved: () => renderAtividades(body, c)
    }));
  }

  /* ---------- Aba: Equipe da campanha ---------- */
  function renderEquipe(body, c) {
    const ids = [c.ownerId].concat(c.teamIds || []).filter((id, i, arr) => id && arr.indexOf(id) === i);
    if (!ids.length) {
      body.innerHTML = '<div class="empty-state">' + ui.icon('team', 32) +
        '<h3>Sem equipe vinculada</h3><p>Esta campanha ainda não tem responsável ou membros.</p></div>';
      return;
    }
    const cards = ids.map((uid) => {
      const u = S.user(uid);
      const tasks = S.tasksByCampaign(c.id).filter((t) => t.assigneeId === uid);
      const overdue = tasks.filter((t) => S.isOverdue(t)).length;
      return '<a class="member-card card-hover" href="#/equipe/' + uid + '">' +
        ui.avatar(uid, 44) +
        '<div class="member-main"><strong>' + u.name + (uid === c.ownerId ? ' <span class="owner-tag">Responsável</span>' : '') + '</strong>' +
          '<span>' + u.role + '</span></div>' +
        '<div class="member-nums"><span>' + tasks.length + ' tarefas</span>' +
          (overdue ? '<span class="danger-text">' + overdue + ' atrasada' + (overdue > 1 ? 's' : '') + '</span>' : '<span class="ok-text">em dia</span>') +
        '</div></a>';
    }).join('');
    body.innerHTML = '<div class="member-grid">' + cards + '</div>';
  }

  /* ---------- Aba: Histórico ---------- */
  function renderHistorico(body, c) {
    const events = [];
    S.tasksByCampaign(c.id).forEach((t) => (t.history || []).forEach((h) =>
      events.push({ at: h.at, text: h.text, task: t.title })));
    events.sort((a, b) => b.at.localeCompare(a.at));
    const rows = events.map((e) =>
      '<div class="hist-item"><span class="hist-dot"></span><div><p>' + ui.escapeHtml(e.text) +
      ' <span class="muted">— ' + ui.escapeHtml(e.task) + '</span></p><span>' + ui.fmtDate(e.at, true) + '</span></div></div>'
    ).join('') || '<p class="empty-mini">Sem histórico.</p>';
    body.innerHTML = '<div class="panel"><div class="panel-head"><h3>Histórico da campanha</h3></div>' +
      '<div class="history">' + rows + '</div></div>';
  }

  /* ---------- helpers ---------- */
  function taskRow(t) {
    const overdue = S.isOverdue(t), today = S.isDueToday(t);
    const dueCls = overdue ? 'due-over' : (today ? 'due-today' : '');
    return '<div class="task-row card-hover" data-task="' + t.id + '">' +
      '<span class="tl-status-dot" style="background:' + S.status(t.status).color + '"></span>' +
      '<div class="task-row-main"><strong>' + ui.escapeHtml(t.title) + '</strong>' +
        '<span>' + S.stage(t.stageId).name + '</span></div>' +
      '<div class="task-row-meta">' + ui.priorityBadge(t.priority) +
        '<span class="due ' + dueCls + '">' + ui.fmtDate(t.dueDate) + '</span>' + ui.avatar(t.assigneeId, 22) + '</div></div>';
  }
  function wireRows(body) {
    body.querySelectorAll('.task-row[data-task]').forEach((r) =>
      r.addEventListener('click', () => C.openTaskDrawer(r.getAttribute('data-task'))));
  }
  function notFound() {
    return '<div class="empty-state">' + ui.icon('alert', 32) + '<h3>Campanha não encontrada</h3>' +
      '<p><a class="link" href="#/campaigns">Voltar para campanhas</a></p></div>';
  }
})(window.App = window.App || {});
