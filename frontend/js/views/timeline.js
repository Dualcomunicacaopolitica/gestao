/* =============================================================
   VIEW: CRONOGRAMA — timeline visual de todas as campanhas
   Uma faixa por campanha, marcando as 7 etapas e as entregas.
   ============================================================= */
(function (App) {
  'use strict';
  const S = App.select, ui = App.ui, C = App.components;

  App.views.timeline = function () {
    const stages = S.stages();

    // cabeçalho de etapas
    const stageHead = '<div class="cg-row cg-head"><div class="cg-label">Campanha</div>' +
      '<div class="cg-track">' + stages.map((s) =>
        '<div class="cg-cell cg-stage-head">' + s.name + '</div>').join('') + '</div></div>';

    const rows = S.campaigns().map((c) => {
      const curOrder = S.stage(c.stage).order;
      const cells = stages.map((s) => {
        const tasks = S.tasksByStage(c.id, s.id);
        const state = s.order < curOrder ? 'done' : (s.order === curOrder ? 'current' : 'future');
        const dots = tasks.slice(0, 4).map((t) =>
          '<span class="cg-dot" style="background:' + S.status(t.status).color + '" title="' +
          ui.escapeHtml(t.title) + ' · ' + ui.fmtDate(t.dueDate) + '"></span>').join('');
        return '<div class="cg-cell ' + state + '" data-camp="' + c.id + '">' +
          (state === 'current' ? '<span class="cg-here">' + ui.icon('flag', 12) + '</span>' : '') +
          '<div class="cg-dots">' + dots + '</div>' +
          (tasks.length > 4 ? '<span class="cg-more">+' + (tasks.length - 4) + '</span>' : '') + '</div>';
      }).join('');
      return '<div class="cg-row">' +
        '<a class="cg-label cg-camp" href="#/campanha/' + c.id + '">' +
          '<span class="camp-avatar sm" style="background:' + c.color + '">' + ui.initials(c.candidate) + '</span>' +
          '<div><strong>' + ui.escapeHtml(c.candidate) + '</strong><span>' + c.office + '</span></div>' +
          ui.riskDot(S.riskOf(c.id)) + '</a>' +
        '<div class="cg-track">' + cells + '</div></div>';
    }).join('');

    // faixa de prazos (marcos por data)
    const milestones = S.campaigns().slice()
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .map((c) => '<div class="ms-row"><span class="ms-date">' + ui.fmtDate(c.deadline, true) + '</span>' +
        '<span class="ms-line" style="--c:' + c.color + '"></span>' +
        '<a class="ms-name" href="#/campanha/' + c.id + '">' + ui.escapeHtml(c.candidate) + ' <span>' + c.office + '</span></a>' +
        '<span class="ms-days">' + daysLabel(c.deadline) + '</span></div>').join('');

    const legend = '<div class="cg-legend">' +
      leg('#22c55e', 'Concluído') + leg('#0ea5e9', 'Em andamento') + leg('#6366f1', 'A fazer') +
      leg('#f59e0b', 'Em revisão') + leg('#94a3b8', 'Backlog') + '</div>';

    const html = '' +
      '<section class="panel cg-panel"><div class="panel-head"><h3>Linha do tempo das campanhas</h3>' + legend + '</div>' +
        '<div class="cg-scroll">' + stageHead + rows + '</div></section>' +
      '<section class="panel"><div class="panel-head"><h3>' + ui.icon('calendar', 16) + ' Prazos e entregas</h3>' +
        '<span class="muted">Hoje: ' + ui.fmtDate(App.TODAY, true) + '</span></div>' +
        '<div class="ms-list">' + milestones + '</div></section>';

    return { title: 'Cronograma', subtitle: 'Etapas, prazos e entregas de todas as campanhas', html: html, mount: function () {} };

    function leg(c, l) { return '<span class="lg"><span class="lg-dot" style="background:' + c + '"></span>' + l + '</span>'; }
    function daysLabel(iso) {
      const d = ui.daysUntil(iso);
      if (d < 0) return '<span class="danger-text">' + (-d) + 'd atrás</span>';
      if (d === 0) return '<span class="warn-text">hoje</span>';
      return 'em ' + d + 'd';
    }
  };
})(window.App = window.App || {});
