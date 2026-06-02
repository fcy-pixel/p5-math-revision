/**
 * app.js — 數學大冒險（Pokémon 風）
 * 答對 = 收服野生精靈，集滿就贏得道館徽章；難度會適性調整。
 */
import { TOPICS, TOPIC_BY_ID } from './topics.js';
import { randomMonster, spriteSVG } from './sprites.js';
import { generateQuestion, gradeAnswer, askTutor, hasKey } from './ai.js';
import { genFraction } from './fracgen.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const CATCH_GOAL = 4; // 收服多少隻精靈贏得徽章

// ---------- 進度（localStorage） ----------
const PROG_KEY = 'p5math_adventure';
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROG_KEY)) || {}; } catch { return {}; }
}
function saveProgress(p) { localStorage.setItem(PROG_KEY, JSON.stringify(p)); }
function gymProgress(id) {
  const p = loadProgress();
  return p[id] || { difficulty: 2, caught: 0, totalCaught: 0, badge: false, streak: 0 };
}
function setGymProgress(id, gp) {
  const p = loadProgress();
  p[id] = gp;
  saveProgress(p);
}

// ---------- 狀態 ----------
let game = { topic: null, question: null, answered: false, monster: null };

// ---------- 出題來源（本地即時 + AI 預取） ----------
let prefetched = null; // { topicId, difficulty, promise }

function startPrefetch(topic, difficulty) {
  if (!topic || topic.id === 'fraction-calc') return; // 本地題免預取
  prefetched = {
    topicId: topic.id,
    difficulty,
    promise: generateQuestion(topic, difficulty).catch(() => null),
  };
}

async function takeQuestion(topic, difficulty) {
  if (topic.id === 'fraction-calc') return genFraction(difficulty); // 本地、零等待
  if (prefetched && prefetched.topicId === topic.id && prefetched.difficulty === difficulty) {
    const p = prefetched.promise;
    prefetched = null;
    const q = await p;
    if (q) return q; // 預取命中：通常已備好，立即可用
  }
  prefetched = null;
  return generateQuestion(topic, difficulty);
}

// ---------- 畫面切換 ----------
function show(view) {
  $$('.view').forEach((v) => v.classList.remove('active'));
  $(`#view-${view}`).classList.add('active');
  window.scrollTo(0, 0);
}

// ---------- 地圖（首頁） ----------
function renderMap() {
  const p = loadProgress();
  const badges = TOPICS.filter((t) => (p[t.id]?.badge)).length;
  const totalCaught = TOPICS.reduce((s, t) => s + (p[t.id]?.totalCaught || 0), 0);
  $('#trainer-badges').textContent = badges;
  $('#trainer-caught').textContent = totalCaught;

  const grid = $('#gym-grid');
  grid.innerHTML = '';
  TOPICS.forEach((t) => {
    const gp = gymProgress(t.id);
    const card = document.createElement('button');
    card.className = 'gym-card';
    card.innerHTML = `
      <div class="gym-leader">${spriteSVG(t.leader)}</div>
      <div class="gym-body">
        <div class="gym-name">${t.icon} ${t.gym} ${gp.badge ? '<span class="earned">🎖️</span>' : ''}</div>
        <div class="gym-blurb">${t.blurb}</div>
        <div class="gym-meta">
          <span class="badge">Lv.${gp.difficulty}</span>
          <span class="badge">已收服 ${gp.totalCaught} 隻</span>
        </div>
      </div>
      <div class="gym-go">${gp.badge ? '再挑戰 →' : '進入道館 →'}</div>`;
    card.addEventListener('click', () => enterGym(t.id));
    grid.appendChild(card);
  });
}

// ---------- 進入道館 ----------
async function enterGym(id) {
  game.topic = TOPIC_BY_ID[id];
  const gp = gymProgress(id);
  gp.caught = 0; // 每次進館重新計收服進度
  setGymProgress(id, gp);
  $('#gym-title').textContent = `${game.topic.icon} ${game.topic.gym}`;
  $('#prof-topic').textContent = game.topic.name;
  show('battle');
  await spawnMonster();
}

// ---------- 出現野生精靈（出題） ----------
async function spawnMonster() {
  const t = game.topic;
  const gp = gymProgress(t.id);
  game.question = null;
  game.answered = false;
  game.monster = randomMonster();

  $('#q-feedback').innerHTML = '';
  $('#q-feedback').className = 'feedback';
  $('#answer-area').innerHTML = '';
  $('#hint-box').innerHTML = '';
  $('#next-btn').classList.add('hidden');
  $('#submit-btn').classList.remove('hidden');
  updateBadgeBar(gp);

  $('#monster-emoji').innerHTML = spriteSVG(game.monster.id);
  $('#monster-emoji').classList.remove('shake', 'caught', 'flee');
  $('#monster-name').textContent = `野生的 ${game.monster.n} 出現了！`;
  $('#monster-lv').textContent = `Lv.${gp.difficulty}`;
  $('#q-text').innerHTML = '<span class="loading">精靈正在出招…</span>';

  try {
    const q = await takeQuestion(t, gp.difficulty);
    game.question = q;
    $('#q-text').innerHTML = mathHTML(q.question);
    renderAnswerInput(q);
  } catch (e) {
    $('#q-text').innerHTML = `<span class="error">出招失敗：${e.message}</span>`;
    $('#submit-btn').classList.add('hidden');
    $('#next-btn').classList.remove('hidden');
    $('#next-btn').textContent = '再遇一隻 →';
  }
}

