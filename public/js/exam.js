'use strict';
(() => {
  const form = document.querySelector('#exam-form');
  if (!form) return;
  const csrf = form.querySelector('[name="_csrf"]').value;
  const countdown = document.querySelector('#countdown');
  const saveStatus = document.querySelector('#save-status');
  const deadline = new Date(form.dataset.expiresAt).getTime();
  const serverStart = new Date(form.dataset.serverNow).getTime();
  const clientStart = performance.now();
  let saving = false, dirty = false, submitting = false, ended = false;
  let revision = 0;
  const remainingMs = () => deadline - (serverStart + performance.now() - clientStart);
  function currentAnswers() {
    const answers = {};
    form.querySelectorAll('input[type="radio"]:checked').forEach(input => {
      answers[input.name.match(/\[a_(\d+)\]/)[1]] = input.value;
    });
    return answers;
  }
  function progress() {
    const answers = currentAnswers();
    const count = Object.keys(answers).length;
    const total = form.querySelectorAll('fieldset').length;
    document.querySelector('#answered-count').textContent = `Đã chọn ${count}/${total} câu`;
    document.querySelector('#answer-progress').value = count;
    document.querySelectorAll('[data-question-nav]').forEach(link => link.classList.toggle('answered', Boolean(answers[link.dataset.questionNav])));
    return count;
  }
  async function save() {
    if (saving || !dirty || submitting || ended) return;
    saving = true;
    const sentRevision = revision;
    saveStatus.textContent = 'Đang lưu đáp án…';
    saveStatus.classList.remove('failed');
    try {
      const response = await fetch(`/attempts/${form.dataset.attemptId}/save`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ answers: currentAnswers() }), signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể lưu.');
      if (!data.saved) { ended = true; location.assign(data.redirect); return; }
      dirty = sentRevision !== revision;
      saveStatus.textContent = dirty ? 'Đang lưu thay đổi mới…' : 'Đã lưu tất cả đáp án.';
    } catch {
      dirty = true;
      saveStatus.textContent = 'Chưa lưu được. Kiểm tra kết nối; hệ thống sẽ thử lại.';
      saveStatus.classList.add('failed');
    } finally { saving = false; }
    if (dirty && sentRevision !== revision) void save();
  }
  form.addEventListener('change', event => {
    if (event.target.type !== 'radio') return;
    revision++; dirty = true; progress(); void save();
  });
  form.addEventListener('submit', event => {
    if (submitting || ended) { event.preventDefault(); return; }
    const count = progress(), total = form.querySelectorAll('fieldset').length;
    if (!confirm(`Bạn đã chọn ${count}/${total} câu. Xác nhận nộp bài?`)) { event.preventDefault(); return; }
    submitting = true;
    document.querySelector('#submit-exam').disabled = true;
    // Normal POST contains the entire current selection, even if autosave failed.
  });
  async function finishExpired() {
    if (ended || submitting) return;
    ended = true;
    form.querySelectorAll('input[type="radio"]').forEach(input => { input.disabled = true; });
    document.querySelector('#submit-exam').disabled = true;
    saveStatus.textContent = 'Đã hết giờ. Đang mở kết quả…';
    // GET resolves expiry on the server; late client answers are never accepted.
    location.assign(`/attempts/${form.dataset.attemptId}/result`);
  }
  function tick() {
    const seconds = Math.max(0, Math.ceil(remainingMs() / 1000));
    countdown.textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
    countdown.classList.toggle('urgent', seconds <= 60);
    if (!seconds) void finishExpired();
  }
  window.addEventListener('beforeunload', event => {
    if (dirty && !submitting && !ended) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('online', () => void save());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); void save(); } });
  progress(); tick();
  setInterval(tick, 500);
  setInterval(() => void save(), 4000);
})();
