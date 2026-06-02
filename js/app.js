/**
 * app.js — 主程式：課題選擇、適性練習流程、進度、AI 老師
 */
import { TOPICS, TOPIC_BY_ID } from './topics.js';
import { generateQuestion, gradeAnswer, askTutor, hasKey } from './ai.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------- 進度（localStorage） ----------
const PROG_KEY = 'p5math_progress';
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROG_KEY)) || {}; } catch { return {}; }
}
function saveProgress(p) { localStorage.setItem(PROG_KEY, JSON.stringify(p)); }
function topicProgress(id) {
  const p = loadProgress();
  return p[id] || { difficulty: 2, attempted: 0, correct: 0, streak: 0 };
}
function setTopicProgress(id, tp) {
  const p = loadProgress();
  p[id] = tp;
  saveProgress(p);
}

// ---------- 狀態 ----------
let current = { topic: null, question: null, answered: false };

// ---------- 畫面切換 ----------
function show(view) {
  $$('.view').forEach((v) => v.classList.remove('active'));
  $(`#view-${view}`).classList.add('active');
  window.scrollTo(0, 0);
}

// ---------- 首頁：課題卡 ----------
function renderHome() {
  const grid = $('#topic-grid');
  grid.innerHTML = '';
  TOPICS.forEach((t) => {
    const tp = topicProgress(t.id);
    const rate = tp.attempted ? Math.round((tp.correct / tp.attempted) * 100) : 0;
    const card = document.createElement('button');
    card.className = 'topic-card';
    card.innerHTML = `
      <div class="tc-icon">${t.icon}</div>
      <div class="tc-body">
        <div class="tc-name">${t.name}</div>
        <div class="tc-blurb">${t.blurb}</div>
        <div class="tc-meta">
          <span class="badge">難度 Lv.${tp.difficulty}</span>
          <span class="badge">已答 ${tp.attempted} ・ 正確率 ${rate}%</span>
        </div>
      </div>
      <div class="tc-go">開始 →</div>`;
    card.addEventListener('click', () => startTopic(t.id));
    grid.appendChild(card);
  });
}

// ---------- 開始一個課題 ----------
async function startTopic(id) {
  current.topic = TOPIC_BY_ID[id];
  $('#practice-title').textContent = `${current.topic.icon} ${current.topic.name}`;
  $('#tutor-topic').textContent = current.topic.name;
  show('practice');
  await nextQuestion();
}

// ---------- 出下一題 ----------
async function nextQuestion() {
  const t = current.topic;
  const tp = topicProgress(t.id);
  current.question = null;
  current.answered = false;

  $('#q-feedback').innerHTML = '';
  $('#q-feedback').className = 'feedback';
  $('#answer-area').innerHTML = '';
  $('#hint-box').innerHTML = '';
  $('#next-btn').classList.add('hidden');
  $('#submit-btn').classList.remove('hidden');
  $('#q-difficulty').textContent = `難度 Lv.${tp.difficulty}`;
  $('#q-text').innerHTML = '<span class="loading">正在請 AI 老師出題…</span>';

  try {
    const q = await generateQuestion(t, tp.difficulty);
    current.question = q;
    $('#q-text').textContent = q.question;
    renderAnswerInput(t, q);
  } catch (e) {
    $('#q-text').innerHTML = `<span class="error">出題失敗：${e.message}</span>`;
    $('#submit-btn').classList.add('hidden');
    $('#next-btn').classList.remove('hidden');
  }
}

function renderAnswerInput(t, q) {
  const area = $('#answer-area');
  if (t.answerType === 'mc') {
    const choices = q.choices && q.choices.length ? q.choices : t.choices;
    area.innerHTML = choices
      .map((c) => `<label class="choice"><input type="radio" name="ans" value="${c}"><span>${c}</span></label>`)
      .join('');
  } else {
    area.innerHTML =
      '<input id="ans-input" class="text-input" type="text" autocomplete="off" placeholder="輸入答案，例如 3/4 或 12 克" />';
    const input = $('#ans-input');
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !current.answered) submitAnswer();
    });
  }
}

function getStudentAnswer(t) {
  if (t.answerType === 'mc') {
    const sel = $('input[name="ans"]:checked');
    return sel ? sel.value : '';
  }
  return ($('#ans-input')?.value || '').trim();
}

