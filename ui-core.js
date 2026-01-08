// ui-core.js – core formatting + toast + openTab

(function () {
  const EVUI = (window.EVUI = window.EVUI || {});

  function fmtGBP(v) {
    const n = Number(v);
    if (!isFinite(n)) return "£0.00";
    return "£" + n.toFixed(2);
  }

  function fmtNum(v, digits = 1) {
    const n = Number(v);
    if (!isFinite(n)) return "0";
    return n.toFixed(digits);
  }

  function fmtDate(d) {
    return d || "";
  }

  function escapeHTML(s) {
    if (s == null) return "";
    return String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function toast(msg, kind = "info") {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "";
    el.classList.add("show", kind);
    setTimeout(() => el.classList.remove("show"), 1700);
  }

  // Universal tab opener – works even if your Summary tab is named "summ"
  function openTab(tabName) {
    const name = String(tabName || "").trim();
    if (!name) return false;

    // Prefer clicking the tab button if it exists
    const btn = document.querySelector(`.tabbtn[data-tab="${CSS.escape(name)}"]`);
    if (btn) {
      btn.click();
      return true;
    }

    // Fallback: force classes (if wiring is missing for some reason)
    const tabs = document.querySelectorAll(".tab");
    const btns = document.querySelectorAll(".tabbtn");

    if (!tabs.length || !btns.length) return false;

    tabs.forEach((t) => t.classList.toggle("active", t.id === name));
    btns.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    return true;
  }

  EVUI.fmtGBP = fmtGBP;
  EVUI.fmtNum = fmtNum;
  EVUI.fmtDate = fmtDate;
  EVUI.escapeHTML = escapeHTML;
  EVUI.toast = toast;
  EVUI.openTab = openTab;
})();