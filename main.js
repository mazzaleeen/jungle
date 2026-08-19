/* ===== Кнопка "наверх" ===== */
const toTop = document.getElementById('toTop');
if (toTop) {
  window.addEventListener('scroll', () => toTop.classList.toggle('visible', window.scrollY > 400));
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ===== Бургер-меню (мобилка) ===== */
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
if (burger && nav) {
  burger.addEventListener('click', () => nav.classList.toggle('open'));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
}

/* ===== Выпадающие меню категорий (flyout) =====
   Разметка триггера: <button data-flyout-trigger="ID">
   Разметка панели:   <div data-flyout="ID">
   Работает для любого количества пар триггер/панель на странице. */
const flyoutTriggers = document.querySelectorAll('[data-flyout-trigger]');
const allFlyouts = document.querySelectorAll('[data-flyout]');

function closeAllFlyouts(except) {
  allFlyouts.forEach(f => {
    if (f !== except) f.classList.remove('open');
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

/* ===== Умная фиолетовая полоса: прячется при скролле вниз, появляется при скролле вверх =====
   Зелёная полоса с расписанием остаётся обычной (уходит вместе со страницей) —
   а кнопка-бургер в фиолетовой полосе всегда рядом, не нужно скроллить наверх. */
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

  const TOP_THRESHOLD = 60; // у самого верха страницы полоса всегда видна
  let lastY = window.scrollY;
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    if (y <= TOP_THRESHOLD) {
      setHidden(false);
    } else if (y > lastY + 4) {
      setHidden(true);
      if (nav) nav.classList.remove('open');
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
