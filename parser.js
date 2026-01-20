/* ==============================
 *  parser.js  v1.2 (clean)
 * ============================== */

import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs";

console.log("parser.js v1.21 loaded");

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";

/* ==============================
 * 全域設定（可調參數）
 * ============================== */
let settings = {
  monthSalary: 37500,
  monthDays: 30,
  dayHours: 8,

  otRate1: 1.34,   // 平日前 2 小時
  otRate2: 1.67,   // 平日後續

  holidayRate1: 2.0,
  holidayRate2: 2.67
};

/* ==============================
 * PDF 讀取
 * ============================== */
async function extractAllText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(i => i.str).join("\n") + "\n";
  }
  return text;
}

/* ==============================
 * 工具：星期字修正
 * ============================== */
function normalizeWeekday(ch) {
  const map = {
    "⽇": "日", "⼀": "一", "⼆": "二",
    "三": "三", "四": "四", "五": "五", "六": "六"
  };
  return map[ch] || ch;
}

/* ==============================
 * 將日期切為每日區塊
 * ============================== */
function splitByDate(text) {
  text = text.replace(
    /(^|[^\(])\s*(\d{3}-\d{2}-\d{2}\([^)]+\))/g,
    (m, p1, p2) => `${p1}\n${p2}`
  );

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const blocks = [];
  let buf = [];

  const dateRe = /^\d{3}-\d{2}-\d{2}\([^)]+\)/;

  for (const line of lines) {
    if (dateRe.test(line)) {
      if (buf.length) blocks.push(buf.join(" | "));
      buf = [line];
    } else if (buf.length) {
      buf.push(line);
    }
  }
  if (buf.length) blocks.push(buf.join(" | "));
  return blocks;
}

/* ==============================
 * 解析單日資料
 * ============================== */
function parseDay(block) {
  const dateM = block.match(/^(\d{3}-\d{2}-\d{2})\((.)\)/);
  const date = dateM
    ? `${dateM[1]}(${normalizeWeekday(dateM[2])})`
    : null;

  const status =
    (block.match(/正常|差假|補\s*行\s*上班|調整放假|刷卡不一致|小年夜|除夕|初一|初二|初三/g) || [null])[0];

  let clockIn = null;
  let clockOut = null;

  const cardIn = block.match(/\(上\)\s*(\d{2}:\d{2})/);
  const cardOut = block.match(/\(下\)\s*(\d{2}:\d{2})/);

  if (cardIn) clockIn = cardIn[1];
  if (cardOut) clockOut = cardOut[1];

  if (!clockIn || !clockOut) {
    const times = block.match(/\b\d{2}:\d{2}\b/g) || [];
    clockIn = clockIn || times[0] || null;
    clockOut = clockOut || times[times.length - 1] || null;
  }

  let workHours = null;
  const wh = block.match(/正常\s+(\d+)/);
  if (wh) workHours = Number(wh[1]);

  return {
    date,
    status,
    clockIn,
    clockOut,
    workHours,
    raw: block
  };
}

/* ==============================
 * 薪資換算
 * ============================== */
function calcBaseSalary() {
  const daySalary = settings.monthSalary / settings.monthDays;
  const hourSalary = daySalary / settings.dayHours;

  return {
    month: settings.monthSalary,
    day: Math.round(daySalary),
    hour: Number(hourSalary.toFixed(2)),
    ot1: Number((hourSalary * settings.otRate1).toFixed(2)),
    ot2: Number((hourSalary * settings.otRate2).toFixed(2))
  };
}

/* ==============================
 * 顯示薪資結果
 * ============================== */
function renderSalaryResult() {
  const r = calcBaseSalary();
  const el = document.getElementById("salaryResult");

  el.innerHTML = `
<b>【基本薪資】</b><br>
月薪：約 ${r.month} 元<br>
日薪：約 ${r.day} 元<br>
時薪：約 ${r.hour} 元<br><br>

<b>【加班時薪（平日）】</b><br>
前 2 小時：${r.ot1} 元 / 小時<br>
後續時數：${r.ot2} 元 / 小時<br><br>

※ 目前為「單價試算」，尚未套用 PDF 工時
`;
}

/* ==============================
 * DOM 綁定
 * ============================== */
document.addEventListener("DOMContentLoaded", () => {

  /* 套用參數 */
  document.getElementById("btnApplySettings")
    .addEventListener("click", () => {

      settings.monthSalary =
        Number(document.getElementById("setMonthSalary").value);
      settings.monthDays =
        Number(document.getElementById("setMonthDays").value);
      settings.dayHours =
        Number(document.getElementById("setDayHours").value);
      settings.otRate1 =
        Number(document.getElementById("setOTRate1").value);
      settings.otRate2 =
        Number(document.getElementById("setOTRate2").value);

      alert("參數已套用");
    });

  /* PDF 解析 */
  document.getElementById("btn").addEventListener("click", async () => {
    const fileInput = document.getElementById("file");
    if (!fileInput.files.length) return alert("請選擇 PDF");

    const status = document.getElementById("status");
    const raw = document.getElementById("raw");

    status.textContent = "解析中…";
    raw.value = "";

    const buf = await fileInput.files[0].arrayBuffer();
    const text = await extractAllText(buf);
    const blocks = splitByDate(text);
    const days = blocks.map(parseDay);

    raw.value = JSON.stringify(days.slice(0, 12), null, 2);
    status.textContent = `完成：共 ${days.length} 天（顯示前 12 筆）`;

    console.log("days =", days);
  });

  /* 薪資試算 */
  document.getElementById("btnCalcSalary")
    .addEventListener("click", renderSalaryResult);
});
