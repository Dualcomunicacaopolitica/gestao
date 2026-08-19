/* =============================================================
   APP BOOTSTRAP — monta o shell e conecta o roteador às views
   ============================================================= */
(function (App) {
  'use strict';
  const ui = App.ui, C = App.components, S = App.select;

  let mountedNav = null;

  function renderShell(nav) {
    const rootEl = document.getElementById('app');
    // (Re)monta sidebar apenas quando muda a seção ativa
    rootEl.innerHTML =
      C.sidebar(nav) +
      '<div class="main-wrap">' +
        '<div id="topbar-slot"></div>' +
        '<main class="main" id="view-root"></main>' +
      '</div>';
    wireShell();
  }

  function render() {
    const match = App.router.resolve(location.hash);
    if (!match) { location.hash = '#/campaigns'; return; }

    const factory = App.views[match.view];
    if (!factory) { console.warn('View não encontrada:', match.view); return; }

    // shell (sidebar) — recria sempre para atualizar item ativo
    renderShell(match.nav);

    const result = factory(match.params || {});

    document.getElementById('topbar-slot').innerHTML = C.topbar(result.title, result.subtitle);
    const viewRoot = document.getElementById('view-root');
    viewRoot.innerHTML = '<div class="view fade-in">' + result.html + '</div>';
    const viewEl = viewRoot.querySelector('.view');
    if (result.mount) result.mount(viewEl);

    wireTopbar();
    document.title = result.title + ' · CampoGestão';
    viewRoot.scrollTop = 0;
    // fecha menu mobile
    document.getElementById('sidebar') && document.getElementById('sidebar').classList.remove('open');
    const scrim = document.getElementById('sidebar-scrim');
    if (scrim) scrim.classList.remove('show');
  }

  /* ---------- Interações do shell ---------- */
  function wireShell() {
    const toggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebar-scrim');
    if (scrim) scrim.addEventListener('click', () => {
      sidebar.classList.remove('open'); scrim.classList.remove('show');
    });
  }

  function wireTopbar() {
    const toggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebar-scrim');
    if (toggle) toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (scrim) scrim.classList.toggle('show', sidebar.classList.contains('open'));
    });

    // Notificações
    const notif = document.getElementById('notif-btn');
    if (notif) notif.addEventListener('click', openNotifications);

    // User chip
    const chip = document.getElementById('user-chip');
    if (chip) chip.addEventListener('click', openUserMenu);
  }

  function openNotifications() {
    const overdue = S.overdueTasks().sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
    const items = overdue.map((t) => {
      const c = S.campaign(t.campaignId);
      return '<div class="notif-item" data-task="' + t.id + '"><span class="notif-ic danger">' + ui.icon('alert', 15) + '</span>' +
        '<div><strong>' + ui.escapeHtml(t.title) + '</strong><span>' + c.candidate + ' · venceu ' + ui.fmtDate(t.dueDate) + '</span></div></div>';
    }).join('');
    const html = '<div class="modal-head"><h2>' + ui.icon('bell', 18) + ' Notificações</h2>' +
      '<button class="icon-btn" data-close>' + ui.icon('x', 20) + '</button></div>' +
      '<div class="modal-body notif-list">' +
        '<div class="notif-lead">' + overdue.length + ' atividades atrasadas exigem atenção</div>' + items + '</div>';
    const ov = ui.openModal(html, { size: 'modal-sm' });
    ov.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', ui.closeModal));
    ov.querySelectorAll('.notif-item[data-task]').forEach((r) => r.addEventListener('click', () => {
      ui.closeModal(); C.openTaskDrawer(r.getAttribute('data-task'));
    }));
  }

  function openUserMenu() {
    const u = App.currentUser || { id: '', name: 'Usuário', color: '#6366f1', role: '', perfil: '' };
    const perfil = { admin: 'Administrador', gestor: 'Gestor', membro: 'Membro' }[u.perfil] || (u.role || '');
    const html = '<div class="modal-head"><h2>' + ui.escapeHtml(u.name) + '</h2>' +
      '<button class="icon-btn" data-close>' + ui.icon('x', 20) + '</button></div>' +
      '<div class="modal-body user-menu">' +
        '<div class="um-head"><span class="avatar" style="background:' + u.color + ';width:52px;height:52px;font-size:18px">' + ui.initials(u.name) + '</span>' +
          '<div><strong>' + ui.escapeHtml(u.name) + '</strong><span>' + ui.escapeHtml(perfil) + '</span></div></div>' +
        '<a class="um-item" href="#/equipe/' + u.id + '" data-close>' + ui.icon('users', 16) + ' Meu perfil</a>' +
        '<a class="um-item" href="#/configuracoes" data-close>' + ui.icon('settings', 16) + ' Configurações</a>' +
        '<button class="um-item" id="um-logout">' + ui.icon('logout', 16) + ' Sair</button>' +
      '</div>';
    const ov = ui.openModal(html, { size: 'modal-sm' });
    ov.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', ui.closeModal));
    const out = ov.querySelector('#um-logout');
    if (out) out.addEventListener('click', () => { ui.closeModal(); App.logout(); });
  }

  /* ---------- Auth + Boot ---------- */
  App.currentUser = null;
  App.authed = false;

  async function afterAuth(usuario) {
    App.currentUser = App.store.mapUser(usuario);
    App.authed = true;
    document.getElementById('app').className = 'app-shell';
    try {
      await App.store.hydrate();
    } catch (e) {
      ui.toast('Erro ao carregar dados: ' + (e.message || ''), 'error');
    }
    if (!location.hash) location.hash = '#/campaigns';
    render();
  }
  App.afterAuth = afterAuth;

  App.logout = function () {
    // revoga o token no servidor (best-effort) antes de limpar no cliente
    try { App.api.logout().catch(function () {}); } catch (e) { /* noop */ }
    App.api.setToken(null);
    App.authed = false;
    App.currentUser = null;
    App.authView.showLogin('Você saiu com segurança.');
  };

  async function boot() {
    const t = App.api.token();
    if (t) {
      try { const me = await App.api.me(); await afterAuth(me); return; }
      catch (e) { App.api.setToken(null); }
    }
    try {
      const s = await App.api.setupStatus();
      if (s && s.precisa_bootstrap) { App.authView.showBootstrap(); return; }
    } catch (e) { /* API fora do ar → mostra login mesmo assim */ }
    App.authView.showLogin();
  }

  /* ---------- Sincronização automática (quase tempo real) ----------
     Recarrega campanhas+atividades sem precisar dar F5. Só re-renderiza
     quando algo realmente mudou e o usuário NÃO está no meio de uma ação
     (modal/drawer aberto, digitando, ou arrastando um card). */
  function isBusy() {
    if (document.getElementById('modal-overlay') || document.getElementById('drawer-overlay')) return true;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return true;
    if (document.querySelector('.dragging')) return true;
    return false;
  }
  function dataSig() {
    const c = App.data.campaigns || [], t = App.data.tasks || [];
    let s = c.length + ':' + t.length + '|';
    for (let i = 0; i < c.length; i++) {
      const x = c[i];
      s += x.id + (x.status || '') + (x.progress || 0) + (x.ownerId || '') + (x.photo ? '1' : '0') + (x.candidate || '') + ';';
    }
    s += '|';
    for (let i = 0; i < t.length; i++) {
      const x = t[i];
      s += x.id + x.status + x.stageId + (x.rotina ? '1' : '0') + (x.assigneeId || '') + (x.dueDate || '') + (x.title || '') + ';';
    }
    return s;
  }
  let syncing = false;
  async function syncNow(force) {
    if (!App.authed || syncing) return;
    if (!force && (document.hidden || isBusy())) return;
    syncing = true;
    const before = dataSig();
    try { await App.store.refresh(); }
    catch (e) { syncing = false; return; }
    syncing = false;
    if (isBusy()) return;                    // começou a interagir durante o fetch
    if (dataSig() !== before) render();      // só re-renderiza se mudou algo
  }
  App.syncNow = syncNow;

  setInterval(function () { syncNow(false); }, 15000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) syncNow(false); });
  window.addEventListener('focus', function () { syncNow(false); });

  window.addEventListener('hashchange', () => { if (App.authed) { render(); syncNow(false); } });
  window.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();

  App.render = render;
})(window.App = window.App || {});
