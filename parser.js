console.log("parser.js loaded OK");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM ready");

  const file = document.getElementById("file");
  const btn = document.getElementById("btn");
  const status = document.getElementById("status");

  if (!file || !btn || !status) {
    console.error("找不到 DOM 元素", { file, btn, status });
    alert("HTML 元素 id 對不上，請看 Console");
    return;
  }

  btn.addEventListener("click", () => {
    if (!file.files.length) {
      alert("還沒選 PDF");
      return;
    }
    status.textContent = "已選檔：" + file.files[0].name;
    console.log("選到檔案", file.files[0]);
  });
});
