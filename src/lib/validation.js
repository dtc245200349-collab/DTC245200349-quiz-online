class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function text(value, label, min = 1, max = 1000) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    throw new HttpError(400, `${label} phải có từ ${min} đến ${max} ký tự.`);
  return value.trim();
}
function integer(value, label = 'Mã', min = 1, max = 2147483647) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max)
    throw new HttpError(400, `${label} không hợp lệ (${min}–${max}).`);
  return Number(value);
}
function email(value) {
  const result = text(value, 'Email', 5, 190).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new HttpError(400, 'Email không hợp lệ.');
  return result;
}
function password(value) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72)
    throw new HttpError(400, 'Mật khẩu cần ít nhất 8 ký tự và không quá 72 byte UTF-8.');
  return value;
}
function option(value) {
  if (!['A', 'B', 'C', 'D'].includes(value)) throw new HttpError(400, 'Phương án phải là A, B, C hoặc D.');
  return value;
}
function question(body) {
  return {
    content: text(body.content, 'Câu hỏi', 5, 5000),
    option_a: text(body.option_a, 'Phương án A'), option_b: text(body.option_b, 'Phương án B'),
    option_c: text(body.option_c, 'Phương án C'), option_d: text(body.option_d, 'Phương án D'),
    correct_option: option(body.correct_option), explanation: text(body.explanation || '', 'Giải thích', 0, 5000),
    category: text(body.category, 'Chủ đề', 1, 100)
  };
}
function exam(body) {
  const raw = body.question_ids === undefined ? [] : (Array.isArray(body.question_ids) ? body.question_ids : [body.question_ids]);
  if (raw.length > 100) throw new HttpError(400, 'Đề thi tối đa 100 câu.');
  const ids = [...new Set(raw.map(v => integer(v, 'Mã câu hỏi')))];
  const count = integer(body.question_count, 'Số câu hỏi', 1, 100);
  if (ids.length !== count) throw new HttpError(400, `Cần chọn đúng ${count} câu hỏi (đang chọn ${ids.length}).`);
  return { title: text(body.title, 'Tên đề thi', 3, 200), description: text(body.description || '', 'Mô tả', 0, 5000),
    duration_minutes: integer(body.duration_minutes, 'Thời gian', 1, 180), question_count: count,
    is_published: body.is_published === '1' ? 1 : 0, ids };
}
function selections(value, allowedIds) {
  if (value === undefined) return [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Dữ liệu bài làm không hợp lệ.');
  return Object.entries(value).map(([id, choice]) => {
    // A non-numeric prefix keeps HTML form parsers from compacting answer IDs into arrays.
    const answerId = integer(id.startsWith('a_') ? id.slice(2) : id, 'Mã câu trả lời');
    if (!allowedIds.has(answerId)) throw new HttpError(400, 'Câu trả lời không thuộc bài thi này.');
    return { id: answerId, option: option(choice) };
  });
}
module.exports = { HttpError, text, integer, email, password, option, question, exam, selections };
