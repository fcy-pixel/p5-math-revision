/**
 * app.js — 數學大冒險 RPG（卡通 2.5D）
 * 大地圖探險 + 訓練師等級/經驗 + 精靈圖鑑 + 音效音樂 + AI 適性出題/批改
 */
import { TOPICS, TOPIC_BY_ID } from './topics.js';
import { randomMonster, spriteSVG, MONSTERS } from './sprites.js';
import { generateQuestion, gradeAnswer, askTutor, hasKey } from './ai.js';
import { genFraction } from './fracgen.js';
import { playSfx, startMusic, stopMusic, isSoundOn, toggleSound, primeAudio } from './audio.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const CATCH_GOAL = 4;

/* ---------- 進度（每個道館） ---------- */
const PROG_KEY = 'p5math_adventure';
const loadProgress = () => { try { return JSON.parse(localStorage.getItem(PROG_KEY)) || {}; } catch { return {}; } };
const saveProgress = (p) => localStorage.setItem(PROG_KEY, JSON.stringify(p));
const gymProgress = (id) => loadProgress()[id] || { difficulty: 2, caught: 0, totalCaught: 0, badge: false };
function setGymProgress(id, gp) { const p = loadProgress(); p[id] = gp; saveProgress(p); }

/* ---------- 訓練師（等級/經驗/金幣） ---------- */
const TRN_KEY = 'p5math_trainer';
const loadTrainer = () => { try { const t = JSON.parse(localStorage.getItem(TRN_KEY)) || {}; return { level: t.level || 1, xp: t.xp || 0, coins: t.coins || 0 }; } catch { return { level: 1, xp: 0, coins: 0 }; } };
const saveTrainer = (t) => localStorage.setItem(TRN_KEY, JSON.stringify(t));
const xpForLevel = (lv) => 30 + lv * 20;
function addReward(difficulty) {
  const t = loadTrainer();
  t.xp += 8 + difficulty * 3;
  t.coins += difficulty;
  let leveled = false;
  while (t.xp >= xpForLevel(t.level)) { t.xp -= xpForLevel(t.level); t.level += 1; leveled = true; }
  saveTrainer(t);
  return { leveled, level: t.level };
}

/* ---------- 圖鑑 ---------- */
const DEX_KEY = 'p5math_dex';
const loadDex = () => { try { return JSON.parse(localStorage.getItem(DEX_KEY)) || {}; } catch { return {}; } };
function catchMonster(id) { const d = loadDex(); d[id] = (d[id] || 0) + 1; localStorage.setItem(DEX_KEY, JSON.stringify(d)); }

/* ---------- 狀態 ---------- */
let game = { topic: null, question: null, answered: false, monster: null };
let prefetched = null;

function show(view) { $$('.view').forEach((v) => v.classList.remove('active')); $(`#view-${view}`).classList.add('active'); window.scrollTo(0, 0); }

/* ---------- HUD ---------- */
function renderHUD() {
  const t = loadTrainer();
  $('#hud-avatar').innerHTML = spriteSVG('trainer');
  $('#hud-level').textContent = t.level;
  $('#hud-coins').textContent = t.coins;
  const need = xpForLevel(t.level);
  $('#hud-xp').style.width = Math.min(100, (t.xp / need) * 100) + '%';
  $('#hud-xp-text').textContent = `${t.xp}/${need}`;
  const p = loadProgress();
  $('#hud-badges').textContent = TOPICS.filter((tp) => p[tp.id]?.badge).length;
  $('#sound-btn').textContent = isSoundOn() ? '🔊' : '🔇';
}

/* ---------- 大地圖 ---------- */
const ROOF = { 'fraction-calc': 'var(--brand)', 'word-problem': 'var(--blue)' };
function renderMap() {
  renderHUD();
  const p = loadProgress();
  const wrap = $('#map-buildings');
  wrap.innerHTML = '';
  const slots = [
    { type: 'gym', topic: TOPICS[0], left: 23 },
    { type: 'dex', left: 50 },
    { type: 'gym', topic: TOPICS[1], left: 77 },
  ];
  slots.forEach((s) => {
    const b = document.createElement('div');
    b.className = 'building';
    b.style.left = s.left + '%';
    if (s.type === 'dex') {
      b.innerHTML = `
        <div class="bld-roof" style="background:var(--accent)"></div>
        <div class="bld-wall" style="font-size:30px">📖</div>
        <div class="bld-sign">📖 圖鑑</div>`;
      b.addEventListener('click', () => walkTo(s.left, openDex));
    } else {
      const t = s.topic;
      const badge = p[t.id]?.badge;
      b.innerHTML = `
        ${badge ? '<div class="bld-badge">🎖️</div>' : ''}
        <div class="bld-roof" style="background:${ROOF[t.id]}"></div>
        <div class="bld-wall"><div class="bld-door"></div></div>
        <div class="bld-leader">${spriteSVG(t.leader)}</div>
        <div class="bld-sign">${t.icon} ${t.gym}</div>`;
      b.addEventListener('click', () => walkTo(s.left, () => enterGym(t.id)));
    }
    wrap.appendChild(b);
  });
  const av = $('#map-avatar');
  av.innerHTML = spriteSVG('trainer');
  av.style.left = '50%';
}
function walkTo(leftPct, cb) {
  playSfx('click');
  const av = $('#map-avatar');
  av.classList.add('walking');
  av.style.left = leftPct + '%';
  setTimeout(() => { av.classList.remove('walking'); cb && cb(); }, 650);
}