function renderAnswerInput(q) {
  const area = $('#answer-area');
  area.innerHTML =
    '<input id="ans-input" class="text-input" type="text" autocomplete="off" placeholder="輸入答案，例如 3/4 代表四分之三、或 12 克" />' +
    '<div id="ans-preview" class="ans-preview"></div>';
  const input = $('#ans-input');
  const preview = $('#ans-preview');
  input.focus();
  input.addEventListener('input', () => {
    const v = input.value.trim();
    preview.innerHTML = /\d\/\d/.test(v) ? `你的答案：${mathHTML(v)}` : '';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !game.answered) submitAnswer();
  });
}

// 把答案字串轉成數值（支援整數、小數、分數 a/b、帶分數 a 又 b/c），失敗回 null
function parseNum(str) {
  if (str == null) return null;
  let s = String(str).replace(/[^\d./又\s-]/g, ' ').trim(); // 去掉「克、顆、人、公斤」等單位
  let m = s.match(/^(-?\d+)\s*又\s*(\d+)\/(\d+)$/);          // 帶分數 a 又 b/c
  if (m) { const w = +m[1], n = +m[2], d = +m[3]; return d ? Math.sign(w || 1) * (Math.abs(w) + n / d) : null; }
  m = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);                   // 帶分數 a b/c（空格）
  if (m) { const w = +m[1], n = +m[2], d = +m[3]; return d ? Math.sign(w || 1) * (Math.abs(w) + n / d) : null; }
  m = s.match(/^(-?\d+)\/(\d+)$/);                           // 分數 a/b
  if (m) return +m[2] ? +m[1] / +m[2] : null;
  m = s.match(/^-?\d+(?:\.\d+)?$/);                          // 整數或小數
  if (m) return parseFloat(s);
  return null;
}

// 本地即時批改：兩邊都能轉成數值才判斷，否則回 null（交給 AI）
function localGrade(studentStr, answerStr) {
  const a = parseNum(studentStr), b = parseNum(answerStr);
  if (a === null || b === null) return null;
  return Math.abs(a - b) < 1e-6;
}

// ---------- 丟精靈球（批改） ----------
async function submitAnswer() {
  if (game.answered || !game.question) return;
  const ans = ($('#ans-input')?.value || '').trim();
  if (!ans) { flashHint('先輸入答案，再丟精靈球！'); return; }

  // 1) 本地即時批改（數值題）——零等待
  const local = localGrade(ans, game.question.answer);
  if (local !== null) {
    game.answered = true;
    $('#monster-emoji').classList.remove('shake');
    applyResult({
      correct: local,
      feedback: local ? '計算正確，做得好！' : `正確答案是 ${game.question.answer}，看看下面的解法。`,
      solution: game.question.solution || '',
    });
    return;
  }

  // 2) 無法本地判斷（如文字題）→ 用 AI（較快的模型）批改
  $('#submit-btn').disabled = true;
  $('#submit-btn').textContent = '丟出精靈球…';
  $('#monster-emoji').classList.add('shake');
  try {
    const r = await gradeAnswer(game.topic, game.question, ans);
    game.answered = true;
    applyResult(r);
  } catch (e) {
    // AI 一時繁忙：友善退場，顯示參考答案，不扣難度
    game.answered = true;
    $('#monster-emoji').classList.remove('shake');
    applyResult({
      neutral: true,
      feedback: 'AI 老師一時繁忙，先看看參考答案吧！',
      solution: `參考答案：${game.question.answer || ''}\n${game.question.solution || ''}`,
    });
  } finally {
    $('#submit-btn').disabled = false;
    $('#submit-btn').textContent = '丟出精靈球 ⚪';
  }
}

