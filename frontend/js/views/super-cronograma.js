/* =============================================================
   VIEW: SUPER CRONOGRAMA  (timeline horizontal — estilo Notion)
   -------------------------------------------------------------
   Linha do tempo de TODAS as atividades da agência num eixo
   horizontal de datas. Cada atividade é uma barra posicionada
   do seu início até o prazo. As linhas (rows) agrupam por
   campanha ou por responsável. Cabeçalho de datas e coluna de
   rótulos ficam fixos (sticky). Clicar numa barra abre o drawer
   com o vínculo (campanha → etapa) da tarefa.
   ============================================================= */
(function (App) {
  'use strict';
  const S = App.select, ui = App.ui, C = App.components;

  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const LABEL_W = 184;
  const HEADER_H = 58;
  const BAR_H = 28, LANE_GAP = 6, ROW_PAD = 9;

  const f = App.state.filters.super = App.state.filters.super || {
    owner: '', campaigns: null, priority: '', hideDone: false, showRotina: true,
    groupBy: 'campaign', zoom: 'cozy', scale: 'day'
  };
  // migração de estado antigo (campaign string → campaigns array)
  if (f.campaigns === undefined) f.campaigns = null;
  if (!f.scale) f.scale = 'day';
  if (f.showRotina === undefined) f.showRotina = true;

  // campanhas visíveis: null = todas
  function selectedCampaigns() {
    return f.campaigns === null ? S.campaigns().map((c) => c.id) : f.campaigns;
  }
  function isAllSelected() {
    return f.campaigns === null || f.campaigns.length === S.campaigns().length;
  }

  // checklist (dropdown) de campanhas — "Todas" em primeiro lugar
  function campMenu() {
    const camps = S.campaigns();
    const sel = selectedCampaigns();
    const allOn = sel.length >= camps.length;
    const label = allOn ? 'Todas as campanhas' : (sel.length + ' de ' + camps.length + ' campanhas');
    const items =
      '<label class="sc-multi-item sc-multi-all"><input type="checkbox" id="sc-camp-all" ' + (allOn ? 'checked' : '') + '>' +
        '<span class="sc-check-box">' + ui.icon('check', 12) + '</span><strong>Todas</strong></label>' +
      '<div class="sc-multi-sep"></div>' +
      camps.map((c) =>
        '<label class="sc-multi-item"><input type="checkbox" class="sc-camp-cb" value="' + c.id + '" ' + (sel.includes(c.id) ? 'checked' : '') + '>' +
          '<span class="sc-check-box">' + ui.icon('check', 12) + '</span>' +
          ui.campAvatar(c, 'sm') +
          '<span class="sc-multi-name">' + ui.escapeHtml(c.candidate) + '</span></label>'
      ).join('');
    return '<div class="sc-multi" id="sc-camp-menu">' +
      '<button type="button" class="sc-multi-btn" id="sc-camp-btn">' + ui.icon('campaigns', 14) +
        '<span id="sc-camp-label">' + label + '</span>' + ui.icon('chevronRight', 14) + '</button>' +
      '<div class="sc-multi-panel" id="sc-camp-panel" hidden>' + items + '</div>' +
    '</div>';
  }

  App.views.superCronograma = function () {
    const html = '' +
      '<div class="toolbar">' +
        '<div class="board-lead"><h2 class="board-title">' + ui.icon('calendar', 18) + ' Super Cronograma</h2></div>' +
        '<button class="btn btn-primary" id="sc-new-task" style="margin-left:auto">' + ui.icon('plus', 16) + 'Nova tarefa</button>' +
      '</div>' +
      '<div class="toolbar toolbar-sub sc-controls">' +
        '<div class="seg" id="sc-group">' +
          '<button class="seg-btn ' + (f.groupBy === 'campaign' ? 'active' : '') + '" data-g="campaign">Por campanha</button>' +
          '<button class="seg-btn ' + (f.groupBy === 'assignee' ? 'active' : '') + '" data-g="assignee">Por responsável</button>' +
        '</div>' +
        sel('sc-owner', [['', 'Todos os responsáveis']].concat(S.users().map((u) => [u.id, u.name])), f.owner) +
        campMenu() +
        sel('sc-priority', [['', 'Todas as prioridades']].concat(S.priorities().map((p) => [p.id, p.name])), f.priority) +
        '<label class="sc-check"><input type="checkbox" id="sc-hidedone" ' + (f.hideDone ? 'checked' : '') + '>' +
          '<span class="sc-check-box">' + ui.icon('check', 12) + '</span> Ocultar concluídas</label>' +
        '<label class="sc-check"><input type="checkbox" id="sc-rotina" ' + (f.showRotina ? 'checked' : '') + '>' +
          '<span class="sc-check-box">' + ui.icon('check', 12) + '</span> Mostrar rotina</label>' +
        '<div class="seg" id="sc-scale" style="margin-left:auto">' +
          '<button class="seg-btn ' + (f.scale === 'day' ? 'active' : '') + '" data-s="day">Dias</button>' +
          '<button class="seg-btn ' + (f.scale === 'week' ? 'active' : '') + '" data-s="week">Semanas</button>' +
        '</div>' +
        '<div class="seg" id="sc-zoom">' +
          '<button class="seg-btn ' + (f.zoom === 'compact' ? 'active' : '') + '" data-z="compact" title="Compacto">' + ui.icon('zoomOut', 15) + '</button>' +
          '<button class="seg-btn ' + (f.zoom === 'cozy' ? 'active' : '') + '" data-z="cozy" title="Confortável">' + ui.icon('zoomIn', 15) + '</button>' +
        '</div>' +
        '<button class="btn btn-ghost" id="sc-today">' + ui.icon('target', 15) + ' Hoje</button>' +
      '</div>' +
      '<div id="sc-body"></div>';

    return { title: 'Super Cronograma', subtitle: '', html: html, mount: mount };

    function sel(id, opts, val) {
      return '<div class="sel-wrap">' + ui.icon('filter', 14) + '<select id="' + id + '">' +
        opts.map((o) => '<option value="' + o[0] + '" ' + (o[0] === val ? 'selected' : '') + '>' + o[1] + '</option>').join('') +
        '</select></div>';
    }
  };

  /* ---------- datas ---------- */
  function toUTC(iso) { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); }
  function dayDiff(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }

  function filtered() {
    let list = S.tasks().slice();
    if (f.owner) list = list.filter((t) => t.assigneeId === f.owner);
    if (f.campaigns !== null) {
      const sel = f.campaigns;
      list = list.filter((t) => sel.includes(t.campaignId));
    }
    if (f.priority) list = list.filter((t) => t.priority === f.priority);
    if (f.hideDone) list = list.filter((t) => t.status !== 'done');
    if (!f.showRotina) list = list.filter((t) => !t.rotina);
    return list;
  }

  function render() {
    const host = document.getElementById('sc-body');
    const list = filtered();
    if (!list.length) {
      host.innerHTML = '<div class="empty-state">' + ui.icon('calendar', 32) +
        '<h3>Nenhuma atividade encontrada</h3><p>Ajuste os filtros acima.</p></div>';
      return;
    }

    const isWeek = f.scale === 'week';
    const dayW = isWeek ? (f.zoom === 'compact' ? 9 : 13) : (f.zoom === 'compact' ? 26 : 46);

    // período total
    let minStart = App.TODAY, maxEnd = App.TODAY;
    const spans = {};
    list.forEach((t) => {
      const sp = S.taskSpan(t); spans[t.id] = sp;
      if (sp.start < minStart) minStart = sp.start;
      if (sp.end > maxEnd) maxEnd = sp.end;
    });
    let rangeStart = App.addDays(minStart, -2);
    let rangeEnd = App.addDays(maxEnd, 4);
    if (isWeek) {                                   // alinha às semanas (segunda a domingo)
      rangeStart = App.addDays(rangeStart, -((new Date(toUTC(rangeStart)).getUTCDay() + 6) % 7));
      rangeEnd = App.addDays(rangeEnd, 6 - ((new Date(toUTC(rangeEnd)).getUTCDay() + 6) % 7));
    }
    const totalDays = dayDiff(rangeStart, rangeEnd) + 1;
    const canvasW = LABEL_W + totalDays * dayW;
    const todayIdx = dayDiff(rangeStart, App.TODAY);

    // ----- cabeçalho: faixa de meses + faixa de dias -----
    const months = [];
    for (let i = 0; i < totalDays; i++) {
      const iso = App.addDays(rangeStart, i);
      const key = iso.slice(0, 7);
      const last = months[months.length - 1];
      if (last && last.key === key) last.count++;
      else months.push({ key: key, count: 1, startIdx: i, label: monthLabel(iso) });
    }
    const monthCells = months.map((mo) =>
      '<div class="tl2-month" style="left:' + (mo.startIdx * dayW) + 'px;width:' + (mo.count * dayW) + 'px">' + mo.label + '</div>'
    ).join('');
    let dayCells = '';
    if (isWeek) {
      // uma célula por semana (rótulo = data de início da semana)
      for (let i = 0; i < totalDays; i += 7) {
        const iso = App.addDays(rangeStart, i);
        const span = Math.min(7, totalDays - i);
        const isTodayWk = todayIdx >= i && todayIdx < i + span;
        dayCells += '<div class="tl2-weekcell' + (isTodayWk ? ' today' : '') +
          '" style="left:' + (i * dayW) + 'px;width:' + (span * dayW) + 'px">' +
          '<span class="tl2-dnum">' + Number(iso.slice(8, 10)) + ' ' + ui.MONTHS[Number(iso.slice(5, 7)) - 1] + '</span>' +
          '</div>';
      }
    } else {
      for (let i = 0; i < totalDays; i++) {
        const iso = App.addDays(rangeStart, i);
        const wd = new Date(toUTC(iso)).getUTCDay();
        const weekend = (wd === 0 || wd === 6);
        const isToday = iso === App.TODAY;
        dayCells += '<div class="tl2-daycell' + (weekend ? ' weekend' : '') + (isToday ? ' today' : '') +
          '" style="left:' + (i * dayW) + 'px;width:' + dayW + 'px">' +
          '<span class="tl2-dnum">' + Number(iso.slice(8, 10)) + '</span>' +
          (f.zoom === 'cozy' ? '<span class="tl2-dow">' + DOW[wd] + '</span>' : '') +
          '</div>';
      }
    }

    // ----- grupos -----
    const groups = buildGroups(list);
    const rowsHtml = groups.map((g) => {
      const packed = packLanes(g.tasks.map((t) => {
        const sp = spans[t.id];
        const left = dayDiff(rangeStart, sp.start) * dayW + 2;
        const rawW = (dayDiff(sp.start, sp.end) + 1) * dayW - 4;
        const width = Math.max(rawW, 66);
        return { task: t, left: left, width: width, right: left + width };
      }));
      const laneCount = Math.max(1, packed.lanes);
      const rowH = ROW_PAD * 2 + laneCount * BAR_H + (laneCount - 1) * LANE_GAP;

      const bars = packed.items.map((it) => {
        const t = it.task, c = S.campaign(t.campaignId);
        const top = ROW_PAD + it.lane * (BAR_H + LANE_GAP);
        const isDone = t.status === 'done';
        const over = S.isOverdue(t);
        return '<div class="tl2-bar' + (isDone ? ' done' : '') + (over ? ' over' : '') + (t.rotina ? ' rotina' : '') + '" ' +
          'style="left:' + it.left + 'px;width:' + it.width + 'px;top:' + top + 'px;height:' + BAR_H + 'px;--cc:' + c.color + '" ' +
          'data-task="' + t.id + '" title="' + (t.rotina ? '[Rotina] ' : '') + ui.escapeHtml(t.title) + ' — ' + ui.escapeHtml(c.candidate) + ' · ' +
          S.stage(t.stageId).name + ' · ' + ui.fmtDate(spans[t.id].start) + ' → ' + ui.fmtDate(t.dueDate) + '">' +
          (t.rotina ? '<span class="tl2-bar-rotina">' + ui.icon('repeat', 11) + '</span>' : '<span class="tl2-bar-dot" style="background:' + S.status(t.status).color + '"></span>') +
          '<span class="tl2-bar-title">' + ui.escapeHtml(t.title) + '</span>' +
          '<span class="tl2-bar-av">' + ui.avatar(t.assigneeId, 18) + '</span>' +
        '</div>';
      }).join('');

      const gridBg = 'background-size:' + (isWeek ? dayW * 7 : dayW) + 'px 100%';
      return '<div class="tl2-row" style="height:' + rowH + 'px;width:' + canvasW + 'px">' +
        '<div class="tl2-rowlabel" style="width:' + LABEL_W + 'px">' + g.label + '</div>' +
        '<div class="tl2-lanes" style="left:' + LABEL_W + 'px;width:' + (totalDays * dayW) + 'px;' + gridBg + '">' + bars + '</div>' +
      '</div>';
    }).join('');

    host.innerHTML =
      '<div class="tl2-scroll" id="tl2-scroll">' +
        '<div class="tl2-canvas" style="width:' + canvasW + 'px">' +
          '<div class="tl2-header" style="height:' + HEADER_H + 'px;width:' + canvasW + 'px">' +
            '<div class="tl2-corner" style="width:' + LABEL_W + 'px">' +
              '<span class="tl2-corner-t">' + (f.groupBy === 'campaign' ? 'Campanha' : 'Responsável') + '</span>' +
              '<span class="tl2-corner-s">' + list.length + ' atividades</span></div>' +
            '<div class="tl2-axis" style="left:' + LABEL_W + 'px;width:' + (totalDays * dayW) + 'px">' +
              '<div class="tl2-months">' + monthCells + '</div>' +
              '<div class="tl2-days">' + dayCells + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="tl2-today-line" style="left:' + (LABEL_W + todayIdx * dayW + dayW / 2) + 'px;top:' + HEADER_H + 'px"></div>' +
          '<div class="tl2-body">' + rowsHtml + '</div>' +
        '</div>' +
      '</div>';

    host.querySelectorAll('.tl2-bar[data-task]').forEach((b) =>
      b.addEventListener('click', () => C.openTaskDrawer(b.getAttribute('data-task'))));

    // olho: oculta uma campanha individualmente (sincroniza com o checklist)
    host.querySelectorAll('[data-hide-camp]').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        hideCampaign(btn.getAttribute('data-hide-camp'));
      }));

    // rola até hoje (deixa hoje ~1/3 a partir da esquerda)
    const scroller = host.querySelector('#tl2-scroll');
    scroller._todayLeft = LABEL_W + todayIdx * dayW - Math.round(scroller.clientWidth / 3);
    scroller.scrollLeft = Math.max(0, scroller._todayLeft);
  }

  /* ---------- grupos ---------- */
  function buildGroups(list) {
    if (f.groupBy === 'assignee') {
      return S.users().map((u) => ({
        key: u.id,
        tasks: list.filter((t) => t.assigneeId === u.id),
        label: '<div class="tl2-glabel">' + ui.avatar(u.id, 30) +
          '<div class="tl2-gmeta"><strong>' + u.name + '</strong><span>' + u.role + '</span></div></div>'
      })).filter((g) => g.tasks.length);
    }
    return S.campaigns().map((c) => ({
      key: c.id,
      tasks: list.filter((t) => t.campaignId === c.id),
      label: '<div class="tl2-glabel-wrap">' +
        '<a class="tl2-glabel" href="#/campanha/' + c.id + '">' +
          ui.campAvatar(c, 'sm') +
          '<div class="tl2-gmeta"><strong>' + ui.escapeHtml(c.candidate) + '</strong><span>' + c.office + '</span></div></a>' +
        '<button type="button" class="tl2-eye" data-hide-camp="' + c.id + '" title="Ocultar esta campanha">' + ui.icon('eye', 16) + '</button>' +
      '</div>'
    })).filter((g) => g.tasks.length);
  }

  /* ---------- lane packing (por pixels, evita sobreposição) ---------- */
  function packLanes(items) {
    items.sort((a, b) => a.left - b.left);
    const laneRight = [];
    items.forEach((it) => {
      let placed = -1;
      for (let i = 0; i < laneRight.length; i++) {
        if (it.left >= laneRight[i] + 6) { placed = i; break; }
      }
      if (placed === -1) { placed = laneRight.length; laneRight.push(0); }
      laneRight[placed] = it.right;
      it.lane = placed;
    });
    return { items: items, lanes: laneRight.length };
  }

  function monthLabel(iso) {
    const m = Number(iso.slice(5, 7)), y = iso.slice(0, 4);
    return ui.MONTHS_FULL[m - 1] + ' ' + y;
  }

  /* ---------- checklist de campanhas + olho ---------- */
  function setCampaigns(arr) {
    f.campaigns = (arr.length >= S.campaigns().length) ? null : arr.slice();
  }
  function hideCampaign(cid) {
    setCampaigns(selectedCampaigns().filter((id) => id !== cid));
    syncCampMenu();
    render();
  }
  function syncCampMenu() {
    const panel = document.getElementById('sc-camp-panel');
    if (!panel) return;
    const sel = selectedCampaigns();
    const total = S.campaigns().length;
    panel.querySelectorAll('.sc-camp-cb').forEach((cb) => { cb.checked = sel.includes(cb.value); });
    const all = document.getElementById('sc-camp-all');
    if (all) all.checked = sel.length >= total;
    const label = document.getElementById('sc-camp-label');
    if (label) label.textContent = (sel.length >= total) ? 'Todas as campanhas' : (sel.length + ' de ' + total + ' campanhas');
  }
  function wireCampMenu(root) {
    const btn = root.querySelector('#sc-camp-btn');
    const panel = root.querySelector('#sc-camp-panel');
    const menu = root.querySelector('#sc-camp-menu');
    if (!btn || !panel) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      menu.classList.toggle('open', !panel.hidden);
    });
    document.addEventListener('click', (e) => {
      if (menu && !menu.contains(e.target)) { panel.hidden = true; menu.classList.remove('open'); }
    });
    const allCb = root.querySelector('#sc-camp-all');
    allCb.addEventListener('change', () => {
      setCampaigns(allCb.checked ? S.campaigns().map((c) => c.id) : []);
      syncCampMenu();
      render();
    });
    panel.querySelectorAll('.sc-camp-cb').forEach((cb) => {
      cb.addEventListener('change', () => {
        const checked = [].slice.call(panel.querySelectorAll('.sc-camp-cb:checked')).map((x) => x.value);
        setCampaigns(checked);
        syncCampMenu();
        render();
      });
    });
  }

  /* ---------- mount ---------- */
  function mount(root) {
    render();
    root.querySelector('#sc-new-task').addEventListener('click', () => C.openTaskForm({
      preset: {
        campaignId: (f.campaigns && f.campaigns.length === 1) ? f.campaigns[0] : undefined,
        assigneeId: f.owner || undefined, priority: f.priority || undefined
      },
      onSaved: () => render()
    }));
    ['owner', 'priority'].forEach((key) => {
      root.querySelector('#sc-' + key).addEventListener('change', (e) => { f[key] = e.target.value; render(); });
    });
    wireCampMenu(root);
    root.querySelector('#sc-hidedone').addEventListener('change', (e) => { f.hideDone = e.target.checked; render(); });
    root.querySelector('#sc-rotina').addEventListener('change', (e) => { f.showRotina = e.target.checked; render(); });
    root.querySelectorAll('#sc-group .seg-btn').forEach((b) => b.addEventListener('click', () => {
      f.groupBy = b.getAttribute('data-g');
      root.querySelectorAll('#sc-group .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      render();
    }));
    root.querySelectorAll('#sc-zoom .seg-btn').forEach((b) => b.addEventListener('click', () => {
      f.zoom = b.getAttribute('data-z');
      root.querySelectorAll('#sc-zoom .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      render();
    }));
    root.querySelectorAll('#sc-scale .seg-btn').forEach((b) => b.addEventListener('click', () => {
      f.scale = b.getAttribute('data-s');
      root.querySelectorAll('#sc-scale .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      render();
    }));
    root.querySelector('#sc-today').addEventListener('click', () => {
      const sc = root.querySelector('#tl2-scroll');
      if (sc) sc.scrollTo({ left: Math.max(0, sc._todayLeft || 0), behavior: 'smooth' });
    });
  }
})(window.App = window.App || {});
