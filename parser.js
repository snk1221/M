// parser.js (Step 1)
const $ = (id) => document.getElementById(id);

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.js";

async function extractAllText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let out = "";

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map(it => it.str);
    out += `\n--- page ${p} ---\n` + strings.join("\n") + "\n";
  }
  return out;
}

$("btn").addEventListener("click", async () => {
  const f = $("file").files?.[0];
  if (!f) return alert("請先選一個 PDF");

  $("status").textContent = "讀取中...";
  const buf = await f.arrayBuffer();

  try {
    const text = await extractAllText(buf);
    $("raw").value = text.slice(0, 4000);
    $("status").textContent = `完成：抽出 ${text.length} 字元`;
    console.log(text);
  } catch (e) {
    console.error(e);
    $("status").textContent = "失敗：" + (e?.message || e);
  }
});
