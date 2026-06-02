/**
 * ai.js — 與 Qwen 對話的封裝（適性出題、批改、提示、自由問答）
 */

const API = '/api/chat';

function getKey() {
  return (localStorage.getItem('qwen_api_key') || '').trim();
}

async function callQwen(messages, { temperature = 0.7, json_mode = false } = {}) {
  const resp = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, temperature, json_mode, apiKey: getKey() }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `伺服器錯誤 (${resp.status})`);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 沒有回覆，請再試一次');
  return content;
}

// 移除 JSON 字串中不合法的反斜線轉義（如 LaTeX \frac、\( 會令 JSON.parse 失敗）
function sanitizeEscapes(s) {
  return s.replace(/\\(?![\\"/bfnrtu])/g, '');
}

// 把字串值內的「裸控制字元」（真換行/Tab）轉成合法轉義，避免 JSON.parse 報錯
function escapeRawControls(s) {
  let out = '', inStr = false, esc = false;
  for (const ch of s) {
    if (esc) { out += ch; esc = false; continue; }
    if (ch === '\\') { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr) {
      const code = ch.charCodeAt(0);
      if (code < 0x20) { out += ({ 10: '\\n', 13: '\\r', 9: '\\t' }[code]) || ' '; continue; }
    }
    out += ch;
  }
  return out;
}

// 去掉物件／陣列尾端多餘逗號
function stripTrailingCommas(s) {
  return s.replace(/,(\s*[}\]])/g, '$1');
}

// 容錯地從文字中抽出 JSON 物件（多重清理後逐一嘗試）
function parseJSON(text) {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''); // 去掉 ``` 圍欄
  const m = t.match(/\{[\s\S]*\}/);                              // 只取第一個 {...}
  if (m) t = m[0];

  const candidates = [
    t,
    escapeRawControls(t),
    sanitizeEscapes(escapeRawControls(t)),
    stripTrailingCommas(sanitizeEscapes(escapeRawControls(t))),
  ];
  for (const cand of candidates) {
    try { return JSON.parse(cand); } catch { /* try next */ }
  }
  throw new Error('AI 回覆格式不正確，請再試一次');
}

// 呼叫 Qwen 並解析 JSON；失敗時自動重試（預設多試 1 次）
async function callQwenJSON(messages, opts = {}, retries = 1) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const text = await callQwen(messages, { json_mode: true, ...opts });
      return parseJSON(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

const DIFF_WORDS = ['', '很基礎', '基礎', '中等', '稍具挑戰', '挑戰'];

/**
 * 適性出題：依課題與難度（1–5）生成一條全新題目。
 */
export async function generateQuestion(topic, difficulty) {
  const level = DIFF_WORDS[difficulty] || '中等';
  const sys =
    '你是一位香港小學五年級數學老師，使用繁體中文（香港用語）。' +
    '請依指定課題與難度，出一條全新、適合小五程度的題目。' +
    '只輸出 JSON 物件，不要任何多餘文字。' +
    '【重要】所有數式用純文字書寫，切勿使用 LaTeX 或 \\frac、\\(、$ 等符號：' +
    '分數寫成 a/b（例 3/4），帶分數寫成「2 又 1/3」，運算符號用 ×、÷、−、＋。' +
    '【寫法】對象是小學生：題目和解說要短、用字淺白，每個步驟一行（用 \\n 分行），' +
    'hint 一句就夠，solution 最多 3 步、總共少於 60 字。';

  let formatHint;
  if (topic.answerType === 'mc') {
    formatHint =
      `題型為選擇題，學生只會在以下選項中選一個：${JSON.stringify(topic.choices)}。` +
      'JSON 欄位：{"question":"題目","choices":["可以","不可以"],"answer":"正確選項","hint":"一句提示","solution":"完整解說"}';
  } else {
    formatHint =
      '題型為短答題，學生會輸入一個答案（分數可寫成 a/b，帶分數寫成 a b/c，數量要含單位視乎題目）。' +
      'JSON 欄位：{"question":"題目","answer":"標準答案","hint":"一句提示","solution":"逐步解說"}';
  }

  const user =
    `課題：${topic.name}\n` +
    `課題說明：${topic.blurb}\n` +
    `學習重點：${topic.objectives.join('；')}\n` +
    `參考例題（請勿照抄，要出新的）：${topic.samples.join(' / ')}\n` +
    `難度：第 ${difficulty} 級（${level}）。難度越高，數字越複雜或步驟越多。\n` +
    (topic.theme
      ? '題目情境請圍繞「精靈訓練員的冒險」（例如捉精靈、精靈球、道館、徽章、樹果），令小學生覺得有趣。\n'
      : '') +
    formatHint;

  const q = await callQwenJSON(
    [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    { temperature: 0.9 }
  );
  if (!q.question) throw new Error('AI 未能出題，請再試一次');
  return q;
}

/**
 * 批改：判斷學生答案是否正確，並給回饋。
 */
export async function gradeAnswer(topic, question, studentAnswer) {
  const sys =
    '你是一位溫和而嚴謹的香港小五數學老師，使用繁體中文（香港用語）。' +
    '請批改學生的答案，只輸出 JSON 物件。' +
    'JSON 欄位：{"correct":true 或 false,"feedback":"親切具體的回饋，指出對或錯在哪裡","solution":"正確的逐步解法"}。' +
    '答案在數學上等值即當作正確（例如 1/2 與 0.5、3/6；2 1/2 與 5/2）。' +
    '所有數式用純文字（分數寫成 a/b），切勿使用 LaTeX 或 \\frac、$ 等符號。' +
    '【寫法】對象是小學生：feedback 用一兩句淺白說話、語氣鼓勵；' +
    'solution 最多 3 步、每步一行（\\n 分行）、總共少於 60 字。';
  const user =
    `課題：${topic.name}\n題目：${question.question}\n標準答案：${question.answer || '（見解說）'}\n` +
    `學生的答案：${studentAnswer}`;

  const r = await callQwenJSON(
    [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    { temperature: 0.2 }
  );
  return {
    correct: !!r.correct,
    feedback: r.feedback || (r.correct ? '答對了！' : '答案不正確。'),
    solution: r.solution || question.solution || '',
  };
}

/**
 * 自由問答：學生向 AI 老師發問（自主學習）。回傳純文字。
 */
export async function askTutor(history, topicName) {
  const sys =
    '你是一位耐心的香港小學五年級數學老師，使用繁體中文（香港用語）。' +
    '用淺白、鼓勵的語氣解釋概念，多用例子和分步說明，避免直接給最終答案前先引導學生思考。' +
    (topicName ? `學生現正溫習的課題是「${topicName}」。` : '') +
    '所有數式用純文字（分數寫成 a/b），切勿使用 LaTeX 或 \\frac、$ 等符號。' +
    '【寫法】對象是小學生：用最淺白的字、短句、可分行，整個回覆少於 80 字。';
  return callQwen([{ role: 'system', content: sys }, ...history], { temperature: 0.7 });
}

export function hasKey() {
  return !!getKey();
}
