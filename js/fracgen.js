/**
 * fracgen.js — 本地（離線）分數計算出題機
 * 直接在瀏覽器生成題目並算出正確答案，零等待、無限題、無格式問題。
 * 回傳格式與 AI 出題一致：{ question, answer, hint, solution }
 */

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class Fr {
  constructor(n, d = 1) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = n / g; this.d = d / g;
  }
  add(o) { return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Fr(this.n * o.n, this.d * o.d); }
  // 顯示成整數、最簡真／假分數
  str() { return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`; }
  // 假分數轉帶分數文字（供解說）
  mixed() {
    if (this.d === 1 || Math.abs(this.n) < this.d) return this.str();
    const w = Math.trunc(this.n / this.d), r = Math.abs(this.n % this.d);
    return r ? `${w} 又 ${r}/${this.d}` : `${w}`;
  }
}

const F = (n, d) => new Fr(n, d);
const HINTS = {
  same: '分母相同，分子直接相加減。',
  diff: '先找公分母（分母的最小公倍數），通分後再加減。',
  mul: '分子乘分子、分母乘分母，記得約簡。',
  order: '先算乘除，後算加減。',
  bracket: '先計括號裏面，再做乘除。',
};

// 隨機真分數（分子<分母）
function properFrac(maxDen = 8) {
  const d = ri(2, maxDen);
  return F(ri(1, d - 1), d);
}

function ansBlock(fr) {
  // 答案以最簡（整數或 a/b）為準；若為假分數，解說補上帶分數
  const a = fr.str();
  const note = (fr.d !== 1 && Math.abs(fr.n) > fr.d) ? `（即 ${fr.mixed()}）` : '';
  return { a, note };
}

function lvl1() { // 同分母加減
  const d = ri(3, 8);
  let a = ri(1, d - 1), b = ri(1, d - 1);
  const plus = Math.random() < 0.5;
  if (!plus && a < b) [a, b] = [b, a]; // 確保減後非負
  const x = F(a, d), y = F(b, d);
  const res = plus ? x.add(y) : x.sub(y);
  const { a: ans, note } = ansBlock(res);
  return {
    question: `${a}/${d} ${plus ? '＋' : '−'} ${b}/${d}`,
    answer: ans,
    hint: HINTS.same,
    solution: `分母相同：${a} ${plus ? '＋' : '−'} ${b} = ${plus ? a + b : a - b}\n答案 = ${ans} ${note}`.trim(),
  };
}

function lvl2() { // 異分母加減
  let x = properFrac(6), y = properFrac(6);
  const plus = Math.random() < 0.5;
  if (!plus) { // 確保非負
    if (x.n / x.d < y.n / y.d) [x, y] = [y, x];
  }
  const L = lcm(x.d, y.d);
  const nx = x.n * (L / x.d), ny = y.n * (L / y.d);
  const res = plus ? x.add(y) : x.sub(y);
  const { a: ans, note } = ansBlock(res);
  return {
    question: `${x.str()} ${plus ? '＋' : '−'} ${y.str()}`,
    answer: ans,
    hint: HINTS.diff,
    solution: `公分母是 ${L}\n${nx}/${L} ${plus ? '＋' : '−'} ${ny}/${L} = ${plus ? nx + ny : nx - ny}/${L}\n答案 = ${ans} ${note}`.trim(),
  };
}

function lvl3() { // 整數×分數 或 分數×分數
  if (Math.random() < 0.5) {
    const k = ri(2, 9), f = properFrac(8);
    const res = F(k, 1).mul(f);
    const { a: ans, note } = ansBlock(res);
    return {
      question: `${k} × ${f.str()}`,
      answer: ans,
      hint: HINTS.mul,
      solution: `${k} × ${f.n}/${f.d} = ${k * f.n}/${f.d}\n答案 = ${ans} ${note}`.trim(),
    };
  }
  const x = properFrac(6), y = properFrac(6);
  const res = x.mul(y);
  const { a: ans, note } = ansBlock(res);
  return {
    question: `${x.str()} × ${y.str()}`,
    answer: ans,
    hint: HINTS.mul,
    solution: `分子乘分子、分母乘分母：${x.n}×${y.n}/${x.d}×${y.d} = ${x.n * y.n}/${x.d * y.d}\n答案 = ${ans} ${note}`.trim(),
  };
}

function lvl4() { // 混合：a/b ＋ c/d × k（先乘後加）
  const x = properFrac(6), y = properFrac(6), k = ri(2, 5);
  const prod = y.mul(F(k, 1));
  const res = x.add(prod);
  const { a: ans, note } = ansBlock(res);
  return {
    question: `${x.str()} ＋ ${y.str()} × ${k}`,
    answer: ans,
    hint: HINTS.order,
    solution: `先乘：${y.str()} × ${k} = ${prod.str()}\n再加：${x.str()} ＋ ${prod.str()} = ${ans} ${note}`.trim(),
  };
}

function lvl5() { // 括號：(a/b ＋ c/d) × k
  const x = properFrac(6), y = properFrac(6), k = ri(2, 6);
  const sum = x.add(y);
  const res = sum.mul(F(k, 1));
  const { a: ans, note } = ansBlock(res);
  return {
    question: `(${x.str()} ＋ ${y.str()}) × ${k}`,
    answer: ans,
    hint: HINTS.bracket,
    solution: `先算括號：${x.str()} ＋ ${y.str()} = ${sum.str()}\n再乘：${sum.str()} × ${k} = ${ans} ${note}`.trim(),
  };
}

const BUILDERS = [lvl1, lvl1, lvl2, lvl3, lvl4, lvl5];

export function genFraction(difficulty = 2) {
  const d = Math.max(1, Math.min(5, difficulty | 0));
  return BUILDERS[d]();
}
