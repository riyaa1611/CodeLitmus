// Quiz webview client-side logic
const vscode = acquireVsCodeApi();

let questions = [];
let currentIndex = 0;
let selectedLabel = null;
let answered = false;

const loading = document.getElementById('loading');
const quizContainer = document.getElementById('quiz-container');
const summaryEl = document.getElementById('summary');
const progressLabel = document.getElementById('progress-label');
const progressFill = document.getElementById('progress-fill');
const questionText = document.getElementById('question-text');
const codeRef = document.getElementById('code-ref');
const optionsEl = document.getElementById('options');
const submitBtn = document.getElementById('submit-btn');
const resultEl = document.getElementById('result');
const resultIcon = document.getElementById('result-icon');
const resultText = document.getElementById('result-text');
const explanationEl = document.getElementById('explanation');
const dangerNote = document.getElementById('danger-note');
const nextBtn = document.getElementById('next-btn');
const finalScore = document.getElementById('final-score');
const summaryLabel = document.getElementById('summary-label');
const viewReportBtn = document.getElementById('view-report-btn');
const quizAgainBtn = document.getElementById('quiz-again-btn');

function setRobotMood(mood) {
  const robot = document.getElementById('robot-buddy');
  if (!robot) return;
  robot.classList.remove('robot-happy', 'robot-sad');
  const smile = document.getElementById('robot-smile');
  const frown = document.getElementById('robot-frown');
  const browL = document.getElementById('robot-brow-l');
  const browR = document.getElementById('robot-brow-r');
  const show = el => el && (el.style.display = '');
  const hide = el => el && (el.style.display = 'none');
  if (mood === 'happy') {
    robot.classList.add('robot-happy');
    show(smile); hide(frown); hide(browL); hide(browR);
  } else if (mood === 'sad') {
    robot.classList.add('robot-sad');
    hide(smile); show(frown); show(browL); show(browR);
  } else {
    show(smile); hide(frown); hide(browL); hide(browR);
  }
}

function showQuestion(q, index, total) {
  loading.style.display = 'none';
  quizContainer.style.display = 'block';
  summaryEl.style.display = 'none';
  answered = false;
  selectedLabel = null;
  resultEl.style.display = 'none';
  resultEl.className = '';
  setRobotMood('neutral');

  progressLabel.textContent = `Question ${index + 1} of ${total}`;
  const pct = ((index) / total) * 100;
  progressFill.style.width = pct + '%';
  progressFill.style.background = pct < 40
    ? 'var(--vscode-charts-red)' : pct < 70
    ? 'var(--vscode-charts-yellow)' : 'var(--vscode-charts-green)';

  questionText.textContent = q.question;
  codeRef.textContent = q.codeReference
    ? `${q.codeReference.file} (lines ${q.codeReference.startLine}–${q.codeReference.endLine})`
    : '';

  optionsEl.innerHTML = '';
  for (const opt of q.options) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<span class="option-label">${opt.label}.</span>${opt.text}`;
    card.addEventListener('click', () => {
      if (answered) return;
      selectedLabel = opt.label;
      document.querySelectorAll('#options .card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      submitBtn.disabled = false;
    });
    optionsEl.appendChild(card);
  }
  submitBtn.disabled = true;
}

function showResult(data) {
  answered = true;
  resultEl.style.display = 'block';
  resultEl.className = data.isCorrect ? 'correct' : 'wrong';
  resultIcon.innerHTML = data.isCorrect
    ? '<svg width="22" height="22" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#89d185" opacity="0.2"/><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#89d185" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg width="22" height="22" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#f14c4c" opacity="0.2"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#f14c4c" stroke-width="1.5" stroke-linecap="round"/></svg>';
  setRobotMood(data.isCorrect ? 'happy' : 'sad');
  resultText.textContent = data.isCorrect ? 'Correct!' : 'Incorrect';
  explanationEl.textContent = data.feedback || '';

  if (data.dangerNote) {
    dangerNote.style.display = 'block';
    dangerNote.textContent = data.dangerNote;
  } else {
    dangerNote.style.display = 'none';
  }

  // mark selected card
  document.querySelectorAll('#options .card').forEach((card, i) => {
    const opt = questions[currentIndex].options[i];
    if (opt.isCorrect) card.classList.add('correct');
    else if (opt.label === selectedLabel && !data.isCorrect) card.classList.add('wrong');
  });

  submitBtn.style.display = 'none';
}

submitBtn.addEventListener('click', () => {
  if (!selectedLabel) return;
  submitBtn.disabled = true;
  vscode.postMessage({ type: 'submitAnswer', data: { questionId: questions[currentIndex].id, selectedLabel } });
});

nextBtn.addEventListener('click', () => {
  currentIndex++;
  if (currentIndex >= questions.length) {
    vscode.postMessage({ type: 'quizComplete' });
  } else {
    submitBtn.style.display = '';
    showQuestion(questions[currentIndex], currentIndex, questions.length);
  }
});

viewReportBtn.addEventListener('click', () => vscode.postMessage({ type: 'openFile', data: { command: 'vibeaudit.showReport' } }));
quizAgainBtn.addEventListener('click', () => vscode.postMessage({ type: 'startQuiz', data: {} }));

window.addEventListener('message', e => {
  const msg = e.data;
  if (msg.type === 'startQuiz') {
    questions = msg.data.questions;
    currentIndex = 0;
    showQuestion(questions[0], 0, questions.length);
  } else if (msg.type === 'showResult') {
    showResult(msg.data);
  } else if (msg.type === 'showSummary') {
    quizContainer.style.display = 'none';
    summaryEl.style.display = 'block';
    const score = msg.data.score;
    finalScore.textContent = score + '%';
    finalScore.className = 'score-big ' + (score >= 80 ? 'score-deep' : score >= 60 ? 'score-solid' : score >= 30 ? 'score-partial' : 'score-critical');
    const correct = msg.data.correct;
    const total = msg.data.total;
    summaryLabel.textContent = `${correct} of ${total} questions correct`;
  }
});
