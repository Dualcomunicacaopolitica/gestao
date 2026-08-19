/* =============================================================
   VIEW: CONFIGURAÇÕES — placeholder visual (protótipo)
   ============================================================= */
(function (App) {
  'use strict';
  const ui = App.ui;

  App.views.settings = function () {
    const html = '' +
      '<div class="settings-grid">' +
        card('Preferências', 'settings', [
          toggle('Notificações de atividades atrasadas', true),
          toggle('Resumo diário por e-mail', true),
          toggle('Modo compacto do Kanban', false)
        ]) +
      '</div>';

    return { title: 'Configurações', subtitle: '', html: html, mount: function (root) {
      root.querySelectorAll('.toggle input').forEach((t) => t.addEventListener('change', () =>
        ui.toast('Preferência atualizada (não persistida)', 'info')));
    } };

    function card(title, icon, items) {
      return '<section class="panel"><div class="panel-head"><h3>' + ui.icon(icon, 16) + ' ' + title + '</h3></div>' +
        '<div class="cfg-body">' + items.join('') + '</div></section>';
    }
    function field(l, v) { return '<label class="field"><span>' + l + '</span><input value="' + ui.escapeHtml(v) + '" readonly></label>'; }
    function toggle(l, on) {
      return '<label class="toggle"><span>' + l + '</span><input type="checkbox" ' + (on ? 'checked' : '') + '><span class="switch"></span></label>';
    }
  };
})(window.App = window.App || {});
