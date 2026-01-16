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
