/* =============================================================
   AUTH VIEW — telas de login e de criação do 1º administrador.
   ============================================================= */
(function (App) {
  'use strict';
  const ui = App.ui;

  function shell(inner) {
    return '<div class="auth-screen"><div class="auth-card">' +
      '<div class="auth-brand"><img class="brand-logo lg" src="assets/logo-dual.svg" alt="Dual Comunicação">' +
      '<div class="brand-name">Gestão <span>Dual</span><small>' +
      ui.escapeHtml((App.data.config && App.data.config.agencia_nome) || 'Dual Comunicação') +
      '</small></div></div>' + inner + '</div>' +
      '<p class="auth-foot">Gestão operacional de campanhas</p></div>';
  }

  function formHtml(title, hint, cta, extra) {
    return '<h1 class="auth-title">' + title + '</h1>' +
      '<p class="auth-hint">' + hint + '</p>' +
      '<form id="auth-form" class="auth-form">' +
        (extra || '') +
        '<label class="field"><span>Nome</span><input name="nome" autocomplete="username" required autofocus placeholder="Seu nome"></label>' +
        '<label class="field"><span>Senha</span><input name="senha" type="password" autocomplete="current-password" required placeholder="••••••"></label>' +
        '<div class="auth-error" id="auth-error"></div>' +
        '<button type="submit" class="btn btn-primary btn-block auth-submit">' + cta + '</button>' +
      '</form>';
  }

  function mount(handler) {
    const form = document.getElementById('auth-form');
    const err = document.getElementById('auth-error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const btn = form.querySelector('.auth-submit');
      btn.disabled = true; btn.style.opacity = '.6'; err.textContent = '';
      try {
        await handler(fd.get('nome').trim(), fd.get('senha'));
      } catch (ex) {
        err.textContent = ex.message || 'Falha ao entrar';
        btn.disabled = false; btn.style.opacity = '';
      }
    });
  }

  App.authView = {
    showLogin: function (msg) {
      document.getElementById('app').innerHTML = shell(
        formHtml('Entrar', 'Acesse com seu nome e senha.', 'Entrar',
          msg ? '<div class="auth-note">' + ui.escapeHtml(msg) + '</div>' : ''));
      document.getElementById('app').className = 'auth-shell';
      mount(async (nome, senha) => {
        const res = await App.api.login(nome, senha);
        App.api.setToken(res.token);
        await App.afterAuth(res.usuario);
      });
    },
    showBootstrap: function () {
      document.getElementById('app').innerHTML = shell(
        formHtml('Bem-vindo(a) 👋', 'O sistema está vazio. Crie o primeiro administrador para começar.',
          'Criar administrador'));
      document.getElementById('app').className = 'auth-shell';
      mount(async (nome, senha) => {
        const res = await App.api.bootstrap(nome, senha);
        App.api.setToken(res.token);
        await App.afterAuth(res.usuario);
      });
    },
  };
})(window.App = window.App || {});