/* ---------- 圖鑑畫面 ---------- */
function openDex() {
  const dex = loadDex();
  const grid = $('#dex-grid');
  grid.innerHTML = '';
  let caughtTypes = 0;
  MONSTERS.forEach((m) => {
    const c = dex[m.id] || 0;
    if (c) caughtTypes += 1;
    const card = document.createElement('div');
    card.className = 'dex-card ' + (c ? 'caught' : 'locked');
    card.innerHTML = `<div class="dex-sprite">${spriteSVG(m.id)}</div>
      <div class="dex-name">${c ? m.n : '？？？'}</div>
      <div class="dex-num">${c ? '收服 ' + c + ' 次' : '未收服'}</div>`;
    grid.appendChild(card);
  });
  $('#dex-count').textContent = `${caughtTypes}/${MONSTERS.length}`;
  show('dex');
}

/* ---------- 進入道館 ---------- */
async function enterGym(id) {
  game.topic = TOPIC_BY_ID[id];
  const gp = gymProgress(id);
  gp.caught = 0;
  setGymProgress(id, gp);
  $('#gym-title').textContent = `${game.topic.icon} ${game.topic.gym}`;
  $('#stage-trainer').innerHTML = spriteSVG('trainer');
  show('battle');
  await spawnMonster();
}

/* ---------- 出題來源（AI + 本地後備 + 預取） ---------- */
function startPrefetch(topic, difficulty) {
  if (!topic) return;
  prefetched = { topicId: topic.id, difficulty, promise: generateQuestion(topic, difficulty).catch(() => null) };
}
async function takeQuestion(topic, difficulty) {
  if (prefetched && prefetched.topicId === topic.id && prefetched.difficulty === difficulty) {
    const p = prefetched.promise; prefetched = null;
    const q = await p; if (q) return q;
  }
  prefetched = null;
  try { return await generateQuestion(topic, difficulty); }
  catch (e) { if (topic.id === 'fraction-calc') return genFraction(difficulty); throw e; }
}

/* ---------- 出現野生精靈 ---------- */
async function spawnMonster() {
  const t = game.topic;
  const gp = gymProgress(t.id);
  game.question = null; game.answered = false; game.monster = randomMonster();

  $('#q-feedback').innerHTML = ''; $('#q-feedback').className = 'feedback';
  $('#answer-area').innerHTML = ''; $('#hint-box').innerHTML = '';
  $('#next-btn').classList.add('hidden'); $('#submit-btn').classList.remove('hidden');
  updateBadgeBar(gp);
  $('#q-difficulty').textContent = `Lv.${gp.difficulty}`;

  const ms = $('#monster-emoji');
  ms.className = 'monster-sprite';
  ms.innerHTML = spriteSVG(game.monster.id);
  $('#monster-name').textContent = `野生的 ${game.monster.n}`;
  $('#q-text').innerHTML = '<span class="loading">精靈正在出招…</span>';

  try {
    const q = await takeQuestion(t, gp.difficulty);
    game.question = q;
    $('#q-text').innerHTML = mathHTML(q.question);
    renderAnswerInput(q);
  } catch (e) {
    $('#q-text').innerHTML = `<span class="error">出招失敗：${e.message}</span>`;
    $('#submit-btn').classList.add('hidden');
    $('#next-btn').classList.remove('hidden'); $('#next-btn').textContent = '再遇一隻 →';
  }
}

function renderAnswerInput() {
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
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !game.answered) submitAnswer(); });
}

