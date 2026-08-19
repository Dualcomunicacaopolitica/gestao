/* =============================================================
   ANOTAÇÕES da campanha — pastas + notas (blocos estilo Notion)
   + arquivos (estilo Google Drive).
   Exposto como App.anotacoes.render(body, campaign), chamado pela
   aba "Anotações" do detalhe da campanha (campaign.js).
   ============================================================= */
(function (App) {
  'use strict';
  const ui = App.ui;
  const MAX_MB = 8;

  const BLOCK_TYPES = [
    ['texto', 'Texto', 'Parágrafo comum'],
    ['titulo', 'Título', 'Seção grande'],
    ['lista', 'Lista', 'Item com marcador'],
    ['check', 'Checklist', 'Item com caixa'],
    ['aviso', 'Aviso', 'Bloco destacado']
  ];

  function render(body, c) {
    const st = { folder: null, folderName: null };
    renderList(body, c, st);
  }

  /* ---------------- LISTA (pastas / notas / arquivos) ---------------- */
  function renderList(body, c, st) {
    body.innerHTML = '<div class="an-loading">' + ui.icon('clock', 18) + ' Carregando…</div>';
    Promise.all([
      App.api.pastas(c.id),
      App.api.notas(c.id, st.folder),
      App.api.arquivos(c.id, st.folder)
    ]).then(([pastas, notas, arquivos]) => {
      const atRoot = !st.folder;
      const crumb = atRoot
        ? '<div class="an-crumb"><b>Anotações</b></div>'
        : '<div class="an-crumb"><a data-root>Anotações</a>' + ui.icon('chevronRight', 14) + '<b>' + ui.escapeHtml(st.folderName) + '</b></div>';

      const foldersHtml = (atRoot && pastas.length)
        ? '<div class="an-sec">Pastas</div><div class="an-folders">' + pastas.map((f) =>
            '<div class="an-folder" data-folder="' + f.id + '" data-name="' + ui.escapeHtml(f.nome) + '">' +
              '<span class="an-folder-ic">' + folderIcon() + '</span>' +
              '<div class="an-folder-i"><strong>' + ui.escapeHtml(f.nome) + '</strong></div>' +
              '<button class="an-folder-menu" data-folder-del="' + f.id + '" title="Excluir pasta">' + ui.icon('trash', 14) + '</button>' +
            '</div>').join('') + '</div>'
        : '';

      const notesHtml = '<div class="an-sec">Notas</div>' + (notas.length
        ? '<div class="an-notes">' + notas.map((n) =>
            '<div class="an-note" data-note="' + n.id + '">' +
              '<div class="an-note-t">' + ui.icon('message', 15) + ui.escapeHtml(n.titulo || 'Sem título') + '</div>' +
              '<div class="an-note-p">' + (n.preview ? ui.escapeHtml(n.preview) : '<span class="an-empty">Nota vazia</span>') + '</div>' +
              '<div class="an-note-f">' + tempo(n.atualizado_em) +
                '<button class="an-note-del" data-note-del="' + n.id + '" title="Excluir">' + ui.icon('trash', 13) + '</button></div>' +
            '</div>').join('') + '</div>'
        : '<p class="an-mini">Nenhuma nota aqui ainda.</p>');

      const filesHtml = '<div class="an-sec">Arquivos</div>' + (arquivos.length
        ? '<div class="an-files">' + arquivos.map((a) =>
            '<div class="an-file" data-file="' + a.id + '" data-nome="' + ui.escapeHtml(a.nome) + '">' +
              '<span class="an-file-ic ' + fileKind(a.nome, a.mime) + '">' + fileIcon() + '</span>' +
              '<div class="an-file-m"><strong>' + ui.escapeHtml(a.nome) + '</strong>' +
                '<span>' + tamanho(a.tamanho) + (a.enviado_por_nome ? ' · ' + ui.escapeHtml(a.enviado_por_nome) : '') + '</span></div>' +
              '<button class="an-file-btn" data-file-dl="' + a.id + '" title="Baixar">' + ui.icon('logout', 15) + '</button>' +
              '<button class="an-file-btn" data-file-del="' + a.id + '" title="Excluir">' + ui.icon('trash', 15) + '</button>' +
            '</div>').join('') + '</div>'
        : '<p class="an-mini">Nenhum arquivo aqui ainda.</p>');

      body.innerHTML =
        '<div class="an-bar">' + crumb +
          '<div class="an-actions">' +
            '<div class="an-new" id="an-new">' +
              '<button class="btn btn-primary btn-sm" id="an-new-btn">' + ui.icon('plus', 15) + 'Novo</button>' +
              '<div class="an-new-menu" id="an-new-menu" hidden>' +
                '<button data-new="nota">' + ui.icon('message', 15) + 'Nova nota</button>' +
                '<button data-new="pasta">' + folderIcon(14) + 'Nova pasta</button>' +
                '<button data-new="upload">' + ui.icon('logout', 15) + 'Enviar arquivo</button>' +
              '</div>' +
            '</div>' +
            '<input type="file" id="an-upload" multiple hidden>' +
          '</div>' +
        '</div>' +
        foldersHtml + notesHtml + filesHtml;

      wireList(body, c, st);
    }).catch(() => {
      body.innerHTML = '<div class="empty-state">' + ui.icon('alert', 28) + '<h3>Não foi possível carregar as anotações</h3></div>';
    });
  }

  function wireList(body, c, st) {
    const rerun = () => renderList(body, c, st);

    const rootLink = body.querySelector('[data-root]');
    if (rootLink) rootLink.addEventListener('click', () => { st.folder = null; st.folderName = null; rerun(); });

    body.querySelectorAll('[data-folder]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('[data-folder-del]')) return;
      st.folder = el.getAttribute('data-folder'); st.folderName = el.getAttribute('data-name'); rerun();
    }));
    body.querySelectorAll('[data-folder-del]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Excluir esta pasta? As notas e arquivos dela voltam para a raiz.')) return;
      try { await App.api.excluirPasta(b.getAttribute('data-folder-del')); } catch (err) { ui.toast('Erro ao excluir', 'error'); return; }
      rerun();
    }));

    body.querySelectorAll('[data-note]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('[data-note-del]')) return;
      openNote(body, c, st, el.getAttribute('data-note'));
    }));
    body.querySelectorAll('[data-note-del]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Excluir esta nota?')) return;
      try { await App.api.excluirNota(b.getAttribute('data-note-del')); } catch (err) { ui.toast('Erro ao excluir', 'error'); return; }
      rerun();
    }));

    body.querySelectorAll('[data-file-dl]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const row = b.closest('[data-file]'), nome = row.getAttribute('data-nome');
      try {
        const blob = await App.api.baixarArquivo(b.getAttribute('data-file-dl'));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch (err) { ui.toast('Erro ao baixar', 'error'); }
    }));
    body.querySelectorAll('[data-file-del]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Excluir este arquivo?')) return;
      try { await App.api.excluirArquivo(b.getAttribute('data-file-del')); } catch (err) { ui.toast('Erro ao excluir', 'error'); return; }
      rerun();
    }));

    // menu "Novo"
    const menu = body.querySelector('#an-new-menu');
    const newBtn = body.querySelector('#an-new-btn');
    newBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    document.addEventListener('click', function closer(e) {
      if (!body.querySelector('#an-new')) { document.removeEventListener('click', closer); return; }
      if (!e.target.closest('#an-new')) menu.hidden = true;
    });
    menu.querySelector('[data-new="nota"]').addEventListener('click', async () => {
      menu.hidden = true;
      let n;
      try { n = await App.api.criarNota(c.id, { titulo: 'Sem título', pasta_id: st.folder, blocos: [{ tipo: 'texto', texto: '' }] }); }
      catch (e) { ui.toast('Erro ao criar nota', 'error'); return; }
      openNote(body, c, st, n.id);
    });
    menu.querySelector('[data-new="pasta"]').addEventListener('click', async () => {
      menu.hidden = true;
      const nome = await askText('Nova pasta', '');
      if (!nome) return;
      try { await App.api.criarPasta(c.id, nome); } catch (e) { ui.toast('Erro ao criar pasta', 'error'); return; }
      rerun();
    });
    const upload = body.querySelector('#an-upload');
    menu.querySelector('[data-new="upload"]').addEventListener('click', () => { menu.hidden = true; upload.click(); });
    upload.addEventListener('change', async () => {
      const files = [].slice.call(upload.files || []);
      upload.value = '';
      for (const file of files) {
        if (file.size > MAX_MB * 1024 * 1024) { ui.toast('“' + file.name + '” passa de ' + MAX_MB + ' MB', 'error'); continue; }
        try {
          const dataUrl = await readDataUrl(file);
          await App.api.enviarArquivo(c.id, { nome: file.name, mime: file.type || null, pasta_id: st.folder, dados_base64: dataUrl });
        } catch (e) { ui.toast('Erro ao enviar “' + file.name + '”: ' + (e.message || ''), 'error'); }
      }
      ui.toast('Arquivos enviados', 'success');
      rerun();
    });
  }

  /* ---------------- EDITOR DA NOTA (blocos estilo Notion) ---------------- */
  function openNote(body, c, st, noteId) {
    body.innerHTML = '<div class="an-loading">' + ui.icon('clock', 18) + ' Abrindo…</div>';
    App.api.nota(noteId).then((data) => {
      const note = { id: data.id, titulo: data.titulo || 'Sem título', blocos: Array.isArray(data.blocos) ? data.blocos : [] };
      if (!note.blocos.length) note.blocos.push({ tipo: 'texto', texto: '' });
      let timer = null, savingHint;

      function scheduleSave() {
        if (savingHint) savingHint.textContent = 'Editando…';
        clearTimeout(timer);
        timer = setTimeout(flush, 700);
      }
      function flush() {
        clearTimeout(timer);
        if (savingHint) savingHint.textContent = 'Salvando…';
        return App.api.atualizarNota(note.id, { titulo: note.titulo, blocos: note.blocos })
          .then(() => { if (savingHint) savingHint.textContent = 'Salvo'; })
          .catch(() => { if (savingHint) savingHint.textContent = 'Erro ao salvar'; });
      }

      body.innerHTML =
        '<div class="an-note-page">' +
          '<div class="an-note-head">' +
            '<a class="an-back" data-back>' + ui.icon('arrowLeft', 16) + 'Anotações' + (st.folderName ? ' / ' + ui.escapeHtml(st.folderName) : '') + '</a>' +
            '<span class="an-save" id="an-save">Salvo</span>' +
          '</div>' +
          '<div class="an-title" id="an-title" contenteditable="true" spellcheck="false" data-ph="Sem título"></div>' +
          '<div class="an-blocks" id="an-blocks"></div>' +
          '<div class="an-add-wrap"><button class="an-add" id="an-add">' + ui.icon('plus', 15) + 'Adicionar bloco</button>' +
            '<div class="an-add-menu" id="an-add-menu" hidden>' + BLOCK_TYPES.map((t) =>
              '<button data-bt="' + t[0] + '"><strong>' + t[1] + '</strong><small>' + t[2] + '</small></button>').join('') + '</div>' +
          '</div>' +
        '</div>';

      savingHint = body.querySelector('#an-save');
      const titleEl = body.querySelector('#an-title');
      titleEl.textContent = note.titulo === 'Sem título' ? '' : note.titulo;
      titleEl.addEventListener('input', () => { note.titulo = titleEl.textContent.trim() || 'Sem título'; scheduleSave(); });
      titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); focusBlock(0); } });

      const host = body.querySelector('#an-blocks');
      note.blocos.forEach((blk) => host.appendChild(blockEl(blk)));

      body.querySelector('[data-back]').addEventListener('click', () => { flush().then(() => renderList(body, c, st)); });

      // menu adicionar bloco
      const addMenu = body.querySelector('#an-add-menu');
      body.querySelector('#an-add').addEventListener('click', (e) => { e.stopPropagation(); addMenu.hidden = !addMenu.hidden; });
      document.addEventListener('click', function closer(e) {
        if (!body.querySelector('#an-add')) { document.removeEventListener('click', closer); return; }
        if (!e.target.closest('.an-add-wrap')) addMenu.hidden = true;
      });
      addMenu.querySelectorAll('[data-bt]').forEach((b) => b.addEventListener('click', () => {
        addMenu.hidden = true;
        const blk = { tipo: b.getAttribute('data-bt'), texto: '' };
        if (blk.tipo === 'check') blk.feito = false;
        note.blocos.push(blk);
        const el = blockEl(blk);
        host.appendChild(el);
        scheduleSave();
        const ce = el.querySelector('[contenteditable]'); if (ce) ce.focus();
      }));

      function focusBlock(i) {
        const el = host.children[i]; if (!el) return;
        const ce = el.querySelector('[contenteditable]'); if (ce) ce.focus();
      }

      /* cria o DOM de um bloco (edição inline + reordenar + excluir) */
      function blockEl(blk) {
        const wrap = document.createElement('div');
        wrap.className = 'an-block an-b-' + blk.tipo;
        const tools = '<div class="an-b-tools">' +
          '<button data-up title="Subir">' + ui.icon('chevronRight', 13) + '</button>' +
          '<button data-down title="Descer">' + ui.icon('chevronRight', 13) + '</button>' +
          '<button data-del title="Excluir bloco">' + ui.icon('trash', 13) + '</button></div>';
        let content;
        if (blk.tipo === 'check') {
          content = '<label class="an-ck"><input type="checkbox"' + (blk.feito ? ' checked' : '') + '>' +
            '<span class="an-ck-box">' + ui.icon('check', 12) + '</span></label>' +
            '<div class="an-ce" contenteditable="true" spellcheck="false" data-ph="Item"></div>';
        } else if (blk.tipo === 'aviso') {
          content = '<span class="an-aviso-ic">' + ui.icon('alert', 17) + '</span>' +
            '<div class="an-ce" contenteditable="true" spellcheck="false" data-ph="Escreva um aviso…"></div>';
        } else if (blk.tipo === 'lista') {
          content = '<span class="an-bullet">•</span><div class="an-ce" contenteditable="true" spellcheck="false" data-ph="Item da lista"></div>';
        } else {
          const ph = blk.tipo === 'titulo' ? 'Título da seção' : 'Escreva algo…';
          content = '<div class="an-ce" contenteditable="true" spellcheck="false" data-ph="' + ph + '"></div>';
        }
        wrap.innerHTML = tools + '<div class="an-b-content">' + content + '</div>';

        const ce = wrap.querySelector('.an-ce');
        ce.textContent = blk.texto || '';
        ce.addEventListener('input', () => { blk.texto = ce.textContent; scheduleSave(); });
        ce.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey && blk.tipo !== 'texto' && blk.tipo !== 'aviso') {
            e.preventDefault();
            const nb = { tipo: blk.tipo === 'titulo' ? 'texto' : blk.tipo, texto: '' };
            if (nb.tipo === 'check') nb.feito = false;
            const idx = note.blocos.indexOf(blk);
            note.blocos.splice(idx + 1, 0, nb);
            const el = blockEl(nb);
            wrap.after(el);
            scheduleSave();
            el.querySelector('[contenteditable]').focus();
          }
        });
        const cb = wrap.querySelector('input[type="checkbox"]');
        if (cb) cb.addEventListener('change', () => { blk.feito = cb.checked; wrap.classList.toggle('done', cb.checked); scheduleSave(); });
        if (blk.feito) wrap.classList.add('done');

        wrap.querySelector('[data-del]').addEventListener('click', () => {
          const idx = note.blocos.indexOf(blk);
          if (idx >= 0) note.blocos.splice(idx, 1);
          wrap.remove();
          if (!note.blocos.length) { const t = { tipo: 'texto', texto: '' }; note.blocos.push(t); host.appendChild(blockEl(t)); }
          scheduleSave();
        });
        wrap.querySelector('[data-up]').addEventListener('click', () => move(blk, wrap, -1));
        wrap.querySelector('[data-down]').addEventListener('click', () => move(blk, wrap, 1));
        return wrap;
      }

      function move(blk, wrap, dir) {
        const idx = note.blocos.indexOf(blk), to = idx + dir;
        if (to < 0 || to >= note.blocos.length) return;
        note.blocos.splice(idx, 1); note.blocos.splice(to, 0, blk);
        if (dir < 0) wrap.previousElementSibling && wrap.parentNode.insertBefore(wrap, wrap.previousElementSibling);
        else wrap.nextElementSibling && wrap.parentNode.insertBefore(wrap.nextElementSibling, wrap);
        scheduleSave();
      }
    }).catch(() => { renderList(body, c, st); ui.toast('Erro ao abrir a nota', 'error'); });
  }

  /* ---------------- helpers ---------------- */
  function askText(titulo, inicial) {
    return new Promise((resolve) => {
      const html = '<div class="modal-head"><h2>' + ui.escapeHtml(titulo) + '</h2>' +
        '<button class="icon-btn" data-close aria-label="Fechar">' + ui.icon('x', 20) + '</button></div>' +
        '<form class="modal-body" id="an-ask"><label class="field"><span>Nome</span>' +
        '<input name="v" value="' + ui.escapeHtml(inicial || '') + '" required maxlength="80" autocomplete="off"></label>' +
        '<div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button>' +
        '<button type="submit" class="btn btn-primary">Salvar</button></div></form>';
      const ov = ui.openModal(html, { size: 'modal-sm' });
      let done = false;
      ov.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { if (!done) { done = true; ui.closeModal(); resolve(null); } }));
      const inp = ov.querySelector('input[name="v"]'); inp.focus(); inp.select();
      ov.querySelector('#an-ask').addEventListener('submit', (e) => {
        e.preventDefault(); const v = inp.value.trim(); if (!v) return;
        done = true; ui.closeModal(); resolve(v);
      });
    });
  }

  function readDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('leitura'));
      r.onload = () => resolve(r.result);
      r.readAsDataURL(file);
    });
  }

  function tamanho(b) {
    b = b || 0;
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  }
  function tempo(iso) {
    if (!iso) return '';
    return 'atualizado ' + ui.fmtDate((iso || '').slice(0, 10));
  }
  function fileKind(nome, mime) {
    const n = (nome || '').toLowerCase(); mime = mime || '';
    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return 'img';
    if (n.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
    if (/\.(xlsx?|csv)$/.test(n)) return 'xls';
    if (/\.(docx?|txt|rtf)$/.test(n)) return 'doc';
    return 'gen';
  }
  function folderIcon(s) { s = s || 24; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'; }
  function fileIcon() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></svg>'; }

  App.anotacoes = { render: render };
})(window.App = window.App || {});
