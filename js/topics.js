/**
 * topics.js — 數學大冒險的「道館」（課題）
 * 只保留兩個課題：分數計算、分數應用題。
 * 內容取材自「五年級下學期數學科・總結性評估（六）」。
 */

export const TOPICS = [
  {
    id: 'fraction-calc',
    name: '分數計算',
    gym: '分數道館',
    icon: '➗',
    leader: 'dragon',
    blurb: '分數乘整數、連加減、四則混合與括號運算',
    objectives: [
      '分數乘以整數，並化成最簡分數或帶分數',
      '同分母及異分母分數的加減',
      '四則混合運算的先後次序（先乘除、後加減，括號優先）',
    ],
    samples: ['4 × 6/7', '3/4 − 1/6', '2/3 + 1/5 × 10', '(3/4 + 1/2) × 8'],
    answerType: 'short',
  },
  {
    id: 'word-problem',
    name: '分數應用題',
    gym: '應用題道館',
    icon: '📝',
    leader: 'owl',
    blurb: '重量、人數、分數增減的文字題',
    objectives: [
      '用分數表示「佔全部的幾分之幾」並求數量',
      '「比原來增加 1/5」這類分數增減問題',
      '列出算式並計算，答案要寫單位',
    ],
    samples: [
      '6 個茶包共重 27 克，5 個茶包共重多少克？',
      '五年級有 144 人，參加植樹的佔 5/8，沒有參加的有多少人？',
      '油畫班去年 35 人，今年增加了 1/5，今年有多少人？',
    ],
    answerType: 'short',
    theme: true, // 題目情境可圍繞精靈訓練員的冒險，增加趣味
  },
];

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
