import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs";

console.log("parser.js v0.52 module loaded");

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";

async function extractAllTextWithNewlines(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let out = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map(i => i.str).join("\n") + "\n";
  }
  return out;
}

// 把星期怪字映射成正常「一二三四五六日」
function normalizeWeekdayChar(ch) {
  const map = {
    "⽇": "日",
    "⼀": "一",
    "⼆": "二",
    "三": "三",
    "四": "四",
    "五": "五",
    "六": "六",
    "日": "日",
    "一": "一",
    "二": "二",
  };
  return map[ch] || ch;
}

function injectNewlineBeforeDates(text) {
  // 把所有 112-xx-xx( ? ) 前面強制插入換行（如果前面不是換行/開頭）
  // 這樣即使原本在同一行，也會被切成新段落
  return text.replace(/(?!^)\s*(112-\d{2}-\d{2}\s*\([^)]+\))/g, "\n$1");
}

function splitDayBlocksByLine(text) {
  // 1) 逐行
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  // 2) 找到「行首」日期（只要在行開頭出現，就當一天起點）
  const dayStartRe = /^112-\d{2}-\d{2}\([^)]+\)/;

  const blocks = [];
  let cur = [];

  for (const line of lines) {
    if (dayStartRe.test(line)) {
      if (cur.length) blocks.push(cur.join(" "));
      cur = [line];
    } else {
      // 同一天的內容持續累積（加班括號內的日期不在行首，這裡就不會切開）
      if (cur.length) cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur.join(" "));

  return blocks;
}

function parseDay(block) {
  // 抓日期（只抓第一個）
  const dateM = block.match(/^(112-\d{2}-\d{2})\(([^)]+)\)/);
  const date = dateM ? `${dateM[1]}(${normalizeWeekdayChar(dateM[2].trim()[0])})` : null;

  // 狀態
  const status =
    (block.match(/正常|調整放假|和平紀念日|補行上班|刷卡不一致|開國紀念日|小年夜|除夕|初一|初二|初三|補假/g) || [null])[0];

  // 上下班卡：抓「最前面」出現的兩個 HH:MM（通常就是上/下班）
  //const times = block.match(/\b\d{2}:\d{2}\b/g) || [];
  //const clockIn = times[0] || null;
  //const clockOut = times[1] || null;
let clockIn = null;
let clockOut = null;

// 優先用刷卡資料
const cardIn = block.match(/\(上\)\s*(\d{2}:\d{2})/);
const cardOut = block.match(/\(下\)\s*(\d{2}:\d{2})/);

if (cardIn) clockIn = cardIn[1];
if (cardOut) clockOut = cardOut[1];

// 若沒有刷卡，再退回用時間順序
if (!clockIn || !clockOut) {
  const times = block.match(/\b\d{2}:\d{2}\b/g) || [];
  clockIn = clockIn || times[0] || null;
  clockOut = clockOut || times[times.length - 1] || null;
}

  
  // 出勤時數：抓「正常 後面的數字」
  let workHours = null;
  const wh = block.match(/正常\s+(\d+(?:\.\d+)?)/);
  if (wh) workHours = Number(wh[1]);

 // 加班區段：允許「一 般 加 班」中間有空白/怪字
  const overtime = [];
  const otRe =
  /加班[:：]?\s*一\s*般\s*加\s*班\s*\([^)]*?\b(\d{2}:\d{2})\b\s*~\s*[^)]*?\b(\d{2}:\d{2})\b\)/g;


  for (const m of block.matchAll(otRe)) {
  overtime.push({ start: m[1], end: m[2] });
}


  return { date, status, clockIn, clockOut, workHours, overtime, raw: block };
}

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file");
  const btn = document.getElementById("btn");
  const status = document.getElementById("status");
  const raw = document.getElementById("raw");

  btn.addEventListener("click", async () => {
    if (!fileInput.files.length) return alert("還沒選 PDF");
    const file = fileInput.files[0];

    try {
      status.textContent = `讀取中… (${file.name})`;
      raw.value = "";

      const buf = await file.arrayBuffer();
      //const text = await extractAllTextWithNewlines(buf);

      // 用「行首日期」切段，避免加班括號內日期干擾
      //const blocks = splitDayBlocksByLine(text);
      let text = await extractAllTextWithNewlines(buf);
      text = injectNewlineBeforeDates(text);   // ✅ 先把日期變成行首
      const blocks = splitDayBlocksByLine(text);

      const days = blocks.map(parseDay);

      raw.value = JSON.stringify(days.slice(0, 12), null, 2);
      status.textContent = `完成：共解析 ${days.length} 天（前 12 筆已顯示在下方）`;

      console.log("days:", days);
    } catch (e) {
      console.error(e);
      status.textContent = "失敗：" + (e?.message || e);
      alert("解析失敗，請看 Console");
    }
  });
});
