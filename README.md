# 小五數學溫習 AI（適性自主學習）

一個給香港小五學生的數學溫習網頁應用。以 **Qwen（通義千問）** 做 **適性出題、即時批改、提示與自由問答**，學生可自主學習；答對自動升難度、答錯放慢，進度存於瀏覽器。

題目取材自「五年級下學期數學科・總結性評估（六）」的課題範圍：

| 課題 | 內容 |
|------|------|
| 分數計算 | 分數乘整數、連加減、四則混合與括號 |
| 立體截面 | 圓錐／圓柱／角柱平行底面切開的截面形狀 |
| 頂點・稜・面 | 數立體圖形的頂點、稜、面數目 |
| 摺紙圖樣 | 判斷展開圖能否摺成指定立體 |
| 球與半徑 | 球心到球面距離（半徑）的概念 |
| 分數應用題 | 重量、人數、分數增減的文字題 |

## 技術

- 純靜態前端（HTML / CSS / 原生 ES Module），無建置步驟
- Cloudflare Pages Functions：`functions/api/chat.js` 代理 Qwen API（DashScope 相容模式）
- API Key：前端可在「設定」輸入（存 localStorage），或在 Cloudflare 設後備 secret

## 本機開發

```bash
npm install
# 在 .dev.vars 放入 QWEN_API_KEY=sk-xxxx
npm run dev      # http://localhost:8789
```

## 部署到 Cloudflare Pages

```bash
# 首次：設定後備金鑰（可選；學生也可自行在前端輸入）
wrangler pages secret put QWEN_API_KEY --project-name p5-math-revision

npm run deploy
```

## 適性（adaptive）邏輯

每個課題各自記錄難度 Lv.1–5：連續答對兩題升一級，答錯降一級，AI 依當前難度生成對應深淺的題目。
