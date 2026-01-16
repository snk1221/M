console.log("parser.js v0.2 loaded");

if (typeof pdfjsLib === "undefined") {
  console.error("pdfjsLib is undefined：pdf.js 沒有載入成功或載入順序錯");
  alert("pdf.js 沒載入成功：請確認 index.html 先載入 pdf.min.js 再載入 parser.js");
  throw new Error("pdfjsLib is undefined");
}

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.js";

console.log("parser.js V0.1 loaded OK");

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM ready");

  const fileInput = document.getElementById("file");
  const btn = document.getElementById("btn");
  const status = document.getElementById("status");
  const raw = document.getElementById("raw");

  btn.addEventListener("click", async () => {
    if (!fileInput.files.length) {
      alert("還沒選 PDF");
      return;
    }

    const file = fileInput.files[0];
    status.textContent = "讀取 PDF 中…";

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

      let text = "";
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        text += content.items.map(i => i.str).join("\n") + "\n";
      }

      raw.value = text.slice(0, 4000);
      status.textContent = `完成：${pdf.numPages} 頁，${text.length} 字`;

      console.log("PDF 解析完成");
    } catch (e) {
      console.error(e);
      status.textContent = "解析失敗：" + e.message;
      alert("PDF 解析失敗，請看 Console");
    }
  });
});