/* ---------- 答案數值處理 ---------- */
function parseNum(str) {
  if (str == null) return null;
  let s = String(str).split(/[（(]/)[0].replace(/[^\d./又\s-]/g, ' ').trim();
  let m = s.match(/^(-?\d+)\s*又\s*(\d+)\/(\d+)/);
  if (m) { const w = +m[1], n = +m[2], d = +m[3]; return d ? Math.sign(w || 1) * (Math.abs(w) + n / d) : null; }
  m = s.match(/^(-?\d+)\s+(\d+)\/(\d+)/);
  if (m) { const w = +m[1], n = +m[2], d = +m[3]; return d ? Math.sign(w || 1) * (Math.abs(w) + n / d) : null; }
  m = s.match(/^(-?\d+)\/(\d+)/);
  if (m) return +m[2] ? +m[1] / +m[2] : null;
  m = s.match(/^-?\d+(?:\.\d+)?/);
  if (m) return parseFloat(m[0]);
  return null;
}
function evalCalc(expr) {
  let e = String(expr).replace(/＋/g, '+').replace(/[−–—]/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/[＝=].*$/, '').replace(/\s+/g, '');
  if (!e || !/^[\d.+\-*/()]+$/.test(e)) return null;
  try { const v = Function('"use strict";return (' + e + ')')(); return typeof v === 'number' && isFinite(v) ? v : null; } catch { return null; }
}
function localVerdict(topic, q, ans) {
  const sv = parseNum(ans);
  if (sv === null) return null;
  let av = topic.pureCalc ? evalCalc(q.question) : null;
  if (av === null) av = parseNum(q.answer);
  if (av === null) return null;
  return Math.abs(av - sv) < 1e-6;
}

/* ---------- 丟精靈球（批改） ---------- */
async function submitAnswer() {
  if (game.answered || !game.question) return;
  const ans = ($('#ans-input')?.value || '').trim();
  if (!ans) { flashHint('先輸入答案，再丟精靈球！'); return; }

  const local = localVerdict(game.topic, game.question, ans);
  $('#submit-btn').disabled = true; $('#submit-btn').textContent = '丟出精靈球…';
  $('#monster-emoji').classList.add('shake');
  try {
    const r = await gradeAnswer(game.topic, game.question, ans);
    const correct = local !== null ? local : r.correct;
    const feedback = (local === null || r.correct === correct) ? r.feedback
      : (correct ? '計算正確，做得好！' : `正確答案是 ${game.question.answer}，看看下面的解法。`);
    game.answered = true;
    applyResult({ correct, feedback, solution: r.solution || game.question.solution || '' });
  } catch (e) {
    game.answered = true; $('#monster-emoji').classList.remove('shake');
    if (local !== null) {
      applyResult({ correct: local, feedback: local ? '計算正確，做得好！' : `正確答案是 ${game.question.answer}，看看下面的解法。`, solution: game.question.solution || '' });
    } else {
      applyResult({ neutral: true, feedback: 'AI 老師一時繁忙，先看看參考答案吧！', solution: `參考答案：${game.question.answer || ''}\n${game.question.solution || ''}` });
    }
  } finally {
    $('#submit-btn').disabled = false; $('#submit-btn').textContent = '丟出精靈球 ⚪';
  }
}

/* ---------- 結算 ---------- */
function applyResult(r) {
  const t = game.topic;
  const gp = gymProgress(t.id);
  const mon = game.monster;
  $('#monster-emoji').classList.remove('shake');

  let wonBadge = false, leveled = false;
  const prevDiff = gp.difficulty;
  if (!r.neutral) {
    if (r.correct) {
      gp.caught += 1; gp.totalCaught += 1;
      if (gp.difficulty < 5) gp.difficulty += 1;
      $('#monster-emoji').classList.add('caught');
      catchMonster(mon.id);
      const rew = addReward(prevDiff);
      leveled = rew.leveled;
      playSfx('catch');
    } else {
      if (gp.difficulty > 1) gp.difficulty -= 1;
      $('#monster-emoji').classList.add('flee');
      playSfx('wrong');
    }
    wonBadge = r.correct && gp.caught >= CATCH_GOAL && !gp.badge;
    if (r.correct && gp.caught >= CATCH_GOAL) gp.badge = true;
    setGymProgress(t.id, gp);
  }
  renderHUD();
  updateBadgeBar(gp);

  const headTxt = r.neutral ? `🤝 ${mon.n} 跟你打成平手` : (r.correct ? `✨ 收服了 ${mon.n}！` : `💨 ${mon.n} 逃走了…`);
  const fb = $('#q-feedback');
  fb.className = 'feedback ' + (r.neutral ? 'neutral' : (r.correct ? 'correct' : 'wrong'));
  fb.innerHTML = `
    <div class="fb-head">${headTxt}</div>
    <div class="fb-text">${mathHTML(r.feedback)}</div>
    ${r.solution ? `<details class="fb-sol" ${r.correct ? '' : 'open'}><summary>看精靈的招式（解法）</summary><div>${mathHTML(r.solution)}</div></details>` : ''}
    <div class="fb-adjust">${gp.difficulty > prevDiff ? '難度提升 ⬆️ ' : (gp.difficulty < prevDiff ? '難度降低 ⬇️ ' : '')}下一隻精靈 Lv.${gp.difficulty}</div>`;

  $('#submit-btn').classList.add('hidden');
  $('#next-btn').classList.remove('hidden'); $('#next-btn').textContent = '繼續冒險 →'; $('#next-btn').focus();

  startPrefetch(t, gp.difficulty);
  if (leveled) setTimeout(() => showLevelUp(loadTrainer().level), 650);
  else if (wonBadge) setTimeout(() => showBadge(t), 600);
}

function updateBadgeBar(gp) {
  const filled = Math.min(gp.caught, CATCH_GOAL);
  $('#badge-progress').textContent = '收服進度 ' + '🔴'.repeat(filled) + '⚪'.repeat(CATCH_GOAL - filled);
}
function showBadge(t) {
  playSfx('badge');
  $('#badge-text').innerHTML = `贏得 <b>${t.icon} ${t.gym} 徽章 🎖️</b>！<br>你越來越強了！`;
  $('#badge-modal').classList.remove('hidden');
}
function showLevelUp(level) {
  playSfx('levelup');
  $('#levelup-text').textContent = `升級了！訓練師 Lv.${level} 🎉`;
  $('#levelup-modal').classList.remove('hidden');
}

/* ---------- 提示 / 博士 ---------- */
function showHint() {
  if (!game.question) return;
  const h = game.question.hint || '把題目拆成小步，先做乘除，再做加減。';
  $('#hint-box').innerHTML = `💡 <b>精靈弱點（提示）：</b>${mathHTML(h)}`;
}
function flashHint(msg) { $('#hint-box').innerHTML = `⚠️ ${escapeHtml(msg)}`; }

let profHistory = [];
function appendProf(role, text, pending = false) {
  const log = $('#prof-log');
  const div = document.createElement('div');
  div.className = `bubble ${role}${pending ? ' pending' : ''}`;
  div.innerHTML = mathHTML(text);
  log.appendChild(div); log.scrollTop = log.scrollHeight;
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
    pending.classList.remove('pending'); pending.innerHTML = mathHTML(reply);
    profHistory.push({ role: 'assistant', content: reply });
    $('#prof-log').scrollTop = $('#prof-log').scrollHeight;
  } catch (e) {
    pending.classList.remove('pending'); pending.classList.add('err'); pending.textContent = `出錯了：${e.message}`;
  }
}

