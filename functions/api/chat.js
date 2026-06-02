/**
 * functions/api/chat.js
 * Cloudflare Pages Function — Qwen API 代理
 *
 * 金鑰優先用前端傳入的 apiKey，其次用環境變量 QWEN_API_KEY。
 * 設定後備金鑰： wrangler pages secret put QWEN_API_KEY --project-name p5-math-revision
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { messages, apiKey: clientKey, temperature, json_mode } = body;

    const apiKey = (clientKey && clientKey.trim()) || env.QWEN_API_KEY;
    if (!apiKey) return json({ error: '請先在設定中輸入 Qwen API Key' }, 400);
    if (!messages || !Array.isArray(messages)) return json({ error: '無效的請求格式' }, 400);

    const payload = {
      model: 'qwen-plus',
      messages,
      max_tokens: 900,
      temperature: typeof temperature === 'number' ? temperature : 0.7,
      top_p: 0.9,
    };
    // 要求 JSON 物件輸出（適性出題／批改用）
    if (json_mode) payload.response_format = { type: 'json_object' };

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);

    let resp;
    try {
      resp = await fetch(
        'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
        {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );
    } finally {
      clearTimeout(t);
    }

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Qwen API error:', resp.status, errText);
      return json({ error: `Qwen API 錯誤 (${resp.status})` }, 502);
    }

    const data = await resp.json();
    return json(data);
  } catch (err) {
    console.error('Function error:', err);
    const isTimeout = err.name === 'AbortError';
    return json({ error: isTimeout ? 'Qwen API 請求超時，請再試一次' : '伺服器內部錯誤' }, isTimeout ? 504 : 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
