import * as pdfjsLib from
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";

console.log("parser.js v1.23 baseline loaded");

const $ = id => document.getElementById(id);
let days = [];

/* ================== 基本工具 ================== */

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function normalizeWeekdayChar(ch) {
  return { "⽇":"日","⼀":"一","⼆":"二" }[ch] || ch;
}

/* ================== 讀 PDF ================== */

async function extractText(buf) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const c = await p.getTextContent();
    out += c.items.map(x => x.str).join("\n") + "\n";
  }
  return out;
}

function injectDateNewline(t) {
  return t.replace(
    /(^|[^\(])\s*(1\d{2}-\d{2}-\d{2}\([^)]+\))/g,
    (m,p1,p2)=>`${p1}\n${p2}`
  );
}

function splitDays(t) {
  const lines = t.split(/\n/).map(l=>l.trim()).filter(Boolean);
  const re = /^1\d{2}-\d{2}-\d{2}\([^)]+\)/;
  const blocks = [];
  let cur = [];
  for (const l of lines) {
    if (re.test(l)) {
      if (cur.length) blocks.push(cur.join(" "));
      cur = [l];
    } else if (cur.length) cur.push(l);
  }
  if (cur.length) blocks.push(cur.join(" "));
  return blocks;
}

/* ================== 解析每日 ================== */

function parseOvertimeRanges(text) {
  const out = [];
  const re =
    /一\s*般\s*加\s*班\s*\([^)]*?(\d{2}:\d{2})\s*~\s*[^)]*?(\d{2}:\d{2})\)/g;
  for (const m of text.matchAll(re)) {
    out.push({ start: m[1], end: m[2] });
  }
  return out;
}

function parseDay(block) {
  const dm = block.match(/^(1\d{2}-\d{2}-\d{2})\(([^)]+)\)/);
  const date = dm ? `${dm[1]}(${normalizeWeekdayChar(dm[2][0])})` : null;

  const status =
    (block.match(/正常|差假|補行上班|調整放假|刷卡不一致|小年夜|除夕|初一|初二|初三/g)||[null])[0];

  let clockIn = null, clockOut = null;
  const ci = block.match(/\(上\)\s*(\d{2}:\d{2})/);
  const co = block.match(/\(下\)\s*(\d{2}:\d{2})/);
  if (ci) clockIn = ci[1];
  if (co) clockOut = co[1];

  if (!clockIn || !clockOut) {
    const t = block.match(/\b\d{2}:\d{2}\b/g)||[];
    clockIn ||= t[0]||null;
    clockOut ||= t[t.length-1]||null;
  }

  const whm = block.match(/正常\s+(\d+)/);
  const workHours = whm ? Number(whm[1]) : null;

  return {
    date,
    status,
    clockIn,
    clockOut,
    workHours,
    overtimeRanges: parseOvertimeRanges(block),
    raw: block
  };
}

/* ================== 薪資計算 ================== */

function settings() {
  return {
    monthHours: Number($("workHoursPerMonth").value),
    dayHours: Number($("workHoursPerDay").value),
    ot1: Number($("otRate1").value),
    ot2: Number($("otRate2").value)
  };
}

function calcBaseSalary() {
  const type = $("salaryType").value;
  const v = Number($("salaryValue").value);
  const s = settings();

  let month, day, hour;
  if (type === "month") {
    month = v;
    hour = month / s.monthHours;
    day = hour * s.dayHours;
  } else if (type === "day") {
    day = v;
    hour = day / s.dayHours;
    month = hour * s.monthHours;
  } else {
    hour = v;
    day = hour * s.dayHours;
    month = hour * s.monthHours;
  }

  return {
    month: Math.round(month),
    day: Math.round(day),
    hour: Number(hour.toFixed(2))
  };
}

function calcOT(day, hour) {
  let mins = 0, pay = 0;
  for (const r of day.overtimeRanges) {
    const m = timeToMinutes(r.end) - timeToMinutes(r.start);
    if (m <= 0) continue;
    let rem = m;
    const f = Math.min(120, rem);
    pay += (f/60)*hour*settings().ot1;
    rem -= f;
    if (rem>0) pay += (rem/60)*hour*settings().ot2;
    mins += m;
  }
  return { mins, pay };
}

/* ================== 事件 ================== */

$("btnParse").onclick = async () => {
  if (!$("file").files.length) return alert("請選 PDF");
  $("status").textContent = "解析中…";
  const buf = await $("file").files[0].arrayBuffer();
  let t = await extractText(buf);
  t = injectDateNewline(t);
  days = splitDays(t).map(parseDay);
  $("raw").value = JSON.stringify(days.slice(0,12), null, 2);
  $("status").textContent = `完成：共 ${days.length} 天`;
  console.log(days);
};

$("btnCalcBase").onclick = () => {
  const b = calcBaseSalary();
  $("baseResult").textContent =
`月薪：約 ${b.month}
日薪：約 ${b.day}
時薪：約 ${b.hour}

加班前2小時：${(b.hour*settings().ot1).toFixed(2)}
加班後：${(b.hour*settings().ot2).toFixed(2)}`;
};

$("btnCalcPDF").onclick = () => {
  if (!days.length) return alert("尚未解析 PDF");
  const base = calcBaseSalary();
  let totalPay = 0, totalMin = 0;

  for (const d of days) {
    const r = calcOT(d, base.hour);
    totalPay += r.pay;
    totalMin += r.mins;
  }

  $("pdfResult").textContent =
`加班時數：${(totalMin/60).toFixed(2)} 小時
加班費：${Math.round(totalPay)} 元

試算實領：
${base.month + Math.round(totalPay)} 元`;
};