// ---------- 結算＋適性難度＋收服進度 ----------
function applyResult(r) {
  const t = game.topic;
  const gp = gymProgress(t.id);
  const mon = game.monster;
  $('#monster-emoji').classList.remove('shake');

  let wonBadge = false;
  if (!r.neutral) {
    if (r.correct) {
      gp.caught += 1;
      gp.totalCaught += 1;
      gp.streak += 1;
      if (gp.streak >= 2 && gp.difficulty < 5) { gp.difficulty += 1; gp.streak = 0; }
      $('#monster-emoji').classList.add('caught');
    } else {
      gp.streak = 0;
      if (gp.difficulty > 1) gp.difficulty -= 1;
      $('#monster-emoji').classList.add('flee');
    }
    wonBadge = r.correct && gp.caught >= CATCH_GOAL && !gp.badge;
    if (r.correct && gp.caught >= CATCH_GOAL) gp.badge = true;
    setGymProgress(t.id, gp);
  }
  updateBadgeBar(gp);

  const headTxt = r.neutral ? `🤝 ${mon.n} 跟你打成平手` : (r.correct ? `✨ 收服了 ${mon.n}！` : `💨 ${mon.n} 逃走了…`);
  const fb = $('#q-feedback');
  fb.className = 'feedback ' + (r.neutral ? 'neutral' : (r.correct ? 'correct' : 'wrong'));
  fb.innerHTML = `
    <div class="fb-head">${headTxt}</div>
    <div class="fb-text">${mathHTML(r.feedback)}</div>
    ${r.solution ? `<details class="fb-sol" ${r.correct ? '' : 'open'}><summary>看精靈的招式（解法）</summary><div>${mathHTML(r.solution)}</div></details>` : ''}
    <div class="fb-adjust">下一隻精靈 Lv.${gp.difficulty}</div>`;

  $('#submit-btn').classList.add('hidden');
  $('#next-btn').classList.remove('hidden');
  $('#next-btn').textContent = '繼續冒險 →';
  $('#next-btn').focus();

  // 趁學生看回饋時，背景預先準備下一題（AI 題用），令「繼續冒險」幾乎即時
  startPrefetch(t, gp.difficulty);

  if (wonBadge) setTimeout(() => showBadge(t), 500);
}

function updateBadgeBar(gp) {
  const filled = Math.min(gp.caught, CATCH_GOAL);
  $('#badge-progress').innerHTML =
    `收服進度 ${filled}/${CATCH_GOAL} ` +
    '⚪'.repeat(filled).replace(/⚪/g, '🔴') + '⚪'.repeat(CATCH_GOAL - filled);
}

// ---------- 贏得徽章 ----------
function showBadge(t) {
  $('#badge-text').innerHTML = `你贏得了<br><b>${t.icon} ${t.gym} 徽章 🎖️</b>！<br>成為更強的數學訓練師！`;
  $('#badge-modal').classList.remove('hidden');
}

// ---------- 提示 ----------
function showHint() {
  if (!game.question) return;
  const h = game.question.hint || '把題目拆成小步，先做乘除，再做加減。';
  $('#hint-box').innerHTML = `💡 <b>精靈弱點（提示）：</b>${mathHTML(h)}`;
}
function flashHint(msg) {
  $('#hint-box').innerHTML = `⚠️ ${escapeHtml(msg)}`;
}

// ---------- 博士求助（AI 老師） ----------
let profHistory = [];
function appendProf(role, text, pending = false) {
  const log = $('#prof-log');
  const div = document.createElement('div');
  div.className = `bubble ${role}${pending ? ' pending' : ''}`;
  div.innerHTML = mathHTML(text);
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}
async function sendProf() {
  const input = $('#prof-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendProf('user', msg);
  profHistory.push({ role: 'user', content: msg });
  const pending = appendProf('assistant', '博士思考中…', true);
  try {
    const reply = await askTutor(profHistory, game.topic?.name);
    pending.classList.remove('pending');
    pending.innerHTML = mathHTML(reply);
    profHistory.push({ role: 'assistant', content: reply });
    $('#prof-log').scrollTop = $('#prof-log').scrollHeight;
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
async function updateKeyBanner() {
  let ok = hasKey();
  if (!ok) {
    try { ok = !!(await (await fetch('/api/chat')).json()).hasServerKey; } catch { /* keep banner */ }
  }
  $('#key-banner').classList.toggle('hidden', ok);
}

// ---------- 工具 ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 把純文字數式轉成 HTML：a/b → 直式分數（分子在上、分數線、分母在下）
function fracHTML(n, d) {
  return `<span class="frac"><span class="num">${n}</span><span class="den">${d}</span></span>`;
}
function mathHTML(raw) {
  let s = escapeHtml(String(raw));
  // 帶分數「2 又 1/3」與一般分數「a/b」一次過處理（帶分數優先）
  s = s.replace(/(\d+)\s*又\s*(\d+)\/(\d+)|(\d+)\/(\d+)/g,
    (m, w, mn, md, n, d) => (w !== undefined ? `${w}${fracHTML(mn, md)}` : fracHTML(n, d)));
  return s.replace(/\n/g, '<br>');
}

// ---------- 綁定 ----------
function bind() {
  $('#submit-btn').addEventListener('click', submitAnswer);
  $('#next-btn').addEventListener('click', spawnMonster);
  $('#hint-btn').addEventListener('click', showHint);
  $$('.back-map').forEach((b) => b.addEventListener('click', () => { show('map'); renderMap(); }));
  $('#settings-btn').addEventListener('click', openSettings);
  $('#settings-save').addEventListener('click', saveSettings);
  $('#settings-close').addEventListener('click', () => $('#settings-modal').classList.add('hidden'));
  $('#open-settings-link').addEventListener('click', openSettings);
  $('#badge-ok').addEventListener('click', () => { $('#badge-modal').classList.add('hidden'); show('map'); renderMap(); });
  $('#prof-send').addEventListener('click', sendProf);
  $('#prof-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendProf(); }
  });
}

bind();
renderMap();
updateKeyBanner();
