import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs";

console.log("parser.js v0.4 module loaded");

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";

function normalizeText(t) {
  // 1) 把各種空白（含全形、換行）壓成單一空格，方便正規表示式處理
  t = t.replace(/\s+/g, " ").trim();

  // 2) 把日期中的星期括號內容正規化：112-02-05( ⽇ ) -> 112-02-05(日)
  // 你的 PDF 會把「日/一/二…」變成一些類似 ⽇ ⼀ ⼆ 的字，這裡直接用「抓括號內任意單字」來吃掉
  t = t.replace(/(112-\d{2}-\d{2})\(\s*([^)])\s*\)/g, "$1($2)");

  return t;
}

function splitDayBlocks(t) {
  // 以每一天的日期起頭切段
  const re = /112-\d{2}-\d{2}\([^\)]\)/g;
  const m = [...t.matchAll(re)];
  const blocks = [];

  for (let i = 0; i < m.length; i++) {
    const start = m[i].index;
    const end = (i + 1 < m.length) ? m[i + 1].index : t.length;
    blocks.push(t.slice(start, end).trim());
  }
  return blocks;
}

function parseDay(block) {
  // 日期
  const date = (block.match(/112-\d{2}-\d{2}\([^\)]\)/) || [null])[0];

  // 狀態：正常 / 調整放假 / 和平紀念日 / 補行上班 等
  const status =
    (block.match(/正常|調整放假|和平紀念日|補行上班|刷卡不一致|開國紀念日|小年夜|除夕|初一|初二|初三|補假/g) || [null])[0];

  // 出勤時數（通常在「正常 8」那個 8）
  let workHours = null;
  const hm = block.match(/\b(正常)\s+(\d+(?:\.\d+)?)\b/);
  if (hm) workHours = Number(hm[2]);

  // 上下班卡：抓最前面兩個 HH:MM（對空白日會抓不到）
  const times = block.match(/\b\d{2}:\d{2}\b/g) || [];
  const clockIn = times[0] || null;
  const clockOut = times[1] || null;

  // 加班區段：一般加班 (112-02-17(五) 06:00 ~ 112-02-17(五) 08:00)
  const overtime = [];
  const otRe = /一般加班\s*\([^)]*?\b(\d{2}:\d{2})\b\s*~\s*[^)]*?\b(\d{2}:\d{2})\b\)/g;
  for (const m of block.matchAll(otRe)) {
    overtime.push({ start: m[1], end: m[2] });
  }

  return { date, status, clockIn, clockOut, workHours, overtime, raw: block };
}

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
      let text = await extractAllText(buf);

      // Step 2：正規化 → 切日 → 解析
      text = normalizeText(text);

      const blocks = splitDayBlocks(text);
      const days = blocks.map(parseDay);

      // 顯示前 10 筆讓你確認
      raw.value = JSON.stringify(days.slice(0, 10), null, 2);
      status.textContent = `完成：共解析 ${days.length} 天（前 10 筆已顯示在下方）`;

      console.log("days:", days);
    } catch (e) {
      console.error(e);
      status.textContent = "失敗：" + (e?.message || e);
      alert("解析失敗，請看 Console");
    }
  });
});
