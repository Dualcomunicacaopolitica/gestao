/* =============================================================
   VIEW: CAMPANHAS — lista completa com filtros e nova campanha
   ============================================================= */
(function (App) {
  'use strict';
  const S = App.select, ui = App.ui, C = App.components;

  // filtros em memória para esta view
  const f = App.state.filters.campaigns = App.state.filters.campaigns || {
    q: '', status: '', stage: '', owner: '', view: 'table'
  };

  App.views.campaigns = function () {
    const html = '' +
      '<div class="toolbar">' +
        '<div class="toolbar-search">' + ui.icon('search', 17) +
          '<input id="c-search" type="text" placeholder="Buscar candidato, cargo ou cidade…" value="' + ui.escapeHtml(f.q) + '"></div>' +
        '<div class="toolbar-filters">' +
          select('c-status', 'Status', [['', 'Todos os status'], ['active', 'Ativa'], ['paused', 'Pausada'], ['closed', 'Encerrada']], f.status) +
          select('c-stage', 'Etapa', [['', 'Todas as etapas']].concat(S.stages().map((s) => [s.id, s.name])), f.stage) +
          select('c-owner', 'Responsável', [['', 'Todos os responsáveis']].concat(S.users().map((u) => [u.id, u.name])), f.owner) +
          '<div class="view-toggle">' +
            '<button class="vt-btn ' + (f.view === 'table' ? 'active' : '') + '" data-view="table" title="Tabela">' + ui.icon('timeline', 16) + '</button>' +
            '<button class="vt-btn ' + (f.view === 'grid' ? 'active' : '') + '" data-view="grid" title="Cards">' + ui.icon('grid', 16) + '</button>' +
          '</div>' +
        '</div>' +
        '<button class="btn btn-primary" id="new-campaign">' + ui.icon('plus', 16) + 'Nova campanha</button>' +
      '</div>' +
      '<div id="camp-results"></div>';

    return { title: 'Campanhas', subtitle: '', html: html, mount: mount };
  };

  function select(id, label, opts, val) {
    return '<div class="sel-wrap">' + ui.icon('filter', 14) +
      '<select id="' + id + '" aria-label="' + label + '">' +
      opts.map((o) => '<option value="' + o[0] + '" ' + (o[0] === val ? 'selected' : '') + '>' + o[1] + '</option>').join('') +
      '</select></div>';
  }

  function apply() {
    let list = S.campaigns().slice();
    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter((c) => (c.candidate + ' ' + c.office + ' ' + c.location + ' ' + c.party).toLowerCase().includes(q));
    }
    if (f.status) list = list.filter((c) => c.status === f.status);
    if (f.stage) list = list.filter((c) => c.stage === f.stage);
    if (f.owner) list = list.filter((c) => c.ownerId === f.owner || (c.teamIds || []).includes(f.owner));
    return list;
  }

  function render() {
    const host = document.getElementById('camp-results');
    const list = apply();
    if (!list.length) {
      host.innerHTML = '<div class="empty-state">' + ui.icon('search', 32) +
        '<h3>Nenhuma campanha encontrada</h3><p>Ajuste os filtros ou crie uma nova campanha.</p></div>';
      return;
    }
    if (f.view === 'grid') {
      host.innerHTML = '<div class="camp-grid">' + list.map(C.campaignCard).join('') + '</div>';
      return;
    }
    // Tabela
    const rows = list.map((c) => {
      const st = S.campaignStats(c.id);
      const risk = S.riskOf(c.id);
      const stage = S.stage(c.stage);
      return '<tr class="row-click" data-camp="' + c.id + '">' +
        '<td><div class="cell-camp">' + ui.campAvatar(c, 'sm') +
          '<div><strong>' + ui.escapeHtml(c.candidate) +
            (c.fixed ? ' <span class="camp-fixed-badge">Interno</span>' : '') +
            '</strong><span>' + ui.escapeHtml(c.party) + '</span></div></div></td>' +
        '<td>' + ui.escapeHtml(c.office) + '</td>' +
        '<td><span class="muted">' + ui.icon('location', 13) + ui.escapeHtml(c.location) + '</span></td>' +
        '<td><span class="stage-tag sm">' + stage.name + '</span></td>' +
        '<td><div class="cell-progress">' + C.progressBar(c.progress, c.color) + '<span>' + c.progress + '%</span></div></td>' +
        '<td><span class="cell-owner">' + (S.user(c.ownerId) ? ui.avatar(c.ownerId, 24) + S.user(c.ownerId).name.split(' ')[0] : '<span class="muted">—</span>') + '</span></td>' +
        '<td>' + ui.riskDot(risk, true) + '</td>' +
      '</tr>';
    }).join('');

    host.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>Campanha</th><th>Cargo</th><th>Localização</th><th>Etapa</th><th>Progresso</th><th>Responsável</th><th>Status</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="result-count">' + list.length + ' campanha' + (list.length > 1 ? 's' : '') + '</p>';

    host.querySelectorAll('.row-click').forEach((r) =>
      r.addEventListener('click', () => { location.hash = '#/campanha/' + r.getAttribute('data-camp'); }));
  }

  function mount(root) {
    render();
    const q = root.querySelector('#c-search');
    q.addEventListener('input', () => { f.q = q.value; render(); });
    root.querySelector('#c-status').addEventListener('change', (e) => { f.status = e.target.value; render(); });
    root.querySelector('#c-stage').addEventListener('change', (e) => { f.stage = e.target.value; render(); });
    root.querySelector('#c-owner').addEventListener('change', (e) => { f.owner = e.target.value; render(); });
    root.querySelectorAll('.vt-btn').forEach((b) => b.addEventListener('click', () => {
      f.view = b.getAttribute('data-view');
      root.querySelectorAll('.vt-btn').forEach((x) => x.classList.toggle('active', x === b));
      render();
    }));
    root.querySelector('#new-campaign').addEventListener('click', openNewCampaignModal);
  }

  /* ---------- MODAL: Nova campanha ---------- */
  function openNewCampaignModal() {
    const stageOpts = S.stages().map((s) => '<option value="' + s.id + '">' + s.name + '</option>').join('');
    const ownerOpts = S.users().map((u) => '<option value="' + u.id + '">' + u.name + '</option>').join('');
    const html = '' +
      '<div class="modal-head"><h2>Nova campanha</h2>' +
        '<button class="icon-btn" data-close aria-label="Fechar">' + ui.icon('x', 20) + '</button></div>' +
      '<form id="nc-form" class="modal-body form-grid">' +
        field('Candidato / Cliente', '<input name="candidate" required placeholder="Ex.: João Silva">') +
        ui.cargoField('office', '') +
        '<label class="field form-full"><span>Cidade/Estado</span>' +
          '<input name="location" autocomplete="off" placeholder="Digite a cidade… (ex.: Florianópolis)"></label>' +
        field('Partido / Coligação', '<input name="party" placeholder="Ex.: Coligação Avança">') +
        field('Etapa atual', '<select name="stage">' + stageOpts + '</select>') +
        field('Responsável', '<select name="ownerId">' + ownerOpts + '</select>') +
        field('Progresso inicial (%)', '<input type="number" name="progress" min="0" max="100" value="0">') +
        '<div class="form-full modal-foot"><button type="button" class="btn" data-close>Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">' + ui.icon('plus', 16) + 'Criar campanha</button></div>' +
      '</form>';
    const overlay = ui.openModal(html, { size: 'modal-lg' });
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', ui.closeModal));
    ui.wireCargoField(overlay);
    ui.attachCityAutocomplete(overlay.querySelector('input[name="location"]'));
    overlay.querySelector('#nc-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const office = ui.readCargo(fd, 'office');
      if (!office) { ui.toast('Informe o cargo', 'error'); return; }
      const btn = overlay.querySelector('#nc-form button[type="submit"]');
      if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
      let c;
      try {
        c = await App.mutations.addCampaign({
          candidate: fd.get('candidate'), office: office, location: fd.get('location') || '',
          party: fd.get('party') || '—', stage: fd.get('stage'), ownerId: fd.get('ownerId'),
          progress: parseInt(fd.get('progress'), 10) || 0,
          color: '#6366f1'
        });
      } catch (err) {
        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
        ui.toast('Erro ao criar campanha: ' + (err.message || ''), 'error');
        return;
      }
      ui.closeModal();
      ui.toast('Campanha "' + c.candidate + '" criada', 'success');
      render();
    });

    function field(label, input) {
      return '<label class="field"><span>' + label + '</span>' + input + '</label>';
    }
  }
})(window.App = window.App || {});