/* ---------- 設定 / 音效 ---------- */
function openSettings() { $('#api-key-input').value = localStorage.getItem('qwen_api_key') || ''; $('#settings-modal').classList.remove('hidden'); }
function saveSettings() {
  const v = $('#api-key-input').value.trim();
  if (v) localStorage.setItem('qwen_api_key', v); else localStorage.removeItem('qwen_api_key');
  $('#settings-modal').classList.add('hidden'); updateKeyBanner();
}
async function updateKeyBanner() {
  let ok = hasKey();
  if (!ok) { try { ok = !!(await (await fetch('/api/chat')).json()).hasServerKey; } catch { /* keep */ } }
  $('#key-banner').classList.toggle('hidden', ok);
}

/* ---------- 工具 ---------- */
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fracHTML(n, d) { return `<span class="frac"><span class="num">${n}</span><span class="den">${d}</span></span>`; }
function mathHTML(raw) {
  let s = escapeHtml(String(raw));
  s = s.replace(/(\d+)\s*又\s*(\d+)\/(\d+)|(\d+)\/(\d+)/g,
    (m, w, mn, md, n, d) => (w !== undefined ? `${w}${fracHTML(mn, md)}` : fracHTML(n, d)));
  return s.replace(/\n/g, '<br>');
}

/* ---------- 綁定 ---------- */
function bind() {
  $('#submit-btn').addEventListener('click', submitAnswer);
  $('#next-btn').addEventListener('click', spawnMonster);
  $('#hint-btn').addEventListener('click', showHint);
  $$('.back-map').forEach((b) => b.addEventListener('click', () => { stopMusic(); show('map'); renderMap(); startMusic(); }));
  $('#settings-btn').addEventListener('click', openSettings);
  $('#settings-save').addEventListener('click', saveSettings);
  $('#settings-close').addEventListener('click', () => $('#settings-modal').classList.add('hidden'));
  $('#open-settings-link').addEventListener('click', openSettings);
  $('#badge-ok').addEventListener('click', () => { $('#badge-modal').classList.add('hidden'); });
  $('#levelup-ok').addEventListener('click', () => { $('#levelup-modal').classList.add('hidden'); });
  $('#prof-send').addEventListener('click', sendProf);
  $('#prof-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendProf(); } });
  $('#sound-btn').addEventListener('click', () => { toggleSound(); renderHUD(); });
  document.addEventListener('pointerdown', () => primeAudio(), { once: true });
}

bind();
renderMap();
updateKeyBanner();
