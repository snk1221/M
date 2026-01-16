import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs";

console.log("parser.js v0.31 module loaded");

// worker (mjs 版本)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";

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
    status.textContent = `讀取 PDF 中… (${file.name})`;
    raw.value = "";

    try {
      const buffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: buffer });

      loadingTask.onProgress = (p) => {
        if (p && p.total) status.textContent = `載入中… ${Math.round((p.loaded / p.total) * 100)}%`;
      };

      const pdf = await loadingTask.promise;

      let text = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        status.textContent = `解析第 ${pageNum}/${pdf.numPages} 頁…`;
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        text += content.items.map(i => i.str).join("\n") + "\n";
      }

      raw.value = text.slice(0, 4000);
      status.textContent = `完成：${pdf.numPages} 頁，${text.length} 字`;
      console.log("PDF 解析完成");
    } catch (e) {
      console.error(e);
      status.textContent = "解析失敗：" + (e?.message || e);
      alert("PDF 解析失敗，請看 Console");
    }
  });
});