// ---------- 批改 ----------
async function submitAnswer() {
  if (current.answered || !current.question) return;
  const t = current.topic;
  const ans = getStudentAnswer(t);
  if (!ans) { flashHint('請先作答喔！'); return; }

  $('#submit-btn').disabled = true;
  $('#submit-btn').textContent = '批改中…';

  try {
    const r = await gradeAnswer(t, current.question, ans);
    current.answered = true;
    applyResult(t, r);
  } catch (e) {
    flashHint(`批改失敗：${e.message}`);
  } finally {
    $('#submit-btn').disabled = false;
    $('#submit-btn').textContent = '提交答案';
  }
}

// ---------- 套用結果＋適性調整難度 ----------
function applyResult(t, r) {
  const tp = topicProgress(t.id);
  tp.attempted += 1;
  if (r.correct) {
    tp.correct += 1;
    tp.streak += 1;
    // 連對兩題就升難度（上限 5）
    if (tp.streak >= 2 && tp.difficulty < 5) { tp.difficulty += 1; tp.streak = 0; }
  } else {
    tp.streak = 0;
    if (tp.difficulty > 1) tp.difficulty -= 1; // 答錯就降難度
  }
  setTopicProgress(t.id, tp);

  const fb = $('#q-feedback');
  fb.className = 'feedback ' + (r.correct ? 'correct' : 'wrong');
  fb.innerHTML = `
    <div class="fb-head">${r.correct ? '✅ 答對了！' : '❌ 再想想'}</div>
    <div class="fb-text">${escapeHtml(r.feedback)}</div>
    ${r.solution ? `<details class="fb-sol" ${r.correct ? '' : 'open'}><summary>查看解說</summary><div>${escapeHtml(r.solution)}</div></details>` : ''}
    <div class="fb-adjust">下一題難度：Lv.${tp.difficulty}</div>`;

  $('#submit-btn').classList.add('hidden');
  $('#next-btn').classList.remove('hidden');
  $('#next-btn').focus();
}

// ---------- 提示 ----------
function showHint() {
  if (!current.question) return;
  const h = current.question.hint || '試試把題目分成小步驟，先做乘除，再做加減。';
  $('#hint-box').innerHTML = `💡 <b>提示：</b>${escapeHtml(h)}`;
}
function flashHint(msg) {
  const box = $('#hint-box');
  box.innerHTML = `⚠️ ${escapeHtml(msg)}`;
}

// ---------- AI 老師（自由問答） ----------
let tutorHistory = [];
function appendTutor(role, text, pending = false) {
  const log = $('#tutor-log');
  const div = document.createElement('div');
  div.className = `bubble ${role}${pending ? ' pending' : ''}`;
  div.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}
async function sendTutor() {
  const input = $('#tutor-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendTutor('user', msg);
  tutorHistory.push({ role: 'user', content: msg });
  const pending = appendTutor('assistant', '老師思考中…', true);
  try {
    const reply = await askTutor(tutorHistory, current.topic?.name);
    pending.classList.remove('pending');
    pending.innerHTML = escapeHtml(reply).replace(/\n/g, '<br>');
    tutorHistory.push({ role: 'assistant', content: reply });
    $('#tutor-log').scrollTop = $('#tutor-log').scrollHeight;
  } catch (e) {
    pending.classList.remove('pending');
    pending.classList.add('err');
    pending.textContent = `出錯了：${e.message}`;
  }
}

// ---------- 設定（API Key） ----------
function openSettings() {
  $('#api-key-input').value = localStorage.getItem('qwen_api_key') || '';
  $('#settings-modal').classList.remove('hidden');
}
function saveSettings() {
  const v = $('#api-key-input').value.trim();
  if (v) localStorage.setItem('qwen_api_key', v);
  else localStorage.removeItem('qwen_api_key');
  $('#settings-modal').classList.add('hidden');
  updateKeyBanner();
}
function updateKeyBanner() {
  $('#key-banner').classList.toggle('hidden', hasKey());
}

// ---------- 工具 ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- 綁定事件 ----------
function bind() {
  $('#submit-btn').addEventListener('click', submitAnswer);
  $('#next-btn').addEventListener('click', nextQuestion);
  $('#hint-btn').addEventListener('click', showHint);
  $$('.back-home').forEach((b) => b.addEventListener('click', () => { show('home'); renderHome(); }));
  $('#settings-btn').addEventListener('click', openSettings);
  $('#settings-save').addEventListener('click', saveSettings);
  $('#settings-close').addEventListener('click', () => $('#settings-modal').classList.add('hidden'));
  $('#open-settings-link').addEventListener('click', openSettings);
  $('#tutor-send').addEventListener('click', sendTutor);
  $('#tutor-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTutor(); }
  });
}

bind();
renderHome();
updateKeyBanner();
