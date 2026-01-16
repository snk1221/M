console.log("parser.js v0.3 loaded");

// 1) 保險：確認 pdf.js 已載入
if (typeof pdfjsLib === "undefined") {
  console.error("pdfjsLib is undefined：pdf.js 沒載入成功或載入順序錯");
  alert("pdf.js 沒載入成功：請確認 index.html 先載入 pdf.min.js 再載入 parser.js");
  throw new Error("pdfjsLib is undefined");
}

// 2) 正式設定 worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM ready");

  const fileInput = document.getElementById("file");
  const btn = document.getElementById("btn");
  const status = document.getElementById("status");
  const raw = document.getElementById("raw");

  if (!fileInput || !btn || !status || !raw) {
    console.error("找不到必要的 DOM 元素", { fileInput, btn, status, raw });
    alert("HTML 的 id 可能不一致（file/btn/status/raw）請看 Console");
    return;
  }

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

      // 3) 額外監控：如果 PDF 讀取階段就卡住，這裡能看到進度
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
