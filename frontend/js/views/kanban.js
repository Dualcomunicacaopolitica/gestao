/* =============================================================
   VIEW: KANBAN + Board reutilizável (drag & drop)
   -------------------------------------------------------------
   - buildBoard(): monta as 5 colunas e habilita drag & drop.
     Usado tanto pelo Kanban geral ("Operação da Agência")
     quanto pela aba Kanban dentro de uma campanha.
   ============================================================= */
(function (App) {
  'use strict';
  const S = App.select, ui = App.ui, C = App.components;

  /* ---------- Board reutilizável ---------- */
  const ROTINA = '__rotina__';

  function buildBoard(container, getTasks, opts) {
    opts = opts || {};
    const addBtn = (key) => opts.onAdd
      ? '<button class="kb-add" data-add="' + key + '" title="Adicionar tarefa aqui" aria-label="Adicionar tarefa">' + ui.icon('plus', 14) + '</button>' : '';
    const head = (titleHtml, key, countKey) =>
      '<div class="kb-col-head"><span class="kb-col-title">' + titleHtml + '</span>' +
        '<div class="kb-head-right"><span class="kb-count" data-count="' + countKey + '">0</span>' + addBtn(key) + '</div></div>';
    const rotinaCol = '<div class="kb-col kb-col-rotina" data-status="' + ROTINA + '">' +
      head('<span class="kb-dot" style="background:#8b5cf6"></span>' + ui.icon('repeat', 14) + ' Rotina', ROTINA, ROTINA) +
      '<div class="kb-list" data-drop="' + ROTINA + '"></div></div>';
    const cols = S.statuses().map((st) =>
      '<div class="kb-col" data-status="' + st.id + '">' +
        head('<span class="kb-dot" style="background:' + st.color + '"></span>' + st.name, st.id, st.id) +
        '<div class="kb-list" data-drop="' + st.id + '"></div></div>'
    ).join('');
    container.innerHTML = '<div class="kb-board">' + rotinaCol + cols + '</div>';
    paint(container, getTasks, opts);
    wireDnD(container, getTasks, opts);
    if (opts.onAdd) container.querySelectorAll('.kb-add[data-add]').forEach((b) =>
      b.addEventListener('click', (e) => { e.stopPropagation(); opts.onAdd(b.getAttribute('data-add')); }));
  }

  function paint(container, getTasks, opts) {
    const tasks = getTasks();
    // Coluna Rotina (todas as tarefas marcadas como rotina)
    const rlist = container.querySelector('[data-drop="' + ROTINA + '"]');
    if (rlist) {
      const ritems = tasks.filter((t) => t.rotina);
      rlist.innerHTML = ritems.map((t) => C.taskCard(t, opts)).join('') || '<div class="kb-empty">Sem tarefas de rotina</div>';
      container.querySelector('[data-count="' + ROTINA + '"]').textContent = ritems.length;
    }
    // Colunas de status (excluem as de rotina)
    S.statuses().forEach((st) => {
      const list = container.querySelector('[data-drop="' + st.id + '"]');
      const items = tasks.filter((t) => !t.rotina && t.status === st.id);
      list.innerHTML = items.map((t) => C.taskCard(t, opts)).join('') ||
        '<div class="kb-empty">Sem atividades</div>';
      container.querySelector('[data-count="' + st.id + '"]').textContent = items.length;
    });
    // clique abre drawer
    container.querySelectorAll('.task-card[data-task]').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.task-del')) return;      // clique no lixo não abre o drawer
        if (card.classList.contains('dragging')) return;
        C.openTaskDrawer(card.getAttribute('data-task'));
      });
    });
    // excluir tarefa (lixeira no card)
    container.querySelectorAll('.task-del[data-del]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-del');
        const t = S.task(id);
        if (!confirm('Excluir a tarefa “' + (t ? t.title : '') + '”? Esta ação não pode ser desfeita.')) return;
        btn.disabled = true;
        try { await App.mutations.deleteTask(id); }
        catch (err) { btn.disabled = false; ui.toast('Erro ao excluir: ' + (err.message || ''), 'error'); return; }
        paint(container, getTasks, opts);
        refreshCounts(container, getTasks);
        if (opts.onChange) opts.onChange();
        ui.toast('Tarefa excluída', 'success');
      });
    });
  }

  function wireDnD(container, getTasks, opts) {
    let dragEl = null;
    container.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.task-card');
      if (!card) return;
      dragEl = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.getAttribute('data-task'));
    });
    container.addEventListener('dragend', () => {
      if (dragEl) dragEl.classList.remove('dragging');
      dragEl = null;
      container.querySelectorAll('.kb-list').forEach((l) => l.classList.remove('drag-over'));
    });
    container.querySelectorAll('.kb-list').forEach((list) => {
      list.addEventListener('dragover', (e) => {
        e.preventDefault();
        list.classList.add('drag-over');
        const after = afterElement(list, e.clientY);
        if (dragEl) {
          const empty = list.querySelector('.kb-empty');
          if (empty) empty.remove();
          if (after == null) list.appendChild(dragEl);
          else list.insertBefore(dragEl, after);
        }
      });
      list.addEventListener('dragleave', (e) => {
        if (!list.contains(e.relatedTarget)) list.classList.remove('drag-over');
      });
      list.addEventListener('drop', (e) => {
        e.preventDefault();
        list.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain');
        const target = list.getAttribute('data-drop');
        const t = S.task(taskId);
        if (!t) return;

        // Solto na coluna Rotina
        if (target === ROTINA) {
          if (!t.rotina) {
            App.mutations.updateTask(taskId, { rotina: true })
              .then(() => { ui.toast('“' + t.title + '” → Rotina', 'success'); paint(container, getTasks, opts); if (opts.onChange) opts.onChange(); })
              .catch(() => { ui.toast('Erro ao mover para Rotina', 'error'); paint(container, getTasks, opts); });
          }
          return;   // já era rotina → mantém posição
        }

        // Solto numa coluna de status: se era rotina, sai da rotina
        if (t.rotina) {
          App.mutations.updateTask(taskId, { status: target, rotina: false })
            .then(() => { ui.toast('“' + t.title + '” → ' + S.status(target).name, 'success'); paint(container, getTasks, opts); if (opts.onChange) opts.onChange(); })
            .catch(() => { ui.toast('Erro ao mover atividade', 'error'); paint(container, getTasks, opts); });
          return;
        }

        // Fluxo normal (muda status)
        if (t.status !== target) {
          const title = t.title;
          App.mutations.moveTask(taskId, target)
            .then(() => {
              ui.toast('“' + title + '” → ' + S.status(target).name, 'success');
              refreshCounts(container, getTasks);
              if (opts.onChange) opts.onChange();
            })
            .catch(() => { ui.toast('Erro ao mover atividade', 'error'); paint(container, getTasks, opts); });
        }
        refreshCounts(container, getTasks);
        const card = container.querySelector('.task-card[data-task="' + taskId + '"]');
        if (card) card.setAttribute('data-status', target);
      });
    });
  }

  function refreshCounts(container, getTasks) {
    const tasks = getTasks();
    const rc = container.querySelector('[data-count="' + ROTINA + '"]');
    if (rc) rc.textContent = tasks.filter((t) => t.rotina).length;
    S.statuses().forEach((st) => {
      const cnt = tasks.filter((t) => !t.rotina && t.status === st.id).length;
      const el = container.querySelector('[data-count="' + st.id + '"]');
      if (el) el.textContent = cnt;
      const list = container.querySelector('[data-drop="' + st.id + '"]');
      if (list && !list.querySelector('.task-card') && !list.querySelector('.kb-empty')) {
        list.innerHTML = '<div class="kb-empty">Sem atividades</div>';
      }
    });
  }

  function afterElement(list, y) {
    const cards = [].slice.call(list.querySelectorAll('.task-card:not(.dragging)'));
    let closest = { offset: -Infinity, el: null };
    cards.forEach((c) => {
      const box = c.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) closest = { offset: offset, el: c };
    });
    return closest.el;
  }

  /* ---------- VIEW: Kanban geral (Operação da Agência) ---------- */
  const f = App.state.filters.kanban = App.state.filters.kanban || { campaign: '', owner: '', priority: '', label: '' };

  App.views.kanban = function () {
    const html = '' +
      '<div class="toolbar">' +
        '<div class="board-lead"><h2 class="board-title">' + ui.icon('grid', 18) + ' Operação da Agência</h2></div>' +
        '<button class="btn btn-primary" id="new-task" style="margin-left:auto">' + ui.icon('plus', 16) + 'Nova tarefa</button>' +
      '</div>' +
      '<div class="toolbar toolbar-sub">' +
        sel('k-campaign', [['', 'Todas as campanhas']].concat(S.campaigns().map((c) => [c.id, c.candidate])), f.campaign) +
        sel('k-owner', [['', 'Todos os responsáveis']].concat(S.users().map((u) => [u.id, u.name])), f.owner) +
        sel('k-priority', [['', 'Todas as prioridades']].concat(S.priorities().map((p) => [p.id, p.name])), f.priority) +
        sel('k-label', [['', 'Todas as etiquetas']].concat(S.labels().map((l) => [l.id, l.name])), f.label) +
        '<button class="btn btn-ghost" id="k-clear">Limpar filtros</button>' +
      '</div>' +
      '<div id="kb-host"></div>';

    return { title: 'Kanban', subtitle: '', html: html, mount: mount };

    function sel(id, opts, val) {
      return '<div class="sel-wrap">' + ui.icon('filter', 14) + '<select id="' + id + '">' +
        opts.map((o) => '<option value="' + o[0] + '" ' + (o[0] === val ? 'selected' : '') + '>' + o[1] + '</option>').join('') +
        '</select></div>';
    }
  };

  function filtered() {
    let list = S.tasks().slice();
    if (f.campaign) list = list.filter((t) => t.campaignId === f.campaign);
    if (f.owner) list = list.filter((t) => t.assigneeId === f.owner);
    if (f.priority) list = list.filter((t) => t.priority === f.priority);
    if (f.label) list = list.filter((t) => (t.labels || []).includes(f.label));
    return list;
  }

  function mount(root) {
    const host = root.querySelector('#kb-host');
    const addInCol = (key) => {
      const preset = { campaignId: f.campaign || undefined, assigneeId: f.owner || undefined, priority: f.priority || undefined };
      if (key === ROTINA) preset.rotina = true; else preset.status = key;
      C.openTaskForm({ preset: preset, onSaved: () => rebuild() });
    };
    const rebuild = () => buildBoard(host, filtered, { showCampaign: true, onAdd: addInCol });
    rebuild();
    root.querySelector('#new-task').addEventListener('click', () => C.openTaskForm({
      preset: { campaignId: f.campaign || undefined, assigneeId: f.owner || undefined, priority: f.priority || undefined },
      onSaved: () => rebuild()
    }));
    ['campaign', 'owner', 'priority', 'label'].forEach((key) => {
      root.querySelector('#k-' + key).addEventListener('change', (e) => { f[key] = e.target.value; rebuild(); });
    });
    root.querySelector('#k-clear').addEventListener('click', () => {
      f.campaign = f.owner = f.priority = f.label = '';
      root.querySelector('#k-campaign').value = '';
      root.querySelector('#k-owner').value = '';
      root.querySelector('#k-priority').value = '';
      root.querySelector('#k-label').value = '';
      rebuild();
    });
  }

  App.kanban = { buildBoard: buildBoard, ROTINA: ROTINA };
})(window.App = window.App || {});
