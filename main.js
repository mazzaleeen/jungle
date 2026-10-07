const toTop = document.getElementById('toTop');
if (toTop) {
  window.addEventListener('scroll', () => toTop.classList.toggle('visible', window.scrollY > 400));
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
let closeNav = () => {};
if (burger && nav) {
  // шапка уезжает через transform — выносим панель в body, чтобы position:fixed работал от окна
  document.body.appendChild(nav);
  const backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';
  document.body.appendChild(backdrop);

  function openNav() {
    nav.classList.add('open');
    backdrop.classList.add('open');
    document.documentElement.classList.add('nav-open');
    burger.setAttribute('aria-expanded', 'true');
    const first = nav.querySelector('.nav-close');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 50);
  }
  closeNav = function () {
    if (!nav.classList.contains('open')) return;
    nav.classList.remove('open');
    backdrop.classList.remove('open');
    document.documentElement.classList.remove('nav-open');
    burger.setAttribute('aria-expanded', 'false');
  };
  burger.addEventListener('click', (e) => {
    e.stopPropagation();
    nav.classList.contains('open') ? closeNav() : openNav();
  });
  backdrop.addEventListener('click', closeNav);
  const closeBtn = document.getElementById('navClose');
  if (closeBtn) closeBtn.addEventListener('click', closeNav);
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });
  // если текущий раздел — анимации, сразу раскрываем его подпункты
  const animTrigger = nav.querySelector('.nav-btn.active[data-flyout-trigger]');
  if (animTrigger) {
    const panel = nav.querySelector('[data-flyout="' + animTrigger.getAttribute('data-flyout-trigger') + '"]');
    if (panel) {
      panel.dataset.keepOpen = '1';
      // после общей инициализации выпадашек (она выставляет aria-expanded=false)
      setTimeout(() => { panel.classList.add('open'); animTrigger.setAttribute('aria-expanded', 'true'); }, 0);
      // по нажатию пользователь снова управляет сам — можно свернуть
      animTrigger.addEventListener('pointerdown', () => { delete panel.dataset.keepOpen; }, { once: true });
    }
  }
}

const flyoutTriggers = document.querySelectorAll('[data-flyout-trigger]');
const allFlyouts = document.querySelectorAll('[data-flyout]');

function closeAllFlyouts(except) {
  allFlyouts.forEach(f => {
    if (f !== except && !f.dataset.keepOpen) f.classList.remove('open');
  });
  flyoutTriggers.forEach(t => {
    if (t !== except) t.setAttribute('aria-expanded', 'false');
  });
}

flyoutTriggers.forEach(trigger => {
  const id = trigger.getAttribute('data-flyout-trigger');
  const panel = document.querySelector(`[data-flyout="${id}"]`);
  if (!panel) return;

  trigger.setAttribute('aria-expanded', 'false');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = panel.classList.contains('open');
    closeAllFlyouts();
    if (!isOpen) {
      panel.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    } else {
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  panel.addEventListener('click', (e) => e.stopPropagation());
});

document.addEventListener('click', () => closeAllFlyouts());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllFlyouts();
});

(function () {
  const header = document.querySelector('.main-bar');
  if (!header) return;
  const subnav = document.querySelector('.subnav');

  function setHeaderHeight() {
    const h = header.offsetHeight;
    document.documentElement.style.setProperty('--header-h', h + 'px');
    document.documentElement.style.setProperty('--subnav-top', (header.classList.contains('header--hidden') ? 0 : h) + 'px');
  }

  function setHidden(hidden) {
    header.classList.toggle('header--hidden', hidden);
    const h = header.offsetHeight;
    document.documentElement.style.setProperty('--subnav-top', (hidden ? 0 : h) + 'px');
  }

  setHeaderHeight();
  window.addEventListener('resize', setHeaderHeight);

  const TOP_THRESHOLD = 60;
  let lastY = window.scrollY;
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    if (nav && nav.classList.contains('open')) { lastY = y; ticking = false; return; }
    if (y <= TOP_THRESHOLD) {
      setHidden(false);
    } else if (y > lastY + 4) {
      setHidden(true);
      closeNav();
    } else if (y < lastY - 4) {
      setHidden(false);
    }
    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
})();

/* ===== Плавное появление блоков при прокрутке ===== */
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const SEL = [
    '.category h2', '.category-intro', '.qn-title', '.nav-grid .nav-card', '.nav-card-slot',
    '.program-card', '.dish-card', '.hero-card', '.cake-tile', '.room-card', '.pkg-card', '.program-pkg',
    '.extras-col', '.show-variant', '.price-tier',
    '.fillings-group', '.dish-textblock', '.party-step', '.booking-calendar', '.journey--hero', '.journey-row__mascot'
  ].join(',');
  const els = [...document.querySelectorAll(SEL)].filter(el => !el.closest('#nav, .pm, .lightbox, .gallery-lightbox, .cake-lightbox'));
  const inScroller = el => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && a.scrollWidth > a.clientWidth + 4) return true;
    }
    return false;
  };
  const uniq = els.filter(el => !els.some(o => o !== el && o.contains(el)) && !inScroller(el));
  const done = el => {
    el.classList.remove('rv', 'rv-in');
    el.style.removeProperty('--rv-d');
  };
  const pending = new Set();
  function reveal(el, i) {
      if (!pending.has(el)) return;
      pending.delete(el);
      io.unobserve(el);
      el.style.setProperty('--rv-d', Math.min(i, 6) * 70 + 'ms');
      el.classList.add('rv-in');
      el.addEventListener('transitionend', function te(ev) {
        if (ev.target !== el || ev.propertyName !== 'transform') return;
        el.removeEventListener('transitionend', te);
        done(el);
      });
      setTimeout(() => done(el), 1400);
  }
  const io = new IntersectionObserver(entries => {
    let i = 0;
    entries.forEach(e => { if (e.isIntersecting) reveal(e.target, i++); });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  // подстраховка при очень быстрой прокрутке: всё, что уже выше низа экрана, показываем сразу
  let tmr = null;
  window.addEventListener('scroll', () => {
    clearTimeout(tmr);
    tmr = setTimeout(() => {
      let i = 0;
      pending.forEach(el => { const r = el.getBoundingClientRect(); if (r.height && r.top < innerHeight) reveal(el, i++); });
    }, 150);
  }, { passive: true });
  uniq.forEach(el => { el.classList.add('rv'); pending.add(el); io.observe(el); });
})();

/* ===== Нижняя панель (телефон): кнопка «Наверх» ===== */
(function () {
  const up = document.querySelector('.mbar__up');
  if (up) up.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();
