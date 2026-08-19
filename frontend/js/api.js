/* =============================================================
   API CLIENT — comunicação com o backend FastAPI (mesma origem).
   Token JWT guardado no localStorage.
   ============================================================= */
(function (App) {
  'use strict';
  const BASE = '';                       // mesma origem (servido em /app)
  let token = localStorage.getItem('gestao_token') || null;

  function setToken(t) {
    token = t || null;
    if (t) localStorage.setItem('gestao_token', t);
    else localStorage.removeItem('gestao_token');
  }

  async function req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let res;
    try {
      res = await fetch(BASE + path, {
        method, headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw { status: 0, message: 'Falha de conexão com a API' };
    }
    if (res.status === 401) { setToken(null); throw { status: 401, message: 'Sessão expirada' }; }
    const txt = await res.text();
    let data = null;
    if (txt) { try { data = JSON.parse(txt); } catch (e) { data = txt; } }
    if (!res.ok) {
      const msg = (data && (data.detail || data.message)) || res.statusText || 'Erro';
      throw { status: res.status, message: typeof msg === 'string' ? msg : JSON.stringify(msg), data };
    }
    return data;
  }

  App.api = {
    token: () => token,
    setToken,
    // auth / setup
    setupStatus: () => req('GET', '/setup/status'),
    bootstrap: (nome, senha) => req('POST', '/auth/bootstrap', { nome, senha }),
    login: (nome, senha) => req('POST', '/auth/login', { nome, senha }),
    logout: () => req('POST', '/auth/logout'),
    me: () => req('GET', '/auth/me'),
    // dados
    meta: () => req('GET', '/meta'),
    criarEtiqueta: (nome, cor) => req('POST', '/etiquetas', { nome, cor }),
    usuarios: () => req('GET', '/usuarios'),
    criarUsuario: (u) => req('POST', '/usuarios', u),
    atualizarFotoUsuario: (id, foto) => req('PATCH', '/usuarios/' + id + '/foto', { foto }),
    campanhas: () => req('GET', '/campanhas'),
    criarCampanha: (c) => req('POST', '/campanhas', c),
    campanha: (id) => req('GET', '/campanhas/' + id),
    atualizarCampanha: (id, p) => req('PUT', '/campanhas/' + id, p),
    excluirCampanha: (id) => req('DELETE', '/campanhas/' + id),
    credenciais: (cid) => req('GET', '/campanhas/' + cid + '/credenciais'),
    criarCredencial: (cid, c) => req('POST', '/campanhas/' + cid + '/credenciais', c),
    revelarCredencial: (id) => req('GET', '/credenciais/' + id + '/revelar'),
    atualizarCredencial: (id, p) => req('PUT', '/credenciais/' + id, p),
    excluirCredencial: (id) => req('DELETE', '/credenciais/' + id),
    // Anotações — pastas
    pastas: (cid) => req('GET', '/campanhas/' + cid + '/pastas'),
    criarPasta: (cid, nome) => req('POST', '/campanhas/' + cid + '/pastas', { nome }),
    renomearPasta: (id, nome) => req('PUT', '/pastas/' + id, { nome }),
    excluirPasta: (id) => req('DELETE', '/pastas/' + id),
    // Anotações — notas
    notas: (cid, pasta) => req('GET', '/campanhas/' + cid + '/notas' + (pasta ? '?pasta=' + pasta : '')),
    nota: (id) => req('GET', '/notas/' + id),
    criarNota: (cid, n) => req('POST', '/campanhas/' + cid + '/notas', n),
    atualizarNota: (id, p) => req('PUT', '/notas/' + id, p),
    excluirNota: (id) => req('DELETE', '/notas/' + id),
    // Anotações — arquivos
    arquivos: (cid, pasta) => req('GET', '/campanhas/' + cid + '/arquivos' + (pasta ? '?pasta=' + pasta : '')),
    enviarArquivo: (cid, a) => req('POST', '/campanhas/' + cid + '/arquivos', a),
    atualizarArquivo: (id, p) => req('PUT', '/arquivos/' + id, p),
    excluirArquivo: (id) => req('DELETE', '/arquivos/' + id),
    baixarArquivo: async (id) => {
      const res = await fetch('/arquivos/' + id + '/download', {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      if (!res.ok) throw { status: res.status, message: 'Falha ao baixar arquivo' };
      return await res.blob();
    },
    atividades: () => req('GET', '/atividades'),
    atividade: (id) => req('GET', '/atividades/' + id),
    criarAtividade: (a) => req('POST', '/atividades', a),
    atualizarAtividade: (id, p) => req('PUT', '/atividades/' + id, p),
    moverAtividade: (id, status_id, ordem_coluna) => req('PATCH', '/atividades/' + id + '/status', { status_id, ordem_coluna }),
    excluirAtividade: (id) => req('DELETE', '/atividades/' + id),
    comentar: (id, texto) => req('POST', '/atividades/' + id + '/comentarios', { texto }),
    addChecklist: (id, texto, prazo) => req('POST', '/atividades/' + id + '/checklist', { texto, prazo }),
    patchChecklist: (itemId, patch) => req('PATCH', '/checklist/' + itemId, patch),
    delChecklist: (itemId) => req('DELETE', '/checklist/' + itemId),
  };
})(window.App = window.App || {});
