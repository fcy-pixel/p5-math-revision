/**
 * sprites.js — 自製像素小精靈（純 SVG，無外部圖檔、無版權問題）
 * 每隻精靈用程式畫在 16×16 像素格上，輸出 crisp 的 <svg>。
 */

const GRID = 16;
const mk = () => Array.from({ length: GRID }, () => Array(GRID).fill(null));
const inb = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;
const set = (g, x, y, c) => { if (inb(x, y)) g[y][x] = c; };
const setM = (g, x, y, c) => { set(g, x, y, c); set(g, GRID - 1 - x, y, c); };

function body(g, fill, outline, { cx = 7.5, cy = 8.7, rx = 5.2, ry = 5.2 } = {}) {
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy <= 1) g[y][x] = fill;
  }
  const out = mk();
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    if (g[y][x]) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!inb(x + ox, y + oy) || !g[y + oy][x + ox]) out[y][x] = outline;
    }
  }
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (out[y][x]) g[y][x] = outline;
}
const eyes = (g, { ey = 8, w = '#fff', p = '#22243a' } = {}) => {
  setM(g, 5, ey, w); setM(g, 5, ey + 1, w); setM(g, 6, ey + 1, p);
};
const feet = (g, c, y = 13) => setM(g, 5, y, c);

// 在所有已填色像素的外圍加一圈輪廓（卡通描邊）
function outline(g, color) {
  const add = mk();
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    if (!g[y][x]) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (inb(x + ox, y + oy) && g[y + oy][x + ox]) add[y][x] = color;
    }
  }
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (add[y][x]) g[y][x] = add[y][x];
}

// 訓練師角色（卡通像素）
function trainer(g) {
  const R = '#ee3b35', S = '#ffd1a3', B = '#3b6fe0', P = '#39404d', K = '#2a2320', W = '#fff';
  // 帽
  setM(g, 6, 1, R); setM(g, 7, 1, R);
  setM(g, 5, 2, R); setM(g, 6, 2, R); setM(g, 7, 2, R);
  for (let x = 4; x <= 7; x++) setM(g, x, 3, R);
  for (let x = 3; x <= 7; x++) setM(g, x, 4, R); // 帽簷
  // 臉
  for (let y = 5; y <= 7; y++) for (let x = 5; x <= 7; x++) setM(g, x, y, S);
  setM(g, 5, 6, K); // 眼
  setM(g, 6, 7, '#e89a8a'); // 笑
  // 身體（背心）
  for (let x = 5; x <= 7; x++) setM(g, x, 8, B);
  for (let x = 4; x <= 7; x++) setM(g, x, 9, B);
  for (let x = 4; x <= 7; x++) setM(g, x, 10, B);
  setM(g, 4, 9, S); // 手
  setM(g, 6, 9, W); // 衣領
  for (let x = 5; x <= 7; x++) setM(g, x, 11, B);
  // 腳
  setM(g, 5, 12, P); setM(g, 6, 12, P);
  setM(g, 5, 13, P); setM(g, 6, 13, P);
  setM(g, 5, 14, K); setM(g, 6, 14, K);
  outline(g, K);
}

const BUILDERS = {
  fire(g) { body(g, '#ff8a3d', '#b94a18'); eyes(g); setM(g, 7, 2, '#ffe14d'); setM(g, 7, 1, '#ff5b3d'); setM(g, 6, 3, '#ffb24d'); feet(g, '#b94a18'); },
  water(g) { body(g, '#4db6ff', '#1e6fb0'); eyes(g, { ey: 7 }); setM(g, 4, 10, '#bfe9ff'); feet(g, '#1e6fb0'); },
  grass(g) { body(g, '#5fcf6b', '#2c8b3a'); eyes(g); setM(g, 8, 2, '#2c8b3a'); setM(g, 8, 1, '#7be08a'); set(g, 8, 0, '#7be08a'); feet(g, '#2c8b3a'); },
  electric(g) { body(g, '#ffd84d', '#c79612'); setM(g, 4, 2, '#ffd84d'); setM(g, 4, 1, '#c79612'); setM(g, 3, 3, '#ffd84d'); eyes(g); setM(g, 4, 10, '#ff7a7a'); feet(g, '#c79612'); },
  dragon(g) { body(g, '#9b7bff', '#5a3fb0'); setM(g, 5, 2, '#c9b8ff'); setM(g, 5, 1, '#5a3fb0'); eyes(g); setM(g, 12, 8, '#9b7bff'); setM(g, 13, 9, '#5a3fb0'); feet(g, '#5a3fb0'); },
  ghost(g) { body(g, '#cdbcff', '#7a66c4', { cy: 8 }); for (let x = 0; x < GRID; x++) for (let y = 12; y < GRID; y++) if (g[y][x] && x % 3 === 0) g[y][x] = null; eyes(g, { ey: 7, p: '#4a3a8a' }); },
  owl(g) { body(g, '#b07a45', '#7a4e22'); setM(g, 4, 2, '#b07a45'); setM(g, 4, 1, '#7a4e22'); setM(g, 5, 7, '#fff'); setM(g, 5, 8, '#fff'); setM(g, 6, 7, '#7a4e22'); set(g, 7, 8, '#ff9b2d'); set(g, 8, 8, '#ff9b2d'); feet(g, '#ff9b2d'); },
  turtle(g) { body(g, '#67c06a', '#2f7c3a'); setM(g, 5, 7, '#3f9648'); setM(g, 7, 9, '#3f9648'); eyes(g, { ey: 11 }); feet(g, '#2f7c3a'); },
  trainer,
};

function toSVG(g) {
  let rects = '';
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    if (g[y][x]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${g[y][x]}"/>`;
  }
  return `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" class="px-sprite">${rects}</svg>`;
}

// 預先生成所有精靈的 SVG
const CACHE = {};
for (const id of Object.keys(BUILDERS)) {
  const g = mk();
  BUILDERS[id](g);
  CACHE[id] = toSVG(g);
}

export function spriteSVG(id) {
  return CACHE[id] || CACHE.fire;
}

// 精靈圖鑑：id 對應像素圖 + 中文名
export const MONSTERS = [
  { id: 'fire', n: '火尾蜥' },
  { id: 'water', n: '水泡蛙' },
  { id: 'grass', n: '草苗獸' },
  { id: 'electric', n: '電氣鼠' },
  { id: 'dragon', n: '小飛龍' },
  { id: 'ghost', n: '幽靈球' },
  { id: 'owl', n: '智慧鴞' },
  { id: 'turtle', n: '盾甲龜' },
];

export function randomMonster() {
  return MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
}
