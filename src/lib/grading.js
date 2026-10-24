function grade(answers) {
  if (!Array.isArray(answers) || answers.length === 0) throw new Error('Bài thi không có câu hỏi.');
  const correctCount = answers.filter(a => a.selected_option && a.selected_option === a.correct_option).length;
  return { correctCount, total: answers.length, score: Math.round(correctCount * 1000 / answers.length) / 100 };
}
module.exports = { grade };
