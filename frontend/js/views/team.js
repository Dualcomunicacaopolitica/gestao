/* =============================================================
   VIEW: EQUIPE — lista de profissionais + detalhe do usuário
   Rotas: #/equipe   e   #/equipe/:id
   ============================================================= */
(function (App) {
  'use strict';
  const S = App.select, ui = App.ui, C = App.components;

  App.views.team = function (params) {
    if (params && params.id) return userDetail(params.id);
    return teamList();
  };

  function teamList() {
    const cards = S.users().map((u) => {
      const st = S.userStats(u.id);
      const load = Math.min(100, Math.round((st.total / 16) * 100));
      return '<a class="team-card card-hover" href="#/equipe/' + u.id + '">' +
        '<div class="team-card-top">' + ui.avatar(u.id, 64) +
          '<div class="team-id"><strong>' + u.name + '</strong><span>' + u.role + '</span></div>' +
          (st.overdue ? '<span class="status-dot danger" title="' + st.overdue + ' atrasadas"></span>' :
            '<span class="status-dot ok" title="Em dia"></span>') +
        '</div>' +
        '<div class="team-metrics">' +
          metric(st.total, 'tarefas') +
          metric(st.overdue, 'atrasadas', st.overdue ? 'danger' : '') +
          metric(st.campaigns, 'campanhas') +
        '</div>' +
        '<div class="team-load"><div class="team-load-head"><span>Carga de trabalho</span><strong>' + st.total + ' tarefas</strong></div>' +
          C.progressBar(load, load > 80 ? '#ef4444' : load > 55 ? '#f59e0b' : '#22c55e') + '</div>' +
      '</a>';
    }).join('');

    // resumo topo
    const totalTasks = S.tasks().length;
    const totalOverdue = S.overdueTasks().length;
    const summary = '<div class="stat-grid">' +
      miniSum('Profissionais', S.users().length, 'team', 'primary') +
      miniSum('Tarefas atribuídas', totalTasks, 'kanban', 'info') +
      miniSum('Atividades atrasadas', totalOverdue, 'alert', 'danger') +
      miniSum('Campanhas cobertas', S.campaigns().length, 'campaigns', 'warning') +
      '</div>';

    return {
      title: 'Equipe',
      subtitle: '',
      html: summary + '<div class="team-grid">' + cards + '</div>',
      mount: function () {}
    };

    function metric(v, l, tone) {
      return '<div class="tm ' + (tone || '') + '"><span class="tm-val">' + v + '</span><span class="tm-lbl">' + l + '</span></div>';
    }
    function miniSum(l, v, ic, tone) {
      return '<div class="stat-card tone-' + tone + '"><div class="stat-ico">' + ui.icon(ic, 20) + '</div>' +
        '<div class="stat-body"><span class="stat-value">' + v + '</span><span class="stat-label">' + l + '</span></div></div>';
    }
  }

  function userDetail(id) {
    const u = S.user(id);
    if (!u) return { title: 'Equipe', html: '<div class="empty-state">' + ui.icon('alert', 32) +
      '<h3>Pessoa não encontrada</h3><p><a class="link" href="#/equipe">Voltar</a></p></div>', mount: function () {} };
    const st = S.userStats(id);
    const camps = S.campaignsOfUser(id);
    const tasks = S.tasksByAssignee(id).slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const cur = App.currentUser || {};
    const canEditPhoto = cur.id === id || cur.perfil === 'admin' || cur.perfil === 'gestor';
    const header = '<a class="back-link" href="#/equipe">' + ui.icon('arrowLeft', 16) + 'Equipe</a>' +
      '<div class="camp-header">' +
        '<div class="camp-avatar-wrap' + (canEditPhoto ? '' : ' no-edit') + '" id="user-photo"' + (canEditPhoto ? ' title="Clique para alterar a foto"' : '') + '>' + ui.avatar(id, 96) +
        '</div>' +
        '<div class="camp-header-main"><div class="camp-header-title"><h1>' + u.name + '</h1></div>' +
          '<p>' + ui.icon('users', 14) + u.role + '</p></div>' +
        '<div class="camp-header-stats">' +
          hstat('Tarefas', st.total) + hstat('Atrasadas', st.overdue) +
          hstat('Em andamento', st.inProgress) + hstat('Campanhas', st.campaigns) +
        '</div></div>';

    const campCards = camps.map((c) => {
      const mine = S.tasksByCampaign(c.id).filter((t) => t.assigneeId === id).length;
      return '<a class="member-card card-hover" href="#/campanha/' + c.id + '">' +
        ui.campAvatar(c, 'sm') +
        '<div class="member-main"><strong>' + ui.escapeHtml(c.candidate) + '</strong><span>' + c.office + '</span></div>' +
        '<div class="member-nums"><span>' + mine + ' tarefas</span>' + ui.riskDot(S.riskOf(c.id), true) + '</div></a>';
    }).join('');

    const taskRows = tasks.map((t) => {
      const c = S.campaign(t.campaignId);
      return '<div class="task-row card-hover" data-task="' + t.id + '">' +
        '<span class="camp-pip" style="background:' + c.color + '"></span>' +
        '<div class="task-row-main"><strong>' + ui.escapeHtml(t.title) + '</strong><span>' + c.candidate + '</span></div>' +
        '<div class="task-row-meta">' + ui.statusBadge(t.status) + ui.priorityBadge(t.priority) +
          '<span class="due ' + (S.isOverdue(t) ? 'due-over' : '') + '">' + ui.fmtDate(t.dueDate) + '</span></div></div>';
    }).join('');

    const html = header +
      '<div class="two-col two-col-a">' +
        '<section class="panel"><div class="panel-head"><h3>Campanhas (' + camps.length + ')</h3></div>' +
          '<div class="member-grid">' + campCards + '</div></section>' +
        '<section class="panel"><div class="panel-head"><h3>Tarefas atribuídas (' + tasks.length + ')</h3></div>' +
          '<div class="task-list">' + (taskRows || '<p class="empty-mini">Sem tarefas.</p>') + '</div></section>' +
      '</div>';

    return { title: u.name, subtitle: u.role, html: html, mount: function (root) {
      root.querySelectorAll('.task-row[data-task]').forEach((r) =>
        r.addEventListener('click', () => C.openTaskDrawer(r.getAttribute('data-task'))));
      const wrap = root.querySelector('#user-photo');
      if (wrap && !wrap.classList.contains('no-edit')) {
        ui.attachPhotoMenu(wrap, {
          hasPhoto: () => !!(S.user(id) && S.user(id).photo),
          onPick: async (dataUrl) => {
            try { await App.mutations.setUserPhoto(id, dataUrl); }
            catch (e) { ui.toast('Erro ao salvar a foto', 'error'); return; }
            ui.toast('Foto atualizada', 'success');
            if (App.render) App.render();
          },
          onRemove: async () => {
            if (!confirm('Remover a foto deste perfil?')) return;
            try { await App.mutations.setUserPhoto(id, null); }
            catch (e) { ui.toast('Erro ao remover a foto', 'error'); return; }
            ui.toast('Foto removida', 'success');
            if (App.render) App.render();
          }
        });
      }
    } };

    function hstat(l, v) { return '<div class="hstat"><span>' + l + '</span><strong>' + v + '</strong></div>'; }
  }
})(window.App = window.App || {});
