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
