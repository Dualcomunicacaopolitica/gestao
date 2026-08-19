/* =============================================================
   UI HELPERS
   -------------------------------------------------------------
   Funções utilitárias de interface: ícones (SVG inline),
   formatação, escape, toasts, modal e drawer.
   Sem dependências externas — funciona 100% offline (file://).
   ============================================================= */
(function (App) {
  'use strict';

  /* ---------- Ícones (SVG inline, estilo linha) ---------- */
  const ICONS = {
    dashboard: '<path d="M3 13h8V3H3v10zM3 21h8v-6H3v6zM13 21h8V11h-8v10zM13 3v6h8V3h-8z"/>',
    campaigns: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" fill="none"/>',
    kanban: '<path d="M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z" fill="none"/>',
    timeline: '<path d="M3 6h18M3 12h12M3 18h7" fill="none"/>',
    team: '<circle cx="9" cy="8" r="3" fill="none"/><path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0-1-5.8M21 20a5.5 5.5 0 0 0-4-5.3" fill="none"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" fill="none"/>',
    settings: '<circle cx="12" cy="12" r="3" fill="none"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" fill="none"/>',
    search: '<circle cx="11" cy="11" r="7" fill="none"/><path d="M21 21l-4.3-4.3" fill="none"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" fill="none"/>',
    plus: '<path d="M12 5v14M5 12h14" fill="none"/>',
    clock: '<circle cx="12" cy="12" r="9" fill="none"/><path d="M12 7v5l3 2" fill="none"/>',
    check: '<path d="M20 6 9 17l-5-5" fill="none"/>',
    alert: '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" fill="none"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2" fill="none"/><path d="M3 9h18M8 2v4M16 2v4" fill="none"/>',
    flag: '<path d="M4 21V4M4 4s2-1 5-1 4 2 7 2 4-1 4-1v10s-1 1-4 1-4-2-7-2-5 1-5 1" fill="none"/>',
    x: '<path d="M18 6 6 18M6 6l12 12" fill="none"/>',
    chevronRight: '<path d="M9 6l6 6-6 6" fill="none"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7" fill="none"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" fill="none"/>',
    grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" fill="none"/>',
    plus2: '<circle cx="12" cy="12" r="9" fill="none"/><path d="M12 8v8M8 12h8" fill="none"/>',
    zoomIn: '<circle cx="11" cy="11" r="7" fill="none"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" fill="none"/>',
    zoomOut: '<circle cx="11" cy="11" r="7" fill="none"/><path d="M21 21l-4.3-4.3M8 11h6" fill="none"/>',
    target: '<circle cx="12" cy="12" r="9" fill="none"/><circle cx="12" cy="12" r="5" fill="none"/><circle cx="12" cy="12" r="1"/>',
    users: '<circle cx="9" cy="8" r="3" fill="none"/><path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0-1-5.8M21 20a5.5 5.5 0 0 0-4-5.3" fill="none"/>',
    dot: '<circle cx="12" cy="12" r="4"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18" fill="none"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" fill="none"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none"/>',
    history: '<path d="M3 3v6h6M3.5 9A9 9 0 1 1 3 12" fill="none"/><path d="M12 7v5l4 2" fill="none"/>',
    location: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" fill="none"/><circle cx="12" cy="10" r="2.5" fill="none"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" fill="none"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" fill="none"/>',
    eye: '<path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" fill="none"/><circle cx="12" cy="12" r="3" fill="none"/>',
    eyeOff: '<path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c7 0 10.5 7 10.5 7a17 17 0 0 1-3.3 4M6.6 6.6A17 17 0 0 0 1.5 12S5 19 12 19a9.6 9.6 0 0 0 4.3-1M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none"/>',
    repeat: '<path d="M17 2l4 4-4 4" fill="none"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4" fill="none"/><path d="M21 13v2a4 4 0 0 1-4 4H3" fill="none"/>'
  };

  function icon(name, size) {
    const p = ICONS[name] || ICONS.dot;
    const s = size || 18;
    return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
      'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" aria-hidden="true">' +
      p + '</svg>';
  }

  /* ---------- Formatação ---------- */
  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  function fmtDate(iso, full) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    if (full) return d + ' ' + MONTHS_FULL[m - 1] + ' ' + y;
    return d + ' ' + MONTHS[m - 1];
  }

  function initials(name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function daysUntil(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const [ty, tm, td] = App.TODAY.split('-').map(Number);
    const a = Date.UTC(y, m - 1, d), b = Date.UTC(ty, tm - 1, td);
    return Math.round((a - b) / 86400000);
  }

  /* ---------- Avatar ---------- */
  function avatar(userId, size) {
    const u = App.select.user(userId);
    if (!u) return '';
    const s = size || 28;
    if (u.photo) {
      return '<span class="avatar avatar-photo" title="' + escapeHtml(u.name) + '" style="width:' + s + 'px;height:' + s +
        'px"><img src="' + u.photo + '" alt="' + escapeHtml(u.name) + '"></span>';
    }
    return '<span class="avatar" title="' + escapeHtml(u.name) + '" style="width:' + s + 'px;height:' + s +
      'px;background:' + u.color + '">' + initials(u.name) + '</span>';
  }

  /* Avatar da CAMPANHA (quadradinho) — usa a foto quando houver, senão iniciais.
     sizeClass: '' (42px), 'sm' (32px) ou 'lg' (60px). */
  function campAvatar(c, sizeClass) {
    if (!c) return '';
    const cls = 'camp-avatar' + (sizeClass ? ' ' + sizeClass : '');
    if (c.photo) {
      return '<span class="' + cls + ' avatar-photo"><img src="' + c.photo + '" alt="' + escapeHtml(c.candidate) + '"></span>';
    }
    return '<span class="' + cls + '" style="background:' + c.color + '">' + initials(c.candidate) + '</span>';
  }

  /* ---------- Toast ---------- */
  let toastHost;
  function toast(msg, type) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toast-host';
      document.body.appendChild(toastHost);
    }
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.innerHTML = icon(type === 'success' ? 'check' : type === 'error' ? 'alert' : 'bell', 16) +
      '<span>' + escapeHtml(msg) + '</span>';
    toastHost.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, 2600);
  }

  /* ---------- Modal ---------- */
  function openModal(html, opts) {
    opts = opts || {};
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'modal-overlay';
    overlay.innerHTML = '<div class="modal ' + (opts.size || '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
    document.body.style.overflow = 'hidden';
    return overlay;
  }
  function closeModal() {
    const o = document.getElementById('modal-overlay');
    if (o) { o.classList.remove('open'); setTimeout(() => o.remove(), 220); }
    if (!document.getElementById('drawer')) document.body.style.overflow = '';
  }

  /* ---------- Drawer (painel lateral) ---------- */
  function openDrawer(html) {
    closeDrawer();
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'drawer-overlay';
    overlay.innerHTML = '<aside class="drawer" id="drawer" role="dialog" aria-modal="true">' + html + '</aside>';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeDrawer(); });
    document.body.style.overflow = 'hidden';
    return overlay;
  }
  function closeDrawer() {
    const o = document.getElementById('drawer-overlay');
    if (o) { o.classList.remove('open'); setTimeout(() => o.remove(), 260); }
    if (!document.getElementById('modal-overlay')) document.body.style.overflow = '';
  }

  // ESC fecha modal/drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeDrawer(); }
  });

  /* ---------- Badges / chips ---------- */
  function priorityBadge(pid) {
    const p = App.select.priority(pid);
    if (!p) return '';
    return '<span class="pill" style="--c:' + p.color + '"><span class="pill-dot"></span>' + p.name + '</span>';
  }
  function statusBadge(sid) {
    const s = App.select.status(sid);
    if (!s) return '';
    return '<span class="pill" style="--c:' + s.color + '"><span class="pill-dot"></span>' + s.name + '</span>';
  }
  function labelChip(lid) {
    const l = App.select.label(lid);
    if (!l) return '';
    return '<span class="chip" style="--c:' + l.color + '">' + l.name + '</span>';
  }
  function riskDot(risk, withText) {
    const map = { green: ['#22c55e', 'No prazo'], yellow: ['#f59e0b', 'Atenção'], red: ['#ef4444', 'Atrasada'] };
    const r = map[risk] || map.green;
    return '<span class="risk" title="' + r[1] + '"><span class="risk-dot" style="background:' + r[0] +
      '"></span>' + (withText ? '<span class="risk-txt">' + r[1] + '</span>' : '') + '</span>';
  }

  /* ---------- Cargos (lista suspensa) ---------- */
  const CARGOS = ['Governador', 'Dep. Federal', 'Dep. Estadual', 'Senador', 'Outro'];

  /* Monta um <select> de cargo + um input "Outro" (mostrado só quando Outro).
     `atual` pré-seleciona; se não bater com a lista, cai em "Outro". */
  function cargoField(name, atual) {
    const known = CARGOS.includes(atual);
    const isOutro = atual && !known;
    const opts = CARGOS.map((c) =>
      '<option value="' + c + '"' + ((atual === c || (isOutro && c === 'Outro')) ? ' selected' : '') + '>' + c + '</option>'
    ).join('');
    return '<label class="field"><span>Cargo</span>' +
      '<select name="' + name + '_sel" data-cargo-sel>' + opts + '</select></label>' +
      '<label class="field cargo-outro"' + (isOutro ? '' : ' hidden') + ' data-cargo-outro><span>Cargo (Outro)</span>' +
      '<input name="' + name + '_outro" value="' + escapeHtml(isOutro ? atual : '') + '" placeholder="Digite o cargo"></label>';
  }

  /* Liga a lógica do campo de cargo dentro de um container (form/modal). */
  function wireCargoField(root) {
    const sel = root.querySelector('[data-cargo-sel]');
    const outro = root.querySelector('[data-cargo-outro]');
    if (!sel || !outro) return;
    const sync = () => { outro.hidden = sel.value !== 'Outro'; };
    sel.addEventListener('change', sync); sync();
  }

  /* Lê o valor final do cargo (texto do "Outro" quando aplicável). */
  function readCargo(fd, name) {
    const sel = fd.get(name + '_sel');
    return sel === 'Outro' ? (fd.get(name + '_outro') || '').trim() : sel;
  }

  /* ---------- Autocomplete de Cidade/Estado ---------- */
  function _norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  function attachCityAutocomplete(input) {
    if (!input) return;
    const list = document.createElement('div');
    list.className = 'ac-list'; list.hidden = true;
    input.insertAdjacentElement('afterend', list);
    const all = App.CIDADES || [];
    function render(matches) {
      if (!matches.length) { list.hidden = true; list.innerHTML = ''; return; }
      list.innerHTML = matches.map((c) => {
        const i = c.lastIndexOf('/');
        const cidade = c.slice(0, i), uf = c.slice(i + 1);
        return '<button type="button" class="ac-item" data-val="' + escapeHtml(c) + '">' +
          '<span>' + escapeHtml(cidade) + '</span><small>' + uf + '</small></button>';
      }).join('');
      list.hidden = false;
    }
    input.addEventListener('input', () => {
      const q = _norm(input.value.trim());
      if (q.length < 2) { render([]); return; }
      const starts = [], incl = [];
      for (let i = 0; i < all.length && starts.length < 8; i++) {
        if (_norm(all[i].slice(0, all[i].lastIndexOf('/'))).startsWith(q)) starts.push(all[i]);
      }
      if (starts.length < 8) {
        for (let i = 0; i < all.length && (starts.length + incl.length) < 8; i++) {
          const nm = _norm(all[i].slice(0, all[i].lastIndexOf('/')));
          if (!nm.startsWith(q) && nm.includes(q)) incl.push(all[i]);
        }
      }
      render(starts.concat(incl).slice(0, 8));
    });
    list.addEventListener('mousedown', (e) => {
      const btn = e.target.closest('.ac-item'); if (!btn) return;
      e.preventDefault();
      input.value = btn.getAttribute('data-val'); render([]); input.focus();
    });
    input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
  }

  /* ---------- Redimensiona uma imagem (File) para data URL pequeno ---------- */
  function resizeImage(file, max, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('leitura'));
      reader.onload = () => {
        const im = new Image();
        im.onerror = () => reject(new Error('imagem'));
        im.onload = () => {
          let w = im.naturalWidth, h = im.naturalHeight;
          const scale = Math.min(1, (max || 320) / Math.max(w, h));
          w = Math.round(w * scale); h = Math.round(h * scale);
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(im, 0, 0, w, h);
          resolve(cv.toDataURL('image/jpeg', quality || 0.82));
        };
        im.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Recortador de imagem (zoom + reposição) → data URL quadrado ---------- */
  function _toDataUrl(source) {
    return new Promise((resolve, reject) => {
      if (typeof source === 'string') return resolve(source);
      const r = new FileReader();
      r.onerror = () => reject(new Error('leitura'));
      r.onload = () => resolve(r.result);
      r.readAsDataURL(source);
    });
  }

  function openImageCropper(source, opts) {
    opts = opts || {};
    const OUT = opts.output || 320, V = 260;
    return new Promise((resolve) => {
      _toDataUrl(source).then((dataUrl) => {
        const html = '' +
          '<div class="modal-head"><h2>' + icon('edit', 18) + ' Ajustar foto</h2>' +
            '<button class="icon-btn" data-close aria-label="Fechar">' + icon('x', 20) + '</button></div>' +
          '<div class="modal-body cropper">' +
            '<div class="crop-stage" id="crop-stage"><img id="crop-img" alt=""></div>' +
            '<div class="crop-controls">' + icon('zoomOut', 15) +
              '<input type="range" id="crop-zoom" min="1" max="4" step="0.01" value="1">' + icon('zoomIn', 15) + '</div>' +
            '<p class="crop-hint">Arraste para reposicionar · use o controle para dar zoom</p>' +
            '<div class="modal-foot"><button class="btn" data-close>Cancelar</button>' +
              '<button class="btn btn-primary" id="crop-apply">' + icon('check', 16) + 'Aplicar</button></div>' +
          '</div>';
        const overlay = openModal(html, { size: 'modal-sm' });
        const stage = overlay.querySelector('#crop-stage');
        const img = overlay.querySelector('#crop-img');
        const zoom = overlay.querySelector('#crop-zoom');
        let nw = 0, nh = 0, base = 1, z = 1, tx = 0, ty = 0, drag = null, done = false;
        const dispW = () => nw * base * z, dispH = () => nh * base * z;
        function clamp() { tx = Math.min(0, Math.max(V - dispW(), tx)); ty = Math.min(0, Math.max(V - dispH(), ty)); }
        function layout(center) {
          if (center) { tx = (V - dispW()) / 2; ty = (V - dispH()) / 2; }
          clamp();
          img.style.width = dispW() + 'px'; img.style.height = dispH() + 'px';
          img.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
        }
        img.onload = () => { nw = img.naturalWidth; nh = img.naturalHeight; base = V / Math.min(nw, nh); z = 1; zoom.value = '1'; layout(true); };
        img.src = dataUrl;
        zoom.addEventListener('input', () => {
          const old = z; z = parseFloat(zoom.value);
          const cx = V / 2, cy = V / 2;
          tx = cx - (cx - tx) * (z / old); ty = cy - (cy - ty) * (z / old);
          layout(false);
        });
        stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty }; stage.setPointerCapture(e.pointerId); });
        stage.addEventListener('pointermove', (e) => { if (!drag) return; tx = drag.tx + (e.clientX - drag.x); ty = drag.ty + (e.clientY - drag.y); layout(false); });
        stage.addEventListener('pointerup', () => { drag = null; });
        overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { if (!done) { done = true; closeModal(); resolve(null); } }));
        overlay.querySelector('#crop-apply').addEventListener('click', () => {
          const sd = base * z, sx = -tx / sd, sy = -ty / sd, ss = V / sd;
          const cv = document.createElement('canvas'); cv.width = OUT; cv.height = OUT;
          cv.getContext('2d').drawImage(img, sx, sy, ss, ss, 0, 0, OUT, OUT);
          const url = cv.toDataURL('image/jpeg', 0.85);
          done = true; closeModal(); resolve(url);
        });
      });
    });
  }

  /* ---------- Menu de foto (clicar na foto → Substituir / Remover) ---------- */
  function attachPhotoMenu(wrap, opts) {
    opts = opts || {};
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'photo-edit-btn'; btn.title = 'Alterar foto';
    btn.setAttribute('aria-label', 'Alterar foto');
    btn.innerHTML = icon('edit', 13);
    const menu = document.createElement('div');
    menu.className = 'photo-menu'; menu.hidden = true;
    wrap.appendChild(input); wrap.appendChild(btn); wrap.appendChild(menu);

    function build() {
      const has = !!opts.hasPhoto();
      menu.innerHTML =
        '<button type="button" data-act="pick">' + icon('edit', 14) + (has ? 'Substituir foto' : 'Adicionar foto') + '</button>' +
        (has ? '<button type="button" data-act="remove" class="danger">' + icon('trash', 14) + 'Remover foto</button>' : '');
    }
    function open() { build(); menu.hidden = false; }
    function close() { menu.hidden = true; }
    function toggle(e) { e.stopPropagation(); if (menu.hidden) open(); else close(); }

    btn.addEventListener('click', toggle);
    wrap.addEventListener('click', (e) => { if (e.target.closest('.photo-menu')) return; toggle(e); });
    document.addEventListener('click', function closer(e) {
      if (!document.body.contains(wrap)) { document.removeEventListener('click', closer); return; }
      if (!wrap.contains(e.target)) close();
    });
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      close();
      if (b.getAttribute('data-act') === 'pick') input.click();
      else if (opts.onRemove) opts.onRemove();
    });
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0]; input.value = '';
      if (!file) return;
      const dataUrl = await openImageCropper(file, { output: opts.output || 320 });
      if (dataUrl && opts.onPick) opts.onPick(dataUrl);
    });
  }

  App.ui = {
    icon, fmtDate, initials, escapeHtml, avatar, campAvatar, toast, daysUntil,
    openModal, closeModal, openDrawer, closeDrawer,
    priorityBadge, statusBadge, labelChip, riskDot, MONTHS, MONTHS_FULL,
    CARGOS, cargoField, wireCargoField, readCargo, attachCityAutocomplete, resizeImage, openImageCropper, attachPhotoMenu
  };
})(window.App = window.App || {});
