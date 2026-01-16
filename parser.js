import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs";

console.log("parser.js v1.12 baseline loaded");

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";

/* -------------------------
 *  PDF 讀取
 * ------------------------- */
async function extractAllText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let out = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map(i => i.str).join("\n") + "\n";
  }
  return out;
}

/* -------------------------
 *  工具
 * ------------------------- */
function normalizeWeekdayChar(ch) {
  const map = {
    "⽇": "日", "日": "日",
    "⼀": "一", "一": "一",
    "⼆": "二", "二": "二",
    "三": "三",
    "四": "四",
    "五": "五",
    "六": "六",
  };
  return map[ch] || ch;
}

/* 只在「非括號內」的日期前換行 */
function injectNewlineBeforeDates(text) {
  return text.replace(
    /(^|[^\(])\s*(\d{3}-\d{2}-\d{2}\s*\([^)]+\))/g,
    (m, p1, p2) => `${p1}\n${p2}`
  );
}

/* -------------------------
 *  切成「每天一段」
 * ------------------------- */
function splitDayBlocks(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const dayStartRe = /^\d{3}-\d{2}-\d{2}\([^)]+\)/;

  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (dayStartRe.test(line)) {
      if (current) blocks.push(current.join(" "));
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) blocks.push(current.join(" "));

  return blocks;
}

/* -------------------------
 *  解析「一天」
 * ------------------------- */
function parseDay(block) {
  /* 日期 */
  const dm = block.match(/^(\d{3}-\d{2}-\d{2})\(([^)]+)\)/);
  const date = dm
    ? `${dm[1]}(${normalizeWeekdayChar(dm[2].trim()[0])})`
    : null;

  /* 狀態 */
  const status =
    (block.match(
      /正常|補行上班|調整放假|刷卡不一致|差假|和平紀念日|開國紀念日|小年夜|除夕|初一|初二|初三/g
    ) || [null])[0];

  /* 刷卡時間（優先） */
  let clockIn = null;
  let clockOut = null;

  const cardIn = [...block.matchAll(/\(上\)\s*(\d{2}:\d{2})/g)];
  const cardOut = [...block.matchAll(/\(下\)\s*(\d{2}:\d{2})/g)];

  if (cardIn.length) clockIn = cardIn[0][1];
  if (cardOut.length) clockOut = cardOut[cardOut.length - 1][1];

  /* fallback：時間序 */
  if (!clockIn || !clockOut) {
    const times = block.match(/\b\d{2}:\d{2}\b/g) || [];
    if (!clockIn) clockIn = times[0] || null;
    if (!clockOut) clockOut = times[times.length - 1] || null;
  }

  /* 出勤時數 */
  let workHours = null;
  const wh = block.match(/正常\s+(\d+(?:\.\d+)?)/);
  if (wh) workHours = Number(wh[1]);

  /* 加班（先只抓，不計算） */
  const overtime = [];
  const otRe =
    /加班[:：]?\s*一\s*般\s*加\s*班\s*\([^)]*?\b(\d{2}:\d{2})\b\s*~\s*[^)]*?\b(\d{2}:\d{2})\b\)/g;

  for (const m of block.matchAll(otRe)) {
    overtime.push({ start: m[1], end: m[2] });
  }

  return {
    date,
    status,
    clockIn,
    clockOut,
    workHours,
    overtime,
    raw: block
  };
}

/* -------------------------
 *  DOM 綁定
 * ------------------------- */
document.addEventListener("DOMContentLoaded", () => {
const btnCalc = document.getElementById("btnCalc");
const salaryType = document.getElementById("salaryType");
const salaryAmount = document.getElementById("salaryAmount");
const calcResult = document.getElementById("calcResult");

btnCalc.addEventListener("click", () => {
  console.log("💰 計算被點擊");

  if (!window.days || !window.days.length) {
    alert("請先解析 PDF");
    return;
  }

  const type = salaryType.value;
  const amount = Number(salaryAmount.value);

  if (!amount || amount <= 0) {
    alert("請輸入正確的薪資金額");
    return;
  }

  /* ---------- 基本換算 ---------- */
  let monthSalary = 0;
  let daySalary = 0;
  let hourSalary = 0;

  if (type === "month") {
    monthSalary = amount;
    daySalary = monthSalary / 30;
    hourSalary = daySalary / 8;
  }

  if (type === "day") {
    daySalary = amount;
    monthSalary = daySalary * 30;
    hourSalary = daySalary / 8;
  }

  if (type === "hour") {
    hourSalary = amount;
    daySalary = hourSalary * 8;
    monthSalary = daySalary * 30;
  }

  /* ---------- 加班時薪 ---------- */
  const otHourFirst2 = hourSalary * 1.34;
  const otHourAfter2 = hourSalary * 1.67;

  /* ---------- 顯示結果 ---------- */
  calcResult.textContent =
`【薪資試算結果】

【基本薪資】
月薪：約 ${monthSalary.toFixed(0)} 元
日薪：約 ${daySalary.toFixed(0)} 元
時薪：約 ${hourSalary.toFixed(2)} 元

【加班時薪（平日）】
前 2 小時：${otHourFirst2.toFixed(2)} 元 / 小時
後 2 小時：${otHourAfter2.toFixed(2)} 元 / 小時

※ 目前僅為「單價試算」
※ 尚未套用 PDF 內實際加班時數
`;
});


  const fileInput = document.getElementById("file");
  const btn = document.getElementById("btn");
  const status = document.getElementById("status");
  const raw = document.getElementById("raw");

  btn.addEventListener("click", async () => {
    if (!fileInput.files.length) {
      alert("請先選擇 PDF");
      return;
    }

    try {
      const file = fileInput.files[0];
      status.textContent = `解析中：${file.name}`;
      raw.value = "";

      let text = await extractAllText(await file.arrayBuffer());
      text = injectNewlineBeforeDates(text);

      const blocks = splitDayBlocks(text);
      const days = blocks.map(parseDay);
      window.days = days;


      raw.value = JSON.stringify(days.slice(0, 12), null, 2);
      status.textContent = `完成：共 ${days.length} 天（顯示前 12 筆）`;

      console.log("days:", days);
    } catch (e) {
      console.error(e);
      status.textContent = "解析失敗";
      alert("解析失敗，請看 Console");
    }
  });
});
