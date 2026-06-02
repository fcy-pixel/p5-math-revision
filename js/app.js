/**
 * app.js — 數學大冒險（Pokémon 風）
 * 答對 = 收服野生精靈，集滿就贏得道館徽章；難度會適性調整。
 */
import { TOPICS, TOPIC_BY_ID, randomMonster } from './topics.js';
import { generateQuestion, gradeAnswer, askTutor, hasKey } from './ai.js';

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
      <div class="gym-leader">${t.leader}</div>
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

  $('#monster-emoji').textContent = game.monster.e;
  $('#monster-emoji').classList.remove('shake', 'caught', 'flee');
  $('#monster-name').textContent = `野生的 ${game.monster.n} 出現了！`;
  $('#monster-lv').textContent = `Lv.${gp.difficulty}`;
  $('#q-text').innerHTML = '<span class="loading">精靈正在出招…</span>';

  try {
    const q = await generateQuestion(t, gp.difficulty);
    game.question = q;
    $('#q-text').textContent = q.question;
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
    '<input id="ans-input" class="text-input" type="text" autocomplete="off" placeholder="輸入答案丟出精靈球，例如 3/4 或 12 克" />';
  const input = $('#ans-input');
  input.focus();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !game.answered) submitAnswer();
  });
}

// ---------- 丟精靈球（批改） ----------
async function submitAnswer() {
  if (game.answered || !game.question) return;
  const ans = ($('#ans-input')?.value || '').trim();
  if (!ans) { flashHint('先輸入答案，再丟精靈球！'); return; }

  $('#submit-btn').disabled = true;
  $('#submit-btn').textContent = '丟出精靈球…';
  $('#monster-emoji').classList.add('shake');

  try {
    const r = await gradeAnswer(game.topic, game.question, ans);
    game.answered = true;
    applyResult(r);
  } catch (e) {
    flashHint(`對戰出錯：${e.message}`);
    $('#monster-emoji').classList.remove('shake');
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

  const wonBadge = r.correct && gp.caught >= CATCH_GOAL && !gp.badge;
  if (r.correct && gp.caught >= CATCH_GOAL) gp.badge = true;
  setGymProgress(t.id, gp);
  updateBadgeBar(gp);

  const fb = $('#q-feedback');
  fb.className = 'feedback ' + (r.correct ? 'correct' : 'wrong');
  fb.innerHTML = `
    <div class="fb-head">${r.correct ? `✨ 收服了 ${mon.n}！` : `💨 ${mon.n} 逃走了…`}</div>
    <div class="fb-text">${escapeHtml(r.feedback)}</div>
    ${r.solution ? `<details class="fb-sol" ${r.correct ? '' : 'open'}><summary>看精靈的招式（解法）</summary><div>${escapeHtml(r.solution)}</div></details>` : ''}
    <div class="fb-adjust">下一隻精靈 Lv.${gp.difficulty}</div>`;

  $('#submit-btn').classList.add('hidden');
  $('#next-btn').classList.remove('hidden');
  $('#next-btn').textContent = '繼續冒險 →';
  $('#next-btn').focus();

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
  $('#hint-box').innerHTML = `💡 <b>精靈弱點（提示）：</b>${escapeHtml(h)}`;
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
  div.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
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
    pending.innerHTML = escapeHtml(reply).replace(/\n/g, '<br>');
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
