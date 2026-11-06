/* Визуальный редактор сайта «Джунгли Сити».
   Страница открывается в iframe без скриптов сайта, правки делаются прямо в ней,
   при сохранении страница собирается обратно в HTML и уходит коммитом в GitHub. */
(function () {
  'use strict';

  let CSRF = document.querySelector('meta[name="csrf"]').content;
  async function refreshCsrf() {
    try {
      const r = await fetch('api.php?action=csrf', { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json();
      if (r.ok && d.csrf) {
        CSRF = d.csrf;
        const f = document.querySelector('#logoutForm [name=csrf]');
        if (f) f.value = CSRF;
        return true;
      }
    } catch (e) { /* нет связи */ }
    return false;
  }
  const USER = document.getElementById('app').dataset.user;
  let SITE_BASE = new URL('../', location.href).href; // адрес сайта выбранного города

  // ---------------------------------------------------------------- утилиты
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return n;
  }
  const I = {
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/></svg>',
    pc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7c1.8 0 3.4-.6 4.8-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/><path d="M5 5v14"/></svg>',
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="M21 15l-5-5-9 9"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  };
  function btn(label, opts) {
    opts = opts || {};
    const b = h('button', { type: 'button', class: 'btn ' + (opts.cls || ''), title: opts.title || null, onclick: opts.onClick, disabled: opts.disabled || null });
    if (opts.icon) b.insertAdjacentHTML('beforeend', I[opts.icon]);
    if (label) b.append(h('span', { class: 'lbl' }, label));
    return b;
  }
  function toast(msg, type, ms) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = h('div', { class: 'toast-wrap' }); document.body.append(wrap); }
    const t = h('div', { class: 'toast' + (type ? ' toast--' + type : '') }, msg);
    wrap.append(t);
    setTimeout(() => t.remove(), ms || (type === 'err' ? 7000 : 3500));
  }
  function modal(opts) {
    const box = h('div', { class: 'modal__box' + (opts.wide ? ' modal__box--wide' : '') });
    const wrap = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, box);
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); };
    const guarded = () => { if (opts.confirmClose && opts.confirmClose() && !window.confirm('Закрыть без применения изменений?')) return; close(); };
    const onKey = (e) => { if (e.key === 'Escape' && !opts.sticky) guarded(); };
    document.addEventListener('keydown', onKey);
    if (!opts.sticky) {
      const x = btn('', { cls: 'btn--ghost btn--sm modal__close', icon: 'close', title: 'Закрыть', onClick: guarded });
      box.append(x);
    }
    if (opts.title) box.append(h('h2', null, opts.title));
    if (opts.text) box.append(h('p', null, opts.text));
    if (opts.body) box.append(opts.body);
    if (opts.buttons && opts.buttons.length) {
      const foot = h('div', { class: 'modal__foot' });
      opts.buttons.forEach(b => foot.append(btn(b.label, { cls: b.cls, icon: b.icon, onClick: () => {
        if (!b.onClick) { guarded(); return; }
        const r = b.onClick();
        if (b.close !== false && r !== false) close();
      } })));
      box.append(foot);
    }
    document.body.append(wrap);
    return { close, box, wrap };
  }
  function ask(title, text, buttons) {
    return new Promise(res => {
      let done = false;
      modal({
        title, text,
        onClose: () => { if (!done) res(null); },
        buttons: buttons.map(b => ({ label: b.label, cls: b.cls, onClick: () => { done = true; res(b.value); } })),
      });
    });
  }
  const confirmBox = (title, text, ok, danger) =>
    ask(title, text, [{ label: 'Отмена', value: false }, { label: ok || 'Да', cls: danger ? 'btn--danger' : 'btn--purple', value: true }]).then(Boolean);

  async function api(action, opts) {
    opts = opts || {};
    const params = Object.assign({}, S.site && action !== 'sites' ? { site: S.site } : {}, opts.params || {});
    const url = 'api.php?action=' + action + (Object.keys(params).length ? '&' + new URLSearchParams(params) : '');
    const init = { method: opts.body ? 'POST' : 'GET', headers: { 'X-CSRF': CSRF }, credentials: 'same-origin', cache: 'no-store' };
    if (opts.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    let r;
    try { r = await fetch(url, init); } catch (e) { throw Object.assign(new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.'), { status: 0 }); }
    let d = null;
    try { d = await r.json(); } catch (e) { /* пусто */ }
    if (r.status === 401) { sessionExpired(); throw Object.assign(new Error('Нужно войти заново'), { status: 401 }); }
    if (r.status === 403 && d && d.csrfExpired && !opts._retry && await refreshCsrf()) return api(action, Object.assign({}, opts, { _retry: true }));
    if (!r.ok) throw Object.assign(new Error((d && d.error) || ('Ошибка ' + r.status)), { status: r.status });
    return d;
  }
  function uploadFile(blob, path, onProgress, retried) {
    return new Promise((res, rej) => {
      const fd = new FormData();
      fd.append('path', path);
      fd.append('file', blob, path.split('/').pop());
      const x = new XMLHttpRequest();
      x.open('POST', 'api.php?action=upload&site=' + encodeURIComponent(S.site));
      x.setRequestHeader('X-CSRF', CSRF);
      x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      x.onload = () => {
        let d = null; try { d = JSON.parse(x.responseText); } catch (e) { /* */ }
        if (x.status === 401) { sessionExpired(); return rej(new Error('Нужно войти заново')); }
        if (x.status === 403 && d && d.csrfExpired && !retried) {
          return refreshCsrf().then(ok => ok ? uploadFile(blob, path, onProgress, true).then(res, rej) : rej(new Error(d.error)));
        }
        if (x.status >= 200 && x.status < 300 && d) res(d); else rej(new Error((d && d.error) || ('Ошибка загрузки ' + x.status)));
      };
      x.onerror = () => rej(new Error('Нет связи с сервером, файл не загрузился.'));
      x.send(fd);
    });
  }
  let expiredShown = false;
  function sessionExpired() {
    if (expiredShown) return;
    expiredShown = true;
    modal({ title: 'Нужно войти заново', sticky: true, text: 'Сессия закончилась (вы долго не заходили). Откройте админку в новой вкладке, войдите, а потом вернитесь сюда и нажмите «Сохранить» ещё раз — несохранённые правки на этой вкладке останутся.', buttons: [{ label: 'Открыть вход в новой вкладке', cls: 'btn--purple', close: false, onClick: () => { window.open(location.href, '_blank'); return false; } }, { label: 'Понятно', onClick: () => { expiredShown = false; } }] });
  }

  const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  function slug(s) {
    s = String(s || '').toLowerCase().split('').map(c => (c in TR ? TR[c] : c)).join('');
    s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return s || 'file';
  }
  const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function pickFiles(accept, multiple) {
    return new Promise(res => {
      const inp = h('input', { type: 'file', accept, multiple: multiple || null, style: 'display:none' });
      inp.addEventListener('change', () => { res([...inp.files]); inp.remove(); });
      document.body.append(inp);
      inp.click();
    });
  }
  async function processImage(file) {
    if (!/^image\/(jpeg|png|webp|heic|heif|avif|bmp)$/.test(file.type) && !/\.(jpe?g|png|webp|heic|avif)$/i.test(file.name)) {
      throw new Error('Нужна картинка в формате JPG, PNG или WebP');
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Не получилось открыть это фото. Попробуйте сохранить его как JPG.')); i.src = url; });
      const max = 1600;
      let w = img.naturalWidth, hgt = img.naturalHeight;
      const k = Math.min(1, max / Math.max(w, hgt));
      w = Math.round(w * k); hgt = Math.round(hgt * k);
      const c = document.createElement('canvas');
      c.width = w; c.height = hgt;
      c.getContext('2d').drawImage(img, 0, 0, w, hgt);
      const toBlob = (type, q) => new Promise(r => c.toBlob(r, type, q));
      let blob = await toBlob('image/webp', 0.86);
      if (blob && blob.type === 'image/webp') return { blob, ext: 'webp' };
      if (file.type === 'image/png') { blob = await toBlob('image/png'); return { blob, ext: 'png' }; }
      blob = await toBlob('image/jpeg', 0.86);
      return { blob, ext: 'jpg' };
    } finally { URL.revokeObjectURL(url); }
  }
  function progressModal(title) {
    const bar = h('span');
    const m = modal({ title, sticky: true, body: h('div', null, h('div', { class: 'progress' }, bar)) });
    return { set: (p) => { bar.style.width = Math.round(p * 100) + '%'; }, close: m.close };
  }

  // ---------------------------------------------------------------- состояние
  const S = {
    sites: [], site: null, pages: [], page: null, sha: null, crlf: false, doctype: '<!DOCTYPE html>',
    doc: null, initial: '', dirty: false, changes: new Set(), undo: [],
    uploads: [], blobByPath: new Map(), pathByBlob: new Map(),
    sel: null, editing: null, editBefore: '', phone: false, hover: null, loading: false,
  };

  // ---------------------------------------------------------------- каркас
  const app = document.getElementById('app');
  document.body.classList.add('app');
  const ui = {};
  ui.pageName = h('span', { class: 'topbar__title' }, '');
  ui.city = h('select', { class: 'city', title: 'Город', onchange: (e) => switchSite(e.target.value) });
  ui.pc = btn('Компьютер', { icon: 'pc', cls: 'is-on', onClick: () => setPhone(false) });
  ui.ph = btn('Телефон', { icon: 'phone', onClick: () => setPhone(true) });
  ui.undo = btn('Отменить', { icon: 'undo', disabled: true, title: 'Отменить последнее действие (Ctrl+Z)', onClick: undo });
  ui.save = btn('Сохранить', { icon: 'save', cls: 'btn--green', disabled: true, title: 'Сохранить и опубликовать (Ctrl+S)', onClick: save });
  ui.deploy = h('span', { class: 'deploy', hidden: true });
  ui.view = h('a', { class: 'btn', target: '_blank', rel: 'noopener', title: 'Открыть эту страницу на сайте' });
  ui.view.insertAdjacentHTML('beforeend', I.ext);
  const topbar = h('header', { class: 'topbar' },
    h('img', { class: 'topbar__logo', src: '../images/image.png', alt: '' }),
    ui.city,
    ui.pageName,
    h('div', { class: 'seg' }, ui.pc, ui.ph),
    ui.undo, ui.save, ui.deploy,
    h('span', { class: 'topbar__sp' }),
    btn('Разделы', { icon: 'layers', title: 'Скрыть или показать разделы сайта', onClick: openSections }),
    btn('История', { icon: 'clock', onClick: openHistory }),
    btn('', { icon: 'code', title: 'Код страницы — для разработчика', onClick: openCode }),
    ui.view,
    h('span', { class: 'topbar__user' }, USER),
    btn('', { icon: 'out', title: 'Выйти', onClick: logout }),
  );
  ui.pages = h('nav', { class: 'pages' });
  ui.frame = h('iframe', { sandbox: 'allow-same-origin', title: 'Страница сайта' });
  ui.loading = h('div', { class: 'canvas__loading' }, 'Загружаю страницу…');
  ui.canvas = h('div', { class: 'canvas' }, ui.frame, ui.loading);
  ui.side = h('aside', { class: 'side' });
  app.append(topbar, h('div', { class: 'main' }, ui.pages, ui.canvas, ui.side));

  function setPhone(on) {
    S.phone = on;
    ui.canvas.classList.toggle('is-phone', on);
    ui.pc.classList.toggle('is-on', !on);
    ui.ph.classList.toggle('is-on', on);
  }
  function logout() {
    if (S.dirty && !window.confirm('Есть несохранённые правки. Всё равно выйти?')) return;
    S.dirty = false;
    document.getElementById('logoutForm').submit();
  }
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
  window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  function refreshTop() {
    ui.save.disabled = !S.dirty;
    ui.save.querySelector('.lbl').textContent = S.dirty ? 'Сохранить' : 'Сохранено';
    ui.undo.disabled = !S.undo.length;
    const p = S.pages.find(x => x.path === S.page);
    ui.pageName.textContent = p ? p.title : '';
    document.title = (p ? p.title + ' · ' : '') + (S.sites.find(x => x.id === S.site) || {}).name + ' — админка';
    ui.view.href = SITE_BASE + (S.page === 'index.html' ? '' : (S.page || ''));
    ui.pages.querySelectorAll('a').forEach(a => {
      const on = a.dataset.path === S.page;
      a.classList.toggle('active', on);
      const dot = a.querySelector('.dot');
      if (on && S.dirty && !dot) a.append(h('span', { class: 'dot', title: 'Есть несохранённые правки' }));
      if ((!on || !S.dirty) && dot) dot.remove();
    });
  }
  function renderPages() {
    ui.pages.replaceChildren(h('h3', null, 'Страницы'));
    S.pages.forEach(p => ui.pages.append(h('a', {
      href: '#' + p.path, 'data-path': p.path,
      onclick: (e) => { e.preventDefault(); openPage(p.path); },
    }, p.title)));
    refreshTop();
  }

  // ---------------------------------------------------------------- страница → редактор
  const EDITOR_CSS = `
html{scroll-behavior:auto!important}
body.ed-mode .rv{opacity:1!important;transform:none!important}
body.ed-mode .ed-hover{outline:2px dashed rgba(107,44,192,.6)!important;outline-offset:2px;cursor:text}
body.ed-mode img.ed-hover,body.ed-mode .ed-hover-img{cursor:pointer!important;outline:3px dashed rgba(107,44,192,.7)!important;outline-offset:-3px}
body.ed-mode .ed-item{outline:2px dashed #3FA028!important;outline-offset:4px}
body.ed-mode .ed-sel{outline:3px solid #58CC3A!important;outline-offset:2px}
body.ed-mode .ed-editing{outline:3px solid #6b2cc0!important;outline-offset:3px;background:rgba(255,255,255,.55);cursor:text}
body.ed-mode [data-hide]{opacity:.35!important;outline:2px dashed #e0316b!important;outline-offset:2px}
body.ed-mode .program-card__full{display:block!important;border-top:2px dashed #c9b6ee;margin-top:12px;padding-top:10px}
body.ed-mode .program-card__full::before{content:"Текст в «Подробнее»";display:block;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#6b2cc0;margin-bottom:6px}
body.ed-mode a,body.ed-mode button,body.ed-mode [role=button]{cursor:default}
body.ed-mode .booking-widget,body.ed-mode .mbar{display:none!important}
body.ed-mode .menu-category{display:block!important;animation:none!important}
body.ed-mode .menu-category + .menu-category{margin-top:28px}
.ed-label{display:block;margin:6px 0 14px;padding:8px 14px;border-radius:12px;background:#F4F0FC;border:2px dashed #c9b6ee;color:#6b2cc0;font:800 13px/1.3 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em}
body.ed-mode .fst-stage{height:auto!important}
body.ed-mode .fst-track{position:static!important;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
body.ed-mode .fst-it{position:relative!important;left:auto!important;bottom:auto!important;transform:none!important;opacity:1!important;filter:none!important;visibility:visible!important;width:auto!important;height:auto!important;flex-direction:column;align-items:center;background:#fff!important;border-radius:18px!important;padding:10px!important;z-index:auto!important}
body.ed-mode .fst-it img{width:100%;height:130px;object-fit:contain}
body.ed-mode .fst-it::after{content:attr(data-name) " · " attr(data-p);display:block;margin-top:6px;font:700 12px/1.3 system-ui,sans-serif;color:#4a1185;text-align:center}
body.ed-mode .fst-ped,body.ed-mode .fst-arrow,body.ed-mode .fst-cap,body.ed-mode .fst-thumbs{display:none!important}
body.ed-mode .fst::before{content:"Фуршет: кликните по позиции, чтобы поменять название, описание, вес и цену (справа) или фото";display:block;margin-bottom:12px;font:700 13px/1.4 system-ui,sans-serif;color:#6b2cc0}
`;
  function toEditorHtml(src) {
    const d = new DOMParser().parseFromString(src, 'text/html');
    d.querySelectorAll('script').forEach(s => {
      if (s.hasAttribute('type')) s.setAttribute('data-ed-type', s.getAttribute('type'));
      s.setAttribute('type', 'text/x-ed-blocked');
    });
    const base = d.createElement('base');
    base.setAttribute('href', SITE_BASE);
    base.setAttribute('data-ed', '');
    d.head.prepend(base);
    const st = d.createElement('style');
    st.setAttribute('data-ed', '');
    st.textContent = EDITOR_CSS;
    d.head.append(st);
    d.body.classList.add('ed-mode');
    return '<!DOCTYPE html>\n' + d.documentElement.outerHTML;
  }

  async function openPage(path, opts) {
    opts = opts || {};
    if (S.loading) return;
    if (!opts.force && S.dirty && path !== S.page) {
      const r = await ask('Сохранить правки?', 'На странице «' + titleOf(S.page) + '» есть несохранённые правки.', [
        { label: 'Отмена', value: 'cancel' }, { label: 'Не сохранять', cls: 'btn--danger', value: 'drop' }, { label: 'Сохранить', cls: 'btn--green', value: 'save' }]);
      if (!r || r === 'cancel') return;
      if (r === 'save' && !(await save())) return;
    }
    S.loading = true;
    ui.loading.hidden = false;
    ui.loading.textContent = 'Загружаю страницу…';
    try {
      const d = opts.source != null ? { content: opts.source, sha: S.sha } : await api('file', { params: { page: path.replace(/\.html$/, '') } });
      S.page = path;
      S.sha = d.sha;
      S.crlf = /\r\n/.test(d.content);
      const dt = d.content.match(/^\s*(<!doctype[^>]*>)/i);
      S.doctype = dt ? dt[1] : '<!DOCTYPE html>';
      if (!opts.keepState) {
        S.undo = []; S.changes.clear(); S.uploads = [];
      }
      S.sel = null; S.editing = null; S.hover = null;
      await new Promise((res) => {
        ui.frame.onload = () => res();
        ui.frame.srcdoc = toEditorHtml(d.content);
      });
      S.doc = ui.frame.contentDocument;
      fixStickyOffsets(S.doc);
      addEditorLabels(S.doc);
      bindFrame(S.doc);
      if (!opts.keepState) { S.initial = S.doc.body.innerHTML; S.dirty = false; }
      else { S.dirty = true; }
      const hash = '#' + S.site + '/' + path;
      if (location.hash !== hash) history.replaceState(null, '', hash);
      renderSide();
      refreshTop();
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      S.loading = false;
      ui.loading.hidden = true;
    }
  }
  // на сайте высоту шапки выставляет main.js; в редакторе скрипты сайта не работают — считаем сами
  function fixStickyOffsets(doc) {
    const bar = doc.querySelector('.main-bar');
    const st = doc.querySelector('style[data-ed]');
    if (!bar || !st) return;
    const hgt = Math.round(bar.getBoundingClientRect().height);
    st.textContent += ':root{--header-h:' + hgt + 'px;--subnav-top:' + hgt + 'px}';
  }
  async function switchSite(id, pagePath) {
    const site = S.sites.find(x => x.id === id);
    if (!site) return;
    if (S.dirty && id !== S.site) {
      const r = await ask('Сохранить правки?', 'На странице «' + titleOf(S.page) + '» есть несохранённые правки.', [
        { label: 'Отмена', value: 'cancel' }, { label: 'Не сохранять', cls: 'btn--danger', value: 'drop' }, { label: 'Сохранить', cls: 'btn--green', value: 'save' }]);
      if (!r || r === 'cancel') { ui.city.value = S.site; return; }
      if (r === 'save' && !(await save())) { ui.city.value = S.site; return; }
    }
    S.dirty = false;
    S.site = id;
    ui.city.value = id;
    SITE_BASE = new URL(site.url, location.href).href;
    try { localStorage.setItem('jcadmin-site', id); } catch (e) { /* без запоминания */ }
    S.pages = [];
    renderPages();
    ui.loading.hidden = false;
    ui.loading.textContent = 'Загружаю страницы города…';
    try { S.pages = (await api('pages')).pages; } catch (e) { ui.loading.textContent = e.message; return; }
    renderPages();
    const first = S.pages.find(p => p.path === pagePath) || S.pages.find(p => p.path === 'index.html') || S.pages[0];
    if (first) await openPage(first.path, { force: true });
  }
  // подписи вкладок меню — только в редакторе (элементы с data-ed не сохраняются)
  function addEditorLabels(doc) {
    doc.querySelectorAll('[data-menu-category]').forEach(cat => {
      const id = cat.getAttribute('data-menu-category');
      const b = doc.querySelector('[data-menu-filter="' + CSS.escape(id) + '"]');
      const lab = doc.createElement('div');
      lab.setAttribute('data-ed', '');
      lab.className = 'ed-label';
      lab.setAttribute('data-cat', id);
      lab.textContent = 'Вкладка «' + (b ? b.textContent.trim() : id) + '»';
      cat.prepend(lab);
    });
  }
  // куда ведёт элемент: раздел этой же страницы или другая страница сайта
  function navTarget(el) {
    const tab = el.closest('[data-menu-filter]');
    if (tab) {
      const t = S.doc.querySelector('[data-menu-category="' + CSS.escape(tab.getAttribute('data-menu-filter')) + '"]');
      if (t) return { el: tab, scroll: t, label: tab.textContent.trim() };
    }
    const a = el.closest('a[href]');
    if (!a) return null;
    const href = a.getAttribute('href');
    if (href.startsWith('#') && href.length > 1) {
      const t = S.doc.getElementById(href.slice(1));
      if (t) return { el: a, scroll: t, label: a.textContent.trim() };
      return null;
    }
    const [file, hash] = href.split('#');
    const pg = S.pages.find(p => p.path === file);
    if (pg) return { el: a, page: pg.path, hash: hash || '', label: pg.title };
    return null;
  }
  function scrollToEl(t) {
    const bar = S.doc.querySelector('.main-bar');
    const sub = S.doc.querySelector('.subnav,.menu-filters');
    const off = (bar ? bar.offsetHeight : 0) + (sub ? sub.offsetHeight : 0) + 12;
    const y = t.getBoundingClientRect().top + S.doc.defaultView.scrollY - off;
    S.doc.defaultView.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
  async function goToPage(path, hash) {
    if (path === S.page) { const t = hash && S.doc.getElementById(hash); if (t) scrollToEl(t); return; }
    await openPage(path);
    if (hash && S.page === path) { const t = S.doc.getElementById(hash); if (t) setTimeout(() => scrollToEl(t), 50); }
  }
  // производные части страницы, которые на сайте строит скрипт: миниатюры фуршета, подписи калькулятора
  const fmtNum = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  function syncDerived() {
    S.doc.querySelectorAll('.ed-label[data-cat]').forEach(lab => {
      const b = S.doc.querySelector('[data-menu-filter="' + CSS.escape(lab.getAttribute('data-cat')) + '"]');
      if (b) lab.textContent = 'Вкладка «' + b.textContent.trim() + '»';
    });
    S.doc.querySelectorAll('[data-fst]').forEach(root => {
      const items = [...root.querySelectorAll('.fst-it')];
      items.forEach(it => {
        const n = it.getAttribute('data-name') || '';
        it.setAttribute('aria-label', n);
        const im = it.querySelector('img'); if (im) im.setAttribute('alt', n);
      });
      const thumbs = root.querySelector('.fst-thumbs');
      if (thumbs) {
        thumbs.replaceChildren(...items.map(it => {
          const b = S.doc.createElement('button');
          b.type = 'button'; b.className = 'fst-th'; b.setAttribute('aria-label', it.getAttribute('data-name') || '');
          const im = S.doc.createElement('img');
          const src = it.querySelector('img'); im.setAttribute('src', src ? src.getAttribute('src') : ''); im.setAttribute('alt', ''); im.setAttribute('loading', 'lazy');
          b.append(im); return b;
        }));
      }
      const first = items[0];
      const cap = root.querySelector('.fst-cap');
      if (first && cap) {
        const set = (sel, a) => { const x = cap.querySelector(sel); if (x) x.textContent = first.getAttribute(a) || ''; };
        set('.fst-name', 'data-name'); set('.fst-desc', 'data-desc'); set('.fst-w', 'data-w'); set('.fst-p', 'data-p');
      }
    });
    S.doc.querySelectorAll('.tk-ready[data-decor][aria-label]').forEach(t => {
      const al = t.getAttribute('aria-label');
      const nw = al.replace(/(декор )\d[\d\s\u00a0]*?(?= рубл| ?₽|$)/, '$1' + String(Math.round(Number(t.getAttribute('data-decor')) || 0)));
      if (nw !== al) t.setAttribute('aria-label', nw);
    });
    const c = calcData();
    if (c) {
      const d = c.data;
      S.doc.querySelectorAll('#calcFilling option').forEach(o => {
        const f = d.fillings && d.fillings[o.value];
        if (f) o.textContent = o.value + '. ' + f.name + ' — ' + fmtNum(f.price) + '\u00a0₽/кг';
      });
      S.doc.querySelectorAll('#calcReady option').forEach(o => {
        const r = d.ready && d.ready[o.value];
        if (r) o.textContent = o.textContent.replace(/декор [\d\s\u00a0]+₽/, 'декор ' + fmtNum(r.decor) + '\u00a0₽');
      });
    }
  }
  // правки в списке «Калькулятор торта» → карточки начинок и плитки готовых тортов
  function pushCalcToPage(d) {
    S.doc.querySelectorAll('.tk-fill').forEach(card => {
      const n = (card.querySelector('.tk-fill__num') || {}).textContent;
      const f = n && d.fillings && d.fillings[n.trim()];
      if (!f) return;
      const pr = card.querySelector('.tk-fill__price'); if (pr) pr.textContent = fmtNum(f.price) + '\u00a0₽/кг';
      const nm = card.querySelector('.tk-fill__name'); if (nm) nm.textContent = f.name;
    });
    S.doc.querySelectorAll('.tk-ready[data-num]').forEach(t => {
      const r = d.ready && d.ready[t.getAttribute('data-num')];
      if (!r) return;
      t.setAttribute('data-decor', String(r.decor));
    });
  }
  const titleOf = (p) => { const x = S.pages.find(q => q.path === p); return x ? x.title : p; };

  function serializeDoc(doc, crlf, doctype) {
    const root = doc.documentElement.cloneNode(true);
    root.querySelectorAll('[data-ed]').forEach(n => n.remove());
    root.querySelectorAll('[contenteditable]').forEach(n => { n.removeAttribute('contenteditable'); n.removeAttribute('spellcheck'); });
    root.querySelectorAll('[class]').forEach(n => {
      [...n.classList].filter(c => c.startsWith('ed-')).forEach(c => n.classList.remove(c));
      if (!n.getAttribute('class')) n.removeAttribute('class');
    });
    root.querySelectorAll('script[type="text/x-ed-blocked"]').forEach(s => {
      const t = s.getAttribute('data-ed-type');
      if (t) s.setAttribute('type', t); else s.removeAttribute('type');
      s.removeAttribute('data-ed-type');
    });
    root.querySelectorAll('[src^="blob:"]').forEach(n => { const p = S.pathByBlob.get(n.getAttribute('src')); if (p) n.setAttribute('src', p); });
    let html = (doctype || '<!DOCTYPE html>') + '\n' + root.outerHTML + '\n';
    html = html.replace(/\s*<\/body>\s*<\/html>\s*$/, '\n</body></html>\n');
    html = html.replace(/\r\n/g, '\n');
    if (crlf) html = html.replace(/\n/g, '\r\n');
    return html;
  }
  const serialize = () => serializeDoc(S.doc, S.crlf, S.doctype);

  // ---------------------------------------------------------------- правки
  function pushUndo() {
    S.undo.push(S.doc.body.innerHTML);
    if (S.undo.length > 60) S.undo.shift();
    refreshTop();
  }
  function markDirty(what) {
    if (what) S.changes.add(what);
    S.dirty = S.doc.body.innerHTML !== S.initial || S.changes.has('код страницы');
    refreshTop();
  }
  function undo() {
    if (!S.undo.length) return;
    finishEditing(true);
    S.doc.body.innerHTML = S.undo.pop();
    S.sel = null; S.hover = null;
    markDirty();
    renderSide();
  }

  const INLINE = new Set(['B', 'STRONG', 'EM', 'I', 'BR', 'SPAN', 'SMALL', 'SUP', 'SUB', 'A', 'S', 'U', 'MARK', 'ABBR', 'TIME']);
  const ATOMIC = new Set(['svg', 'img']);
  const NEVER = new Set(['HTML', 'HEAD', 'BODY', 'SCRIPT', 'STYLE', 'IFRAME', 'VIDEO', 'SELECT', 'INPUT', 'TEXTAREA', 'svg', 'path', 'TEMPLATE']);
  function inlineOnly(n) {
    for (const c of n.childNodes) {
      if (c.nodeType !== 1) continue;
      if (ATOMIC.has(c.localName)) continue;
      if (!INLINE.has(c.tagName) || !inlineOnly(c)) return false;
    }
    return true;
  }
  function qualifies(n) {
    if (n.nodeType !== 1 || NEVER.has(n.tagName) || NEVER.has(n.localName)) return false;
    if (!n.textContent.trim()) return false;
    return inlineOnly(n);
  }
  function textBlock(t) {
    let cand = null;
    for (let n = t; n && n !== S.doc.body; n = n.parentElement) {
      if (n.nodeType !== 1) continue;
      if (n.closest('svg') && n.localName !== 'svg') continue;
      if (qualifies(n)) {
        cand = n;
        if (S.doc.defaultView.getComputedStyle(n).display !== 'inline') break;
      } else if (cand) break;
    }
    return cand;
  }

  function bindFrame(doc) {
    doc.addEventListener('click', onFrameClick, true);
    doc.addEventListener('mouseover', onFrameHover, true);
    doc.addEventListener('mouseout', () => setHover(null), true);
    doc.addEventListener('keydown', onFrameKey, true);
    doc.addEventListener('paste', onFramePaste, true);
    doc.addEventListener('submit', (e) => e.preventDefault(), true);
    doc.addEventListener('dragstart', (e) => e.preventDefault(), true);
    doc.addEventListener('dragover', (e) => e.preventDefault(), true);
    doc.addEventListener('drop', (e) => { e.preventDefault(); toast('Чтобы поменять фото, кликните по нему и нажмите «Заменить фото»'); }, true);
    doc.addEventListener('auxclick', (e) => e.preventDefault(), true);
    doc.addEventListener('input', () => { if (S.editing) { S.dirty = true; refreshTop(); } });
  }
  function setHover(n) {
    if (S.hover === n) return;
    if (S.hover) S.hover.classList.remove('ed-hover');
    S.hover = n;
    if (n && n !== S.editing) n.classList.add('ed-hover');
  }
  function onFrameHover(e) {
    const t = e.target;
    if (S.editing && S.editing.contains(t)) return setHover(null);
    if (t.localName === 'img') return setHover(t);
    setHover(textBlock(t));
  }
  function onFrameClick(e) {
    const t = e.target;
    if (S.editing && S.editing.contains(t)) return; // ставим курсор внутри редактируемого текста
    e.preventDefault();
    e.stopPropagation();
    finishEditing();
    setHover(null);
    if (t.localName === 'img') { select(t); return; }
    const fst = t.closest('.fst-it');
    if (fst && fst.querySelector('img')) { select(fst.querySelector('img')); return; }
    const nav = navTarget(t);
    if (nav && nav.scroll) { scrollToEl(nav.scroll); select(nav.el); return; }
    // простая ссылка на другую страницу (пункт меню, кнопка) — выделяем, переход и правка названия кнопками справа
    if (nav && nav.page && !nav.el.querySelector('p,h1,h2,h3,h4,h5,div,li,img')) { select(nav.el); return; }
    const tb = textBlock(t);
    if (tb) { startEditing(tb, e.clientX, e.clientY); return; }
    select(t.nodeType === 1 ? t : t.parentElement);
  }
  function onFrameKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (!S.editing) {
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if (e.key === 'Escape') select(null);
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); finishEditing(); select(S.sel); return; }
    // в тексте внутри кнопки (вкладки меню) пробел иначе «нажимает» кнопку и не печатается
    if (e.key === ' ' && !mod && S.editing.closest('button')) { e.preventDefault(); S.doc.execCommand('insertText', false, ' '); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const multi = /^(P|LI|DIV|TD|BLOCKQUOTE|DD|FIGCAPTION)$/.test(S.editing.tagName);
      if (multi || e.shiftKey) S.doc.execCommand('insertLineBreak');
      else { finishEditing(); select(S.sel); }
    }
  }
  function onFramePaste(e) {
    if (!S.editing) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    S.doc.execCommand('insertText', false, text.replace(/\s*\n\s*/g, ' '));
  }

  function startEditing(block, x, y) {
    pushUndo();
    S.editing = block;
    S.editBefore = block.innerHTML;
    block.setAttribute('contenteditable', 'true');
    block.setAttribute('spellcheck', 'true');
    block.querySelectorAll('svg,img').forEach(n => n.setAttribute('contenteditable', 'false'));
    block.classList.add('ed-editing');
    block.focus({ preventScroll: true });
    const doc = S.doc;
    let range = null;
    if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(x, y);
    else if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(x, y); if (p) { range = doc.createRange(); range.setStart(p.offsetNode, p.offset); } }
    if (range && block.contains(range.startContainer)) {
      const sel = doc.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    }
    S.sel = block;
    markSelection();
    renderSide();
  }
  function cleanEdited(b) {
    b.querySelectorAll('div,p').forEach(d => { if (d !== b) { d.before(...d.childNodes); if (d.nextSibling) d.after(S.doc.createElement('br')); d.remove(); } });
    b.querySelectorAll('font').forEach(f => f.replaceWith(...f.childNodes));
    b.querySelectorAll('span[style]:not([class])').forEach(s => s.replaceWith(...s.childNodes));
    b.querySelectorAll('[style]').forEach(n => { if (!n.getAttribute('style').trim()) n.removeAttribute('style'); });
    b.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
    while (b.lastChild && b.lastChild.nodeName === 'BR' && b.childNodes.length > 1) b.lastChild.remove();
    // пробелы, которые браузер вставляет как неразрывные при наборе
    const walker = S.doc.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(t => {
      const v = t.nodeValue.replace(/\u00a0(?= )|(?<= )\u00a0/g, ' ').replace(/ {2,}/g, ' ');
      if (v !== t.nodeValue) t.nodeValue = v;
    });
    if (texts.length) {
      const first = texts[0], last = texts[texts.length - 1];
      first.nodeValue = first.nodeValue.replace(/^[ \u00a0]+(?=\S)/, '');
      last.nodeValue = last.nodeValue.replace(/(\S)[ \u00a0]+$/, '$1');
    }
  }
  function finishEditing(silent) {
    const b = S.editing;
    if (!b) return;
    S.editing = null;
    b.removeAttribute('contenteditable');
    b.removeAttribute('spellcheck');
    b.classList.remove('ed-editing');
    cleanEdited(b);
    if (b.innerHTML !== S.editBefore) {
      afterTextHooks(b);
      syncDerived();
      markDirty('текст');
    } else if (!silent) {
      S.undo.pop();
      refreshTop();
    }
    if (!silent) renderSide();
  }
  function calcData() {
    const sc = S.doc.querySelector('script#cakeCalc');
    if (!sc) return null;
    try { return { sc, data: JSON.parse(sc.textContent) }; } catch (e) { return null; }
  }
  function syncCalc(fn) {
    const c = calcData();
    if (!c) return;
    if (fn(c.data) !== false) c.sc.textContent = '\n' + JSON.stringify(c.data, null, 1) + '\n';
  }
  const num = (t) => Number(String(t).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
  function afterTextHooks(b) {
    const fill = b.closest('.tk-fill');
    if (fill) {
      const n = (fill.querySelector('.tk-fill__num') || {}).textContent;
      if (n) syncCalc(d => {
        const f = d.fillings && d.fillings[n.trim()];
        if (!f) return false;
        if (b.matches('.tk-fill__price')) f.price = num(b.textContent);
        else if (b.matches('.tk-fill__name')) f.name = b.textContent.replace(/\s+/g, ' ').trim();
        else return false;
      });
    }
    const tile = b.closest('.cake-tile');
    if (tile && b.matches('.cake-tile__label')) tile.setAttribute('data-name', b.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
    const card = b.closest('.program-card,.feature-card');
    if (card && b.matches('.program-card__title,.feature-card__title')) {
      const ph = card.querySelector('[data-video-full]');
      const title = b.textContent.replace(/\s+/g, ' ').trim();
      if (ph) {
        ph.setAttribute('data-video-title', title);
        const vb = ph.querySelector('.vplay');
        if (vb) vb.setAttribute('aria-label', 'Смотри как весело: ' + title);
      }
    }
  }

  function select(n) {
    if (S.editing && n !== S.editing) finishEditing(true);
    S.sel = n && n !== S.doc.body && n !== S.doc.documentElement ? n : null;
    markSelection();
    renderSide();
  }
  function markSelection() {
    S.doc.querySelectorAll('.ed-sel,.ed-item').forEach(x => x.classList.remove('ed-sel', 'ed-item'));
    if (!S.sel) return;
    if (S.sel !== S.editing) S.sel.classList.add('ed-sel');
    const chain = itemsChain(S.sel);
    if (chain[0] && chain[0] !== S.sel) chain[0].classList.add('ed-item');
  }

  // ---------------------------------------------------------------- карточки и блоки
  const KNOWN = {
    'program-card': 'Карточка программы', 'feature-card': 'Большая карточка', 'pkg-card': 'Пакет', 'cake-tile': 'Торт',
    'room-card': 'Комната', 'dish-card': 'Блюдо', 'hero-card': 'Герой', 'show-variant': 'Вариант', 'price-tier': 'Цена',
    'program-pkg': 'Программа', 'nav-card': 'Плитка навигации', 'nav-item': 'Пункт меню', 'addon-mini': 'Доп', 'meta-chip': 'Метка',
    'badge-pill': 'Плашка', 'extras-col': 'Колонка', 'journey-step': 'Шаг', 'callout': 'Плашка с текстом',
    'booking-day': 'День', 'fill-card': 'Начинка', 'filling-card': 'Начинка', 'tk-step': 'Шаг', 'pkg-card__price-row': 'Строка цены',
    'fst-it': 'Позиция фуршета', 'menu-category': 'Вкладка меню', 'menu-filter': 'Кнопка вкладки', 'tk-fill': 'Начинка', 'tk-ready': 'Готовый торт',
    'room-grid': null,
  };
  function keyOf(n) { return n.tagName + '.' + (n.classList[0] || ''); }
  function isItem(n) {
    if (!n || n.nodeType !== 1 || n === S.doc.body || n === S.doc.documentElement) return false;
    if (n.closest('[data-ed]') || n.closest('head')) return false;
    if (/^(LI|SECTION|P|TR|FIGURE|ARTICLE)$/.test(n.tagName)) return true;
    const c = n.classList[0];
    if (c && KNOWN[c]) return true;
    if (!c || !n.parentElement) return false;
    const k = keyOf(n);
    return [...n.parentElement.children].filter(x => keyOf(x) === k).length >= 2;
  }
  function itemsChain(n) {
    const out = [];
    for (let x = n; x && x !== S.doc.body; x = x.parentElement) {
      if (isItem(x)) out.push(x);
      if (out.length >= 3) break;
    }
    return out;
  }
  function headingOf(n) {
    const sec = n.closest('section');
    const hh = sec && sec.querySelector('h1,h2');
    return hh ? hh.textContent.trim().replace(/\s+/g, ' ') : '';
  }
  function itemLabel(n) {
    if (n.tagName === 'SECTION') { const t = headingOf(n); return t ? 'Раздел «' + t + '»' : 'Раздел страницы'; }
    if (n.tagName === 'LI') return 'Пункт списка';
    if (n.tagName === 'P') return 'Абзац';
    const c = n.classList[0];
    return (c && KNOWN[c]) || 'Блок';
  }
  function excerpt(n) {
    const t = n.querySelector('h1,h2,h3,h4,.program-card__title,.cake-tile__label,.pkg-card__name,.room-card__label,.dish-card__title');
    const s = (t ? t.textContent : n.textContent).trim().replace(/\s+/g, ' ');
    return s.length > 60 ? s.slice(0, 58) + '…' : s;
  }
  function act(fn, what) {
    finishEditing(true);
    pushUndo();
    fn();
    syncDerived();
    markDirty(what);
    markSelection();
    renderSide();
  }
  function toggleHide(n) {
    act(() => { if (n.hasAttribute('data-hide')) n.removeAttribute('data-hide'); else n.setAttribute('data-hide', ''); }, n.hasAttribute('data-hide') ? 'показан блок' : 'скрыт блок');
  }
  function duplicate(n) {
    act(() => {
      const c = n.cloneNode(true);
      c.removeAttribute('id');
      c.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
      c.classList.remove('ed-sel', 'ed-item');
      n.after(c);
      S.sel = c;
      c.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 'добавлен блок');
    toast('Копия добавлена сразу после — отредактируйте её');
  }
  async function remove(n) {
    if (!(await confirmBox('Удалить «' + (excerpt(n) || itemLabel(n)) + '»?', 'Если нужно убрать только на время — лучше нажмите «Скрыть», тогда блок можно будет вернуть одной кнопкой.', 'Удалить', true))) return;
    act(() => { const p = n.parentElement; n.remove(); S.sel = null; if (p) p.classList.remove('ed-item'); }, 'удалён блок');
  }
  function shift(n, dir) {
    const sib = dir < 0 ? n.previousElementSibling : n.nextElementSibling;
    if (!sib) return;
    act(() => { if (dir < 0) sib.before(n); else sib.after(n); n.scrollIntoView({ block: 'nearest' }); }, 'изменён порядок');
  }
  async function moveTo(n) {
    const k = keyOf(n);
    const conts = [...S.doc.querySelectorAll('body *')].filter(c =>
      c !== n.parentElement && !n.contains(c) && !c.closest('[data-ed]') && [...c.children].some(x => keyOf(x) === k));
    if (!conts.length) { toast('На этой странице больше некуда перенести такой блок'); return; }
    const box = h('div', { class: 'list-rows' });
    let m;
    conts.forEach(c => {
      const sec = headingOf(c) || 'Без заголовка';
      const cnt = [...c.children].filter(x => keyOf(x) === k).length;
      box.append(h('div', { class: 'row' },
        h('div', { class: 'row__main' }, h('div', { class: 'row__title' }, sec), h('div', { class: 'row__sub' }, 'Сейчас там: ' + cnt)),
        btn('Перенести сюда', { cls: 'btn--purple btn--sm', onClick: () => {
          m.close();
          act(() => { c.append(n); n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 'блок перенесён');
          toast('Перенесено в конец раздела «' + sec + '»');
        } })));
    });
    m = modal({ title: 'Куда перенести?', text: 'Блок окажется последним в выбранном разделе, потом его можно поднять кнопкой ↑.', body: box });
  }

  // блок верхнего уровня внутри раздела страницы — после него можно вставить новый
  function blockAnchor(n) {
    for (let x = n; x && x !== S.doc.body; x = x.parentElement) {
      const p = x.parentElement;
      if (!p) return null;
      if (p.classList.contains('container') && p.parentElement && p.parentElement.tagName === 'SECTION') return x;
      if (p.tagName === 'SECTION' && !x.classList.contains('container')) return x;
    }
    return null;
  }
  function insertBlock(anchor, kind) {
    let el;
    act(() => {
      if (kind === 'callout') {
        el = S.doc.createElement('div');
        el.className = 'callout';
        el.textContent = 'Новый текст — кликните и напишите свой';
      } else {
        el = S.doc.createElement('div');
        el.className = 'category-intro';
        const p = S.doc.createElement('p');
        p.textContent = 'Новый текст — кликните и напишите свой';
        el.append(p);
      }
      const ws = anchor.previousSibling && anchor.previousSibling.nodeType === 3 && /^\s+$/.test(anchor.previousSibling.data) ? anchor.previousSibling.data.replace(/^[^\n]*\n/, '\n') : '\n';
      anchor.after(S.doc.createTextNode(ws), el);
    }, 'добавлен блок');
    const target = el.querySelector('p') || el;
    target.scrollIntoView({ block: 'center' });
    const r = target.getBoundingClientRect();
    startEditing(target, r.left + 4, r.top + r.height / 2);
    const sel = S.doc.getSelection(); const range = S.doc.createRange(); range.selectNodeContents(target); sel.removeAllRanges(); sel.addRange(range);
    toast('Блок добавлен — напишите текст. Курсив: Ctrl+I, жирный: Ctrl+B');
  }

  // ---------------------------------------------------------------- свойства
  const ATTR_LABELS = {
    href: 'Ссылка', alt: 'Описание фото (для поиска)', 'data-price': 'Цена (в окне с фото)', 'data-name': 'Название для поиска',
    'data-vk': 'Ссылка на альбом ВКонтакте', 'data-slug': 'Код торта (для доп. фото)', 'data-gallery': 'Код галереи фото',
    'data-video-title': 'Название видео', 'data-img': 'Большое фото', 'data-num': 'Номер',
    'data-desc': 'Описание', 'data-w': 'Вес', 'data-p': 'Цена', 'data-decor': 'Цена декора, ₽ (число)', 'data-theme': 'Категория (код: thematic, cartoon…)',
  };
  const ATTR_SKIP = /^(data-hide|data-ed.*|data-video-full|data-toggle-card|data-flyout.*|data-admin.*|data-menu-.*|data-fst.*|data-tab.*)$/;
  function attrFields(n) {
    const out = [];
    const names = [...n.attributes].map(a => a.name).filter(a => (a.startsWith('data-') && !ATTR_SKIP.test(a)) || (a === 'href' && n.tagName === 'A'));
    names.forEach(a => {
      let snap = false;
      const inp = h('input', { value: n.getAttribute(a) });
      inp.addEventListener('focus', () => { snap = false; });
      inp.addEventListener('input', () => {
        if (!snap) { pushUndo(); snap = true; }
        n.setAttribute(a, inp.value);
        if (a === 'data-decor' && n.matches('.tk-ready[data-num]')) syncCalc(d => { const r = d.ready && d.ready[n.getAttribute('data-num')]; if (!r) return false; r.decor = num(inp.value); });
        syncDerived();
        markDirty('свойства');
      });
      const lab = (a === 'data-name' && n.matches('.fst-it')) ? 'Название' : (ATTR_LABELS[a] || a);
      out.push(h('label', { class: 'field' }, lab, inp));
    });
    return out;
  }

  // ---------------------------------------------------------------- фото и видео
  function uploadDir() { return 'assets/uploads/' + slug(S.page.replace('.html', '')); }
  async function replaceImage(img) {
    const [file] = await pickFiles('image/*');
    if (!file) return;
    const pm = progressModal('Загружаю фото…');
    try {
      const { blob, ext } = await processImage(file);
      const card = img.closest('.program-card,.feature-card,.cake-tile,.pkg-card,.room-card,.dish-card,section');
      const base = slug((card && excerpt(card)) || img.alt || file.name.replace(/\.\w+$/, ''));
      const path = uploadDir() + '/' + base + '-' + stamp() + '.' + ext;
      const r = await uploadFile(blob, path, pm.set);
      const url = URL.createObjectURL(blob);
      S.uploads.push({ path: r.path, sha: r.sha });
      S.pathByBlob.set(url, r.path); S.blobByPath.set(r.path, url);
      act(() => { img.setAttribute('src', url); img.removeAttribute('srcset'); }, 'заменено фото');
      toast('Фото заменено — не забудьте сохранить', 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { pm.close(); }
  }
  async function setVideo(ph) {
    const [file] = await pickFiles('video/mp4');
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { toast('Видео больше 30 МБ — сожмите его (например, в приложении «Сжатие видео») и попробуйте снова', 'err', 9000); return; }
    const pm = progressModal('Загружаю видео…');
    try {
      const card = ph.closest('.program-card,.feature-card') || ph;
      const titleEl = card.querySelector('.program-card__title,.feature-card__title,h3');
      const title = titleEl ? titleEl.textContent.trim() : '';
      const path = 'assets/uploads/video/' + slug(title || file.name.replace(/\.\w+$/, '')) + '-' + stamp() + '.mp4';
      const r = await uploadFile(file, path, pm.set);
      S.uploads.push({ path: r.path, sha: r.sha });
      act(() => {
        ph.setAttribute('data-video-full', r.path);
        ph.setAttribute('data-video-title', title);
        ph.classList.add('program-card__photo--vid');
        if (!ph.querySelector('.vplay')) {
          ph.insertAdjacentHTML('beforeend', '<button class="vplay" type="button" aria-label="Смотри как весело: ' + title.replace(/"/g, '&quot;') + '"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Смотри как весело</span></button>');
        }
      }, 'видео');
      toast('Видео добавлено — не забудьте сохранить', 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { pm.close(); }
  }
  function removeVideo(ph) {
    act(() => {
      ph.removeAttribute('data-video-full'); ph.removeAttribute('data-video-title');
      ph.classList.remove('program-card__photo--vid');
      const b = ph.querySelector('.vplay'); if (b) b.remove();
    }, 'убрано видео');
  }

  // ---------------------------------------------------------------- правая панель
  function renderSide() {
    const s = ui.side;
    s.replaceChildren();
    if (!S.doc) return;
    const n = S.sel;
    if (!n) return renderHelp();

    if (S.editing) {
      s.append(h('div', { class: 'panel' },
        h('p', { class: 'panel__title' }, 'Редактирование текста'),
        h('p', { class: 'hint' }, 'Печатайте прямо на странице. Выделите слово и нажмите Ctrl+B (на Mac ⌘+B) — жирный, Ctrl+I — курсив. Enter в абзаце — новая строка, в заголовке — завершить правку.'),
        btn('Готово', { cls: 'btn--purple btn--sm', onClick: () => { finishEditing(); select(S.sel); } })));
    }

    if (n.localName === 'img') {
      const alt = h('input', { value: n.getAttribute('alt') || '' });
      let snap = false;
      alt.addEventListener('input', () => { if (!snap) { pushUndo(); snap = true; } n.setAttribute('alt', alt.value); markDirty('подпись фото'); });
      s.append(h('div', { class: 'panel' },
        h('p', { class: 'panel__title' }, 'Фото'),
        h('img', { class: 'thumb', src: n.currentSrc || n.src, alt: '' }),
        h('div', { class: 'btn-row' }, btn('Заменить фото', { icon: 'photo', cls: 'btn--purple', onClick: () => replaceImage(n) })),
        h('p', { class: 'hint', style: 'margin-top:10px' }, 'Лучше всего подходят фото на белом или прозрачном фоне. Большие фото уменьшатся автоматически.'),
        n.closest('.fst-it') ? null : h('label', { class: 'field' }, ATTR_LABELS.alt, alt)));
    }

    const nv = navTarget(n);
    if (nv && (!S.editing || nv.page)) {
      const tb = textBlock(nv.el);
      s.append(h('div', { class: 'panel' },
        h('p', { class: 'panel__title' }, nv.page ? 'Ссылка на страницу «' + nv.label + '»' : 'Переход к разделу «' + nv.label + '»'),
        h('div', { class: 'btn-row' },
          nv.page ? btn('Открыть в редакторе', { cls: 'btn--purple btn--sm', onClick: () => goToPage(nv.page, nv.hash) })
                  : btn('Перейти', { cls: 'btn--purple btn--sm', onClick: () => scrollToEl(nv.scroll) }),
          tb && !S.editing ? btn('Изменить название', { cls: 'btn--sm', onClick: () => { const r = tb.getBoundingClientRect(); startEditing(tb, r.left + r.width - 2, r.top + r.height / 2); } }) : null)));
    }
    const ph = n.closest('[data-video-full], .program-card__photo, .feature-card__photo');
    if (ph) {
      const v = ph.getAttribute('data-video-full');
      s.append(h('div', { class: 'panel' },
        h('p', { class: 'panel__title' }, 'Видео «Смотри как весело»'),
        v ? h('div', { class: 'vid-note' }, 'Сейчас: ', h('a', { href: SITE_BASE + v, target: '_blank', rel: 'noopener' }, v.split('/').pop())) : h('p', { class: 'hint' }, 'У этой карточки нет видео.'),
        h('div', { class: 'btn-row' },
          btn(v ? 'Заменить видео' : 'Добавить видео', { icon: 'video', onClick: () => setVideo(ph) }),
          v ? btn('Убрать', { cls: 'btn--danger', onClick: () => removeVideo(ph) }) : null),
        h('p', { class: 'hint', style: 'margin-top:8px' }, 'Формат MP4, до 30 МБ.')));
    }

    const link = n.closest('a[href]');
    if (link && !itemsChain(n).includes(link)) {
      s.append(h('div', { class: 'panel' }, h('p', { class: 'panel__title' }, 'Ссылка'), ...attrFields(link)));
    }

    const chain = itemsChain(n);
    if (!chain.length && n.localName !== 'img' && !S.editing) {
      s.append(h('p', { class: 'hint' }, 'Этот элемент нельзя изменить здесь. Кликните на текст, фото или карточку.'));
    }
    chain.forEach((it, i) => {
      const hidden = it.hasAttribute('data-hide');
      const title = h('p', { class: 'panel__title' }, itemLabel(it), hidden ? h('span', { class: 'panel__tag' }, 'скрыто') : null);
      const isCardLike = i === 0 || /card|tile|pkg|item|variant|tier|step|mini|col/.test(it.className) || it.tagName === 'SECTION';
      const p = h('div', { class: 'panel' }, title, h('p', { class: 'panel__sub' }, excerpt(it)),
        h('div', { class: 'btn-row' },
          btn(hidden ? 'Показать' : 'Скрыть', { icon: hidden ? 'eye' : 'eyeOff', cls: 'btn--sm' + (hidden ? ' btn--green' : ''), onClick: () => toggleHide(it) }),
          btn('Дублировать', { icon: 'copy', cls: 'btn--sm', onClick: () => duplicate(it) }),
          btn('', { icon: 'up', cls: 'btn--sm', title: 'Выше', onClick: () => shift(it, -1), disabled: !it.previousElementSibling }),
          btn('', { icon: 'down', cls: 'btn--sm', title: 'Ниже', onClick: () => shift(it, 1), disabled: !it.nextElementSibling }),
          isCardLike && it.tagName !== 'SECTION' ? btn('', { icon: 'move', cls: 'btn--sm', title: 'Перенести в другой раздел', onClick: () => moveTo(it) }) : null,
          btn('', { icon: 'trash', cls: 'btn--sm btn--danger', title: 'Удалить', onClick: () => remove(it) })),
      );
      const af = attrFields(it);
      if (af.length) p.append(h('div', { style: 'margin-top:12px' }, ...af));
      p.addEventListener('mouseenter', () => it.classList.add('ed-item'));
      p.addEventListener('mouseleave', () => { if (i !== 0 || it === S.sel) it.classList.remove('ed-item'); markSelection(); });
      s.append(p);
    });
    if (!S.editing && n.localName !== 'img') {
      const af = attrFields(n).filter(() => !chain.includes(n));
      if (af.length) s.append(h('div', { class: 'panel' }, h('p', { class: 'panel__title' }, 'Свойства'), ...af));
    }
    const anchor = blockAnchor(n);
    if (anchor && !S.editing) {
      s.append(h('div', { class: 'panel' },
        h('p', { class: 'panel__title' }, 'Добавить под этим блоком'),
        h('div', { class: 'btn-row' },
          btn('Плашка с текстом', { cls: 'btn--sm', onClick: () => insertBlock(anchor, 'callout') }),
          btn('Абзац текста', { cls: 'btn--sm', onClick: () => insertBlock(anchor, 'text') }))));
    }
    s.append(btn('Снять выделение', { cls: 'btn--ghost btn--sm', onClick: () => { finishEditing(); select(null); } }));
    renderLists(s);
  }

  function renderLists(s) {
    const lists = [...S.doc.querySelectorAll('script[data-admin]')];
    if (!lists.length) return;
    s.append(h('h4', null, 'Списки на этой странице'));
    lists.forEach(sc => s.append(h('div', { style: 'margin-bottom:8px' }, btn(sc.getAttribute('data-admin'), { icon: 'list', cls: 'btn--purple btn--block', onClick: () => { finishEditing(); openList(sc); } }))));
  }
  function renderHelp() {
    const s = ui.side;
    const hiddenOnPage = [...S.doc.querySelectorAll('body [data-hide]')].filter(x => !x.closest('nav,.nav,.quick-nav,footer'));
    s.append(h('h2', null, 'Как редактировать'),
      h('ul', { class: 'help' },
        h('li', null, h('b', null, 'Текст и цены'), ' — кликните и печатайте прямо на странице.'),
        h('li', null, h('b', null, 'Фото'), ' — кликните по фото → «Заменить фото».'),
        h('li', null, h('b', null, 'Карточка'), ' — кликните по пустому месту карточки: появятся кнопки скрыть, дублировать, удалить, переставить.'),
        h('li', null, h('b', null, 'Новая программа'), ' — «Дублировать» похожую карточку и поменять в копии текст и фото.'),
        h('li', null, h('b', null, 'Подробное описание'), ' программ показано под пунктирной линией в карточке.'),
        h('li', null, h('b', null, 'Новый текст или плашка'), ' — выделите блок, под которым он нужен, и нажмите «Добавить под этим блоком».'),
        h('li', null, h('b', null, 'Вкладки и ссылки'), ' — клик переносит к нужному разделу; название меняется кнопкой справа.'),
        h('li', null, 'Когда всё готово — зелёная кнопка ', h('b', null, '«Сохранить»'), '. Через 1–2 минуты изменения появятся на сайте.')));
    renderLists(s);
    if (hiddenOnPage.length) {
      s.append(h('h4', null, 'Скрыто на этой странице: ' + hiddenOnPage.length));
      hiddenOnPage.slice(0, 30).forEach(x => s.append(h('div', { style: 'margin-bottom:6px' }, btn(itemLabel(x) + ': ' + (excerpt(x) || '—'), { cls: 'btn--sm btn--block', onClick: () => { x.scrollIntoView({ block: 'center', behavior: 'smooth' }); select(x); } }))));
    }
    s.append(h('h4', null, 'Если что-то пошло не так'),
      h('p', { class: 'hint' }, '«Отменить» — шаг назад до сохранения. «История» — вернуть любую сохранённую правку как было.'));
  }

  // ---------------------------------------------------------------- списки (JSON)
  function thumbUrl(path) {
    if (!path) return '';
    return S.blobByPath.get(path) || (/^(https?:|blob:|data:)/.test(path) ? path : SITE_BASE + path);
  }
  async function uploadImages(files, dir, onEach) {
    const pm = progressModal(files.length > 1 ? 'Загружаю фото (' + files.length + ')…' : 'Загружаю фото…');
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const { blob, ext } = await processImage(f);
        const path = dir + '/' + slug(f.name.replace(/\.\w+$/, '')) + '-' + stamp() + '.' + ext;
        const r = await uploadFile(blob, path, (p) => pm.set((i + p) / files.length));
        S.uploads.push({ path: r.path, sha: r.sha });
        const url = URL.createObjectURL(blob);
        S.blobByPath.set(r.path, url); S.pathByBlob.set(url, r.path);
        onEach(r.path, i);
      }
    } catch (e) { toast(e.message, 'err'); } finally { pm.close(); }
  }
  function openList(sc) {
    let data, schema;
    try { data = JSON.parse(sc.textContent); schema = JSON.parse(sc.getAttribute('data-admin-schema')); } catch (e) { toast('Список повреждён — его можно поправить через «Код»', 'err'); return; }
    const body = h('div');
    let m;
    let changed = false;
    const rerender = () => { changed = true; body.replaceChildren(renderNode(schema, data, rerender, null)); };
    body.addEventListener('input', () => { changed = true; });
    body.addEventListener('change', () => { changed = true; });
    body.replaceChildren(renderNode(schema, data, rerender, null));
    m = modal({
      title: sc.getAttribute('data-admin'), wide: true, body, confirmClose: () => changed,
      buttons: [{ label: 'Отмена' }, { label: 'Применить', cls: 'btn--green', onClick: () => {
        if (schema.type === 'groups' && schema.of && schema.of.type === 'list') for (const k of Object.keys(data)) if (!data[k].length) delete data[k];
        act(() => { sc.textContent = '\n' + JSON.stringify(data, null, 1) + '\n'; if (sc.id === 'cakeCalc') pushCalcToPage(data); }, 'список «' + sc.getAttribute('data-admin') + '»');
        toast('Изменения в списке применены — не забудьте сохранить', 'ok');
      } }],
    });
  }
  function fieldInput(fs, obj, key, root) {
    if (fs.type === 'number') {
      return h('label', { class: 'field' }, fs.label || key, h('input', { type: 'number', step: 'any', inputmode: 'decimal', value: obj[key] == null ? '' : obj[key],
        oninput: (e) => { const v = e.target.value.replace(',', '.'); obj[key] = v === '' ? 0 : Number(v); } }));
    }
    if (fs.type === 'bool') {
      return h('label', { class: 'field field--check' }, h('input', { type: 'checkbox', checked: obj[key] ? true : null, onchange: (e) => { obj[key] = e.target.checked; } }), fs.label || key);
    }
    if (fs.type === 'select') {
      const opts = (root && root[fs.options]) || [];
      const sel = h('select', { onchange: (e) => { obj[key] = e.target.value; } });
      opts.filter(o => !(fs.skip || []).includes(o[fs.optionValue])).forEach(o => sel.append(h('option', { value: o[fs.optionValue], selected: o[fs.optionValue] === obj[key] || null }, o[fs.optionLabel])));
      return h('label', { class: 'field' }, fs.label || key, sel);
    }
    return h('label', { class: 'field' }, fs.label || key, h('input', { value: obj[key] == null ? '' : obj[key], oninput: (e) => { obj[key] = e.target.value; } }));
  }
  function moveIdx(arr, i, d, rerender) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; rerender(); }
  function imgTile(path, onReplace) {
    return h('div', { class: 'ds-img' + (path ? '' : ' ds-img--empty'), title: 'Заменить фото', onclick: onReplace },
      path ? h('img', { src: thumbUrl(path), alt: '', loading: 'lazy' }) : 'Нет фото', path ? h('span', null, 'Заменить') : null);
  }
  function renderNode(sch, val, rerender, root) {
    root = root || val;
    const wrap = h('div');
    if (sch.hint) wrap.append(h('p', { class: 'ds-hint' }, sch.hint));
    if (sch.type === 'object') {
      for (const k in sch.fields) {
        const fs = sch.fields[k];
        if (fs.type === 'list' || fs.type === 'imagelist' || fs.type === 'object' || fs.type === 'groups') {
          const det = h('details', { class: 'ds-group', open: true }, h('summary', null, fs.label || k, Array.isArray(val[k]) ? h('span', { class: 'count' }, val[k].length + ' шт.') : null));
          if (val[k] == null) val[k] = fs.type === 'list' || fs.type === 'imagelist' ? [] : {};
          det.append(h('div', { class: 'ds-body' }, renderNode(fs, val[k], rerender, root)));
          wrap.append(det);
        } else wrap.append(fieldInput(fs, val, k, root));
      }
    } else if (sch.type === 'list') {
      const grid = h('div', { class: 'ds-grid' });
      const imgKey = Object.keys(sch.fields).find(k => sch.fields[k].type === 'image');
      val.forEach((item, i) => {
        const card = h('div', { class: 'ds-item' });
        if (imgKey) card.append(imgTile(item[imgKey], async () => {
          const files = await pickFiles('image/*');
          if (files.length) await uploadImages(files.slice(0, 1), sch.fields[imgKey].dir, (p) => { item[imgKey] = p; rerender(); });
        }));
        for (const k in sch.fields) if (k !== imgKey) card.append(fieldInput(sch.fields[k], item, k, root));
        card.append(h('div', { class: 'ds-tools' },
          btn('', { icon: 'left', cls: 'btn--sm', title: 'Раньше', onClick: () => moveIdx(val, i, -1, rerender) }),
          btn('', { icon: 'right', cls: 'btn--sm', title: 'Позже', onClick: () => moveIdx(val, i, 1, rerender) }),
          btn('', { icon: 'trash', cls: 'btn--sm btn--danger', title: 'Убрать', onClick: () => { val.splice(i, 1); rerender(); } })));
        grid.append(card);
      });
      const blank = () => { const o = {}; for (const k in sch.fields) { const fs = sch.fields[k]; o[k] = fs.type === 'select' ? (((root[fs.options] || []).find(x => !(fs.skip || []).includes(x[fs.optionValue])) || {})[fs.optionValue] || '') : ''; } return o; };
      grid.append(h('div', { class: 'ds-add', onclick: async () => {
        if (imgKey) {
          const files = await pickFiles('image/*', true);
          if (files.length) await uploadImages(files, sch.fields[imgKey].dir, (p) => { const o = blank(); o[imgKey] = p; val.push(o); });
          rerender();
        } else { val.push(blank()); rerender(); }
      } }, imgKey ? '+ Добавить фото' : '+ Добавить'));
      wrap.append(grid);
    } else if (sch.type === 'imagelist') {
      const grid = h('div', { class: 'ds-grid' });
      val.forEach((p, i) => {
        grid.append(h('div', { class: 'ds-item' },
          imgTile(p, async () => {
            const files = await pickFiles('image/*');
            if (files.length) await uploadImages(files.slice(0, 1), sch.dir, (np) => { val[i] = np; rerender(); });
          }),
          h('div', { class: 'ds-tools' },
            btn('', { icon: 'left', cls: 'btn--sm', onClick: () => moveIdx(val, i, -1, rerender) }),
            btn('', { icon: 'right', cls: 'btn--sm', onClick: () => moveIdx(val, i, 1, rerender) }),
            btn('', { icon: 'trash', cls: 'btn--sm btn--danger', onClick: () => { val.splice(i, 1); rerender(); } }))));
      });
      grid.append(h('div', { class: 'ds-add', onclick: async () => {
        const files = await pickFiles('image/*', true);
        if (files.length) await uploadImages(files, sch.dir, (np) => val.push(np));
        rerender();
      } }, '+ Добавить фото'));
      wrap.append(grid);
    } else if (sch.type === 'groups') {
      const label = (k, v) => {
        if (sch.groupLabel && sch.groupLabel.selector) {
          const q = S.doc.querySelector(sch.groupLabel.selector.replace('{key}', CSS.escape(k)));
          if (q) return q.textContent.trim();
        }
        if (sch.groupLabel && sch.groupLabel.field && v && v[sch.groupLabel.field]) return v[sch.groupLabel.field];
        if (sch.groupLabel && sch.groupLabel.template) return sch.groupLabel.template.replace('{key}', k);
        return k;
      };
      Object.keys(val).forEach(k => {
        const v = val[k];
        const cnt = Array.isArray(v) ? v.length : (v && Array.isArray(v.photos) ? v.photos.length : null);
        const det = h('details', { class: 'ds-group' }, h('summary', null, label(k, v), cnt != null ? h('span', { class: 'count' }, cnt + ' фото') : null,
          sch.removable ? btn('', { icon: 'trash', cls: 'btn--sm btn--danger', title: 'Удалить', onClick: (e) => { e.preventDefault(); delete val[k]; rerender(); } }) : null));
        if (S.openGroups && S.openGroups.has(k)) det.open = true;
        det.addEventListener('toggle', () => { S.openGroups = S.openGroups || new Set(); if (det.open) S.openGroups.add(k); else S.openGroups.delete(k); });
        det.append(h('div', { class: 'ds-body' }, renderNode(sch.of, v, rerender, root)));
        wrap.append(det);
      });
      const af = sch.addFrom || (sch.groupLabel && sch.groupLabel.selector && sch.of.type === 'list' ? { selector: '[data-slug]', attr: 'data-slug', title: 'Добавить доп. фото к другому торту', empty: [] } : null);
      if (af) {
        const tiles = [...new Set([...S.doc.querySelectorAll(af.selector)].map(t => t.getAttribute(af.attr)))].filter(s => s && !(s in val));
        if (tiles.length) {
          const sel = h('select', null, h('option', { value: '' }, '— выберите —'), ...tiles.map(sl => h('option', { value: sl }, label(sl))));
          wrap.append(h('div', { class: 'panel', style: 'margin-top:12px' },
            h('p', { class: 'panel__title' }, af.title || 'Добавить'),
            af.hint ? h('p', { class: 'hint' }, af.hint) : null,
            h('div', { class: 'btn-row' }, sel, btn('Добавить', { cls: 'btn--purple btn--sm', onClick: () => {
              if (!sel.value) return;
              val[sel.value] = JSON.parse(JSON.stringify(af.empty !== undefined ? af.empty : []));
              S.openGroups = S.openGroups || new Set(); S.openGroups.add(sel.value);
              rerender();
            } }))));
        }
      }
    }
    return wrap;
  }

  // ---------------------------------------------------------------- сохранение
  let saving = false;
  async function save() {
    finishEditing(true);
    if (!S.dirty || saving) return !S.dirty;
    saving = true;
    ui.save.disabled = true;
    ui.save.querySelector('.lbl').textContent = 'Сохраняю…';
    try {
      const html = serialize();
      const uploads = S.uploads.filter(u => html.includes(u.path));
      const what = [...S.changes].slice(0, 6).join(', ') || 'правка';
      const r = await api('save', { body: { files: [{ path: S.page, content: html, base: S.sha }], uploads, message: titleOf(S.page) + ': ' + what } });
      S.sha = r.shas[S.page];
      S.initial = S.doc.body.innerHTML;
      S.dirty = false;
      S.changes.clear();
      S.uploads = S.uploads.filter(u => !uploads.includes(u));
      toast('Сохранено! Публикуем на сайте…', 'ok');
      trackDeploy(r.commit);
      return true;
    } catch (e) {
      if (e.status === 409) {
        const r = await ask('Страницу уже изменили', e.message, [{ label: 'Оставить как есть', value: false }, { label: 'Загрузить свежую версию', cls: 'btn--danger', value: true }]);
        if (r) { S.dirty = false; await openPage(S.page, { force: true }); }
      } else if (e.status !== 401) {
        toast('Не сохранилось: ' + e.message, 'err', 9000);
      }
      return false;
    } finally {
      saving = false;
      refreshTop();
    }
  }
  let deployTimer = null;
  function trackDeploy(sha) {
    clearTimeout(deployTimer);
    const started = Date.now();
    const site = S.site;
    ui.deploy.hidden = false;
    ui.deploy.replaceChildren(h('span', { class: 'spin' }), 'Публикуется на сайте…');
    const tick = async () => {
      let st = { state: 'running' };
      try { st = await api('status', { params: { sha, site } }); } catch (e) { /* повторим */ }
      if (st.state === 'done') {
        ui.deploy.replaceChildren('✓ На сайте');
        toast('Изменения уже на сайте', 'ok');
        deployTimer = setTimeout(() => { ui.deploy.hidden = true; }, 20000);
        return;
      }
      if (st.state === 'unknown') {
        ui.deploy.replaceChildren('Сохранено — на сайте через 1–2 мин');
        deployTimer = setTimeout(() => { ui.deploy.hidden = true; }, 60000);
        return;
      }
      if (st.state === 'failed') {
        ui.deploy.replaceChildren('⚠ Не опубликовалось');
        modal({ title: 'Сохранилось, но не опубликовалось', text: 'Правка сохранена, но выкладка на сайт завершилась ошибкой. Напишите разработчику — ничего не потеряно.', buttons: [{ label: 'Понятно' }] });
        return;
      }
      if (Date.now() - started > 8 * 60000) { ui.deploy.replaceChildren('Публикация идёт дольше обычного'); return; }
      deployTimer = setTimeout(tick, 6000);
    };
    deployTimer = setTimeout(tick, 5000);
  }

  // ---------------------------------------------------------------- разделы сайта
  async function openSections() {
    if (S.dirty) {
      const ok = await ask('Сначала сохраните', 'На текущей странице есть несохранённые правки. Сохранить их?', [{ label: 'Отмена', value: false }, { label: 'Сохранить', cls: 'btn--green', value: true }]);
      if (!ok || !(await save())) return;
    }
    const pm = modal({ title: 'Разделы сайта', text: 'Загружаю страницы…' });
    let docs;
    try {
      docs = await Promise.all(S.pages.map(async p => {
        const d = await api('file', { params: { page: p.path.replace(/\.html$/, '') } });
        return { path: p.path, sha: d.sha, src: d.content, doc: new DOMParser().parseFromString(d.content, 'text/html') };
      }));
    } catch (e) { pm.close(); toast(e.message, 'err'); return; }
    pm.close();
    const containersFor = (doc, target) => [...doc.querySelectorAll('a[href]')]
      .filter(a => a.getAttribute('href').split('#')[0] === target)
      .map(a => a.closest('.nav-item') || a.closest('.nav-card-slot') || a);
    const state = {};
    const rows = h('div', { class: 'list-rows' });
    S.pages.filter(p => p.path !== 'index.html').forEach(p => {
      const all = docs.flatMap(d => d.path === p.path ? [] : containersFor(d.doc, p.path));
      const shown = all.length ? !all.every(c => c.hasAttribute('data-hide')) : true;
      state[p.path] = { was: shown, now: shown, links: all.length };
      const inp = h('input', { type: 'checkbox', checked: shown || null, onchange: (e) => { state[p.path].now = e.target.checked; } });
      rows.append(h('div', { class: 'row' },
        h('div', { class: 'row__main' }, h('div', { class: 'row__title' }, p.title), h('div', { class: 'row__sub' }, all.length ? 'Ссылок на раздел: ' + all.length : 'На раздел нет ссылок в меню')),
        h('label', { class: 'switch', title: 'Показывать на сайте' }, inp, h('span'))));
    });
    modal({
      title: 'Разделы сайта',
      text: 'Выключенный раздел пропадает из меню, из блока «Куда дальше?» и из подвала на всех страницах, а поисковики перестают его показывать. Сама страница и всё её содержимое сохраняются — раздел можно включить обратно в любой момент.',
      body: rows,
      buttons: [{ label: 'Отмена' }, { label: 'Сохранить', cls: 'btn--green', onClick: () => { applySections(docs, state, containersFor); } }],
    });
  }
  async function applySections(docs, state, containersFor) {
    const changed = Object.keys(state).filter(k => state[k].was !== state[k].now);
    if (!changed.length) return;
    const touched = new Set();
    changed.forEach(target => {
      const show = state[target].now;
      docs.forEach(d => {
        if (d.path === target) {
          let meta = d.doc.querySelector('meta[name="robots"]');
          if (!show && !meta) {
            meta = d.doc.createElement('meta'); meta.setAttribute('name', 'robots'); meta.setAttribute('content', 'noindex, nofollow');
            const cs = d.doc.querySelector('meta[charset]');
            if (cs) cs.after(meta); else d.doc.head.prepend(meta);
            touched.add(d);
          } else if (show && meta && /noindex/.test(meta.getAttribute('content') || '')) { meta.remove(); touched.add(d); }
        }
        containersFor(d.doc, target).forEach(c => {
          if (show && c.hasAttribute('data-hide')) { c.removeAttribute('data-hide'); touched.add(d); }
          if (!show && !c.hasAttribute('data-hide')) { c.setAttribute('data-hide', ''); touched.add(d); }
        });
      });
    });
    const files = [...touched].map(d => {
      const dt = d.src.match(/^\s*(<!doctype[^>]*>)/i);
      return { path: d.path, base: d.sha, content: serializeDoc(d.doc, /\r\n/.test(d.src), dt ? dt[1] : null) };
    });
    const names = changed.map(k => (state[k].now ? 'показан ' : 'скрыт ') + '«' + titleOf(k) + '»').join(', ');
    try {
      const r = await api('save', { body: { files, uploads: [], message: 'Разделы сайта: ' + names } });
      toast('Готово: ' + names, 'ok');
      trackDeploy(r.commit);
      S.dirty = false;
      await openPage(S.page, { force: true });
    } catch (e) { if (e.status !== 401) toast('Не сохранилось: ' + e.message, 'err', 9000); }
  }

  // ---------------------------------------------------------------- история
  async function openHistory() {
    const rows = h('div', { class: 'list-rows' }, h('p', { class: 'hint' }, 'Загружаю…'));
    modal({ title: 'История правок', text: 'Последние 30 сохранений сайта.', body: rows, wide: true });
    let items;
    try { items = (await api('history')).items; } catch (e) { rows.replaceChildren(h('p', { class: 'hint' }, e.message)); return; }
    rows.replaceChildren();
    const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    items.forEach(it => {
      const m = it.message.match(/^Админка \(([^)]+)\): ([\s\S]*)$/);
      const who = m ? m[1] : (it.author || 'разработчик');
      const what = (m ? m[2] : it.message).split('\n')[0];
      rows.append(h('div', { class: 'row' },
        h('div', { class: 'row__main' }, h('div', { class: 'row__title' }, what), h('div', { class: 'row__sub' }, fmt.format(new Date(it.date)) + ' · ' + who)),
        it.merge ? h('span', { class: 'hint' }, 'служебная') : btn('Вернуть как было', { cls: 'btn--sm', onClick: (e) => revert(it, what, e.currentTarget) })));
    });
  }
  let reverting = false;
  async function revert(it, what, button) {
    if (reverting) return;
    if (S.dirty) { toast('Сначала сохраните или отмените текущие правки', 'err'); return; }
    if (!(await confirmBox('Вернуть как было до этой правки?', '«' + what + '» — всё, что изменилось в этой правке, вернётся к прежнему виду.', 'Вернуть'))) return;
    reverting = true;
    if (button) button.disabled = true;
    try {
      const r = await api('revert', { body: { sha: it.sha } });
      document.querySelectorAll('.modal').forEach(x => x.remove());
      toast('Готово, правка отменена', 'ok');
      trackDeploy(r.commit);
      await openPage(S.page, { force: true });
    } catch (e) { if (e.status !== 401) toast(e.message, 'err', 9000); if (button) button.disabled = false; }
    finally { reverting = false; }
  }

  // ---------------------------------------------------------------- код
  function openCode() {
    finishEditing(true);
    const ta = h('textarea', { class: 'code', spellcheck: 'false' });
    ta.value = serialize();
    const start = ta.value;
    modal({
      title: 'Код страницы «' + titleOf(S.page) + '»', wide: true, confirmClose: () => ta.value !== start,
      text: 'Для разработчика. Ошибка в коде может сломать страницу — если сомневаетесь, закройте это окно.',
      body: ta,
      buttons: [{ label: 'Закрыть' }, { label: 'Применить', cls: 'btn--purple', onClick: () => {
        if (ta.value === start) return;
        if (!/<html[\s>]/i.test(ta.value) || !/<\/html>/i.test(ta.value)) { toast('В коде нет <html>…</html> — не применено', 'err'); return false; }
        pushUndo();
        S.changes.add('код страницы');
        openPage(S.page, { source: ta.value, keepState: true });
      } }],
    });
  }

  // ---------------------------------------------------------------- клавиатура и старт
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    if (mod && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.querySelector('.modal')) { e.preventDefault(); undo(); }
  });

  (async function init() {
    try {
      S.sites = (await api('sites')).sites;
    } catch (e) { ui.loading.textContent = e.message; return; }
    ui.city.replaceChildren(...S.sites.map(x => h('option', { value: x.id }, x.name)));
    ui.city.hidden = S.sites.length < 2;
    const m = decodeURIComponent(location.hash.slice(1)).match(/^([\w-]+)\/(.+)$/);
    let saved = null;
    try { saved = localStorage.getItem('jcadmin-site'); } catch (e) { /* */ }
    const site = (m && S.sites.find(x => x.id === m[1])) || S.sites.find(x => x.id === saved) || S.sites[0];
    await switchSite(site.id, m ? m[2] : null);
  })();
})();
