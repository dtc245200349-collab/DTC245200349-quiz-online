'use strict';
const menu = document.querySelector('.mobile-menu');
menu?.addEventListener('click', () => {
  const open = document.querySelector('#sidebar').classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});
document.querySelector('.sidebar-close')?.addEventListener('click', () => {
  document.querySelector('#sidebar').classList.remove('open');
  menu?.setAttribute('aria-expanded', 'false');
  menu?.focus();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.querySelector('#sidebar')?.classList.contains('open')) {
    document.querySelector('.sidebar-close')?.click();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('#sidebar, .mobile-menu')) {
    document.querySelector('#sidebar')?.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
  }
});
document.querySelectorAll('form[data-confirm]').forEach(form => form.addEventListener('submit', event => {
  if (!window.confirm(form.dataset.confirm)) event.preventDefault();
}));
document.querySelector('[data-back]')?.addEventListener('click', () => history.back());
const filter = document.querySelector('#question-filter');
filter?.addEventListener('input', () => {
  const query = filter.value.toLocaleLowerCase('vi').trim();
  document.querySelectorAll('[data-search]').forEach(row => { row.hidden = !row.dataset.search.includes(query); });
});
const pickerInputs = document.querySelectorAll('input[name="question_ids"]');
pickerInputs.forEach(input => input.addEventListener('change', () => {
  document.querySelector('#selection-count').textContent = `Đã chọn ${[...pickerInputs].filter(i => i.checked).length} câu`;
}));
