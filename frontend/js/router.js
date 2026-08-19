/* =============================================================
   ROUTER — hash routing (funciona via file://)
   ============================================================= */
(function (App) {
  'use strict';

  // Definição das rotas → resolve a view + parâmetros
  const routes = [
    { re: /^\/?$/,                       view: 'campaigns', nav: 'campaigns' },
    { re: /^\/campaigns$/,               view: 'campaigns', nav: 'campaigns' },
    { re: /^\/campanhas$/,               view: 'campaigns', nav: 'campaigns' },
    { re: /^\/campanha\/([^/]+)(?:\/([^/]+))?$/, view: 'campaign', nav: 'campaigns',
      params: (mch) => ({ id: mch[1], tab: mch[2] }) },
    { re: /^\/kanban$/,                  view: 'kanban', nav: 'kanban' },
    { re: /^\/super-cronograma$/,        view: 'superCronograma', nav: 'super' },
    { re: /^\/equipe(?:\/([^/]+))?$/,    view: 'team', nav: 'team',
      params: (mch) => ({ id: mch[1] }) },
    { re: /^\/configuracoes$/,           view: 'settings', nav: 'settings' }
  ];

  function resolve(hash) {
    const path = (hash || '').replace(/^#/, '') || '/';
    for (const r of routes) {
      const mch = path.match(r.re);
      if (mch) return { view: r.view, nav: r.nav, params: r.params ? r.params(mch) : {} };
    }
    return null;
  }

  App.router = { resolve: resolve, routes: routes };
})(window.App = window.App || {});
