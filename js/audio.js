/**
 * audio.js — 程式合成音效與背景音樂（Web Audio，無需音檔、無版權問題）
 * 單一開關控制音效＋音樂；狀態存 localStorage。
 */

let ctx = null;
let musicTimer = null;
let musicStep = 0;
let soundOn = localStorage.getItem('p5_sound') !== 'off';

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// 播一個音
function tone(freq, start, dur, { type = 'square', gain = 0.14 } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(start); o.stop(start + dur + 0.02);
}

const N = { C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, C6: 1046.5 };

export function playSfx(name) {
  if (!soundOn || !ensureCtx()) return;
  const t = ctx.currentTime;
  switch (name) {
    case 'correct':
      [N.C5, N.E5, N.G5].forEach((f, i) => tone(f, t + i * 0.08, 0.18, { type: 'triangle' }));
      break;
    case 'catch':
      [N.E5, N.G5, N.C6].forEach((f, i) => tone(f, t + i * 0.06, 0.16, { type: 'triangle', gain: 0.12 }));
      tone(N.C6, t + 0.22, 0.25, { type: 'sine', gain: 0.1 });
      break;
    case 'wrong':
      tone(220, t, 0.18, { type: 'sawtooth', gain: 0.1 });
      tone(150, t + 0.12, 0.22, { type: 'sawtooth', gain: 0.1 });
      break;
    case 'levelup':
      [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, t + i * 0.1, 0.28, { type: 'triangle', gain: 0.13 }));
      break;
    case 'click':
      tone(N.A4, t, 0.07, { type: 'square', gain: 0.08 });
      break;
    case 'badge':
      [N.G4, N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, t + i * 0.12, 0.3, { type: 'triangle', gain: 0.13 }));
      break;
  }
}

// 輕快循環背景音樂（簡單琶音 + 低音）
const MELODY = [N.C4, N.E4, N.G4, N.E4, N.F4, N.A4, N.G4, N.E4];
const BASS = [N.C4 / 2, N.C4 / 2, N.F4 / 2, N.G4 / 2];

function scheduleMusic() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.05;
  tone(MELODY[musicStep % MELODY.length], t, 0.22, { type: 'triangle', gain: 0.05 });
  if (musicStep % 2 === 0) tone(BASS[(musicStep / 2) % BASS.length], t, 0.42, { type: 'sine', gain: 0.05 });
  musicStep++;
}

export function startMusic() {
  if (!soundOn || musicTimer || !ensureCtx()) return;
  musicTimer = setInterval(scheduleMusic, 300);
}
export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
export function isSoundOn() { return soundOn; }
export function toggleSound() {
  soundOn = !soundOn;
  localStorage.setItem('p5_sound', soundOn ? 'on' : 'off');
  if (soundOn) { ensureCtx(); startMusic(); playSfx('click'); }
  else stopMusic();
  return soundOn;
}
// 首次互動時叫一次，符合瀏覽器自動播放規則
export function primeAudio() {
  if (soundOn) { ensureCtx(); startMusic(); }
}
