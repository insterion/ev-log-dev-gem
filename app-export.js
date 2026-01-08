// app-export.js – CSV export + backup/restore

(function () {
  const A = window.EVApp;
  const U = A.U;

  function csvEscape(value) {
    if (value == null) return "";
    const s = String(value);
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function downloadCSV(filename, csvText) {
    try {
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      U.toast("CSV exported", "good");
    } catch (e) {
      console.error("CSV download failed", e);
      U.toast("CSV export failed", "bad");
    }
  }

  function exportEntriesCSV() {
    if (!A.state.entries.length) return U.toast("No entries to export", "info");

    const header = ["Date", "kWh", "Type", "Price_per_kWh", "Cost", "Note"];

    const rows = A.state.entries
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((e) => {
        const cost = (e.kwh || 0) * (e.price || 0);
        return [
          csvEscape(e.date || ""),
          csvEscape(e.kwh != null ? e.kwh : ""),
          csvEscape(e.type || ""),
          csvEscape(e.price != null ? e.price : ""),
          csvEscape(cost),
          csvEscape(e.note || "")
        ].join(",");
      });

    const csv = [header.join(","), ...rows].join("\n");
    downloadCSV(`ev_log_entries_${A.todayISO()}.csv`, csv);
  }

  function exportCostsCSV() {
    if (!A.state.costs.length) return U.toast("No costs to export", "info");

    const header = ["Date", "Category", "Amount", "Note", "AppliesTo"];

    const rows = A.state.costs
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((c) => ([
        csvEscape(c.date || ""),
        csvEscape(c.category || ""),
        csvEscape(c.amount != null ? c.amount : ""),
        csvEscape(c.note || ""),
        csvEscape(c.applies || "other")
      ].join(",")));

    const csv = [header.join(","), ...rows].join("\n");
    downloadCSV(`ev_log_costs_${A.todayISO()}.csv`, csv);
  }

  function ensureExportButtons() {
    const logTable = A.$("logTable");
    if (logTable && !A.$("exportEntriesCsv")) {
      const btn = document.createElement("button");
      btn.id = "exportEntriesCsv";
      btn.textContent = "Export log CSV";
      btn.type = "button";
      btn.style.marginTop = "6px";
      btn.addEventListener("click", exportEntriesCSV);
      logTable.parentNode && logTable.parentNode.insertBefore(btn, logTable.nextSibling);
    }

    const costTable = A.$("costTable");
    if (costTable && !A.$("exportCostsCsv")) {
      const btn2 = document.createElement("button");
      btn2.id = "exportCostsCsv";
      btn2.textContent = "Export costs CSV";
      btn2.type = "button";
      btn2.style.marginTop = "6px";
      btn2.addEventListener("click", exportCostsCSV);
      costTable.parentNode && costTable.parentNode.insertBefore(btn2, costTable.nextSibling);
    }
  }

  async function exportBackup() {
    try {
      const backup = JSON.stringify(A.state);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(backup);
        U.toast("Backup copied to clipboard", "good");
      } else {
        window.prompt("Backup JSON (copy this):", backup);
        U.toast("Backup shown (copy manually)", "info");
      }
    } catch (e) {
      console.error(e);
      U.toast("Backup failed", "bad");
    }
  }

  function importBackup() {
    const raw = window.prompt("Paste backup JSON here. Current data will be replaced.");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);

      if (typeof parsed !== "object" || !parsed || !Array.isArray(parsed.entries) || !parsed.settings) {
        return U.toast("Invalid backup format", "bad");
      }

      A.state.entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      A.state.costs = Array.isArray(parsed.costs) ? parsed.costs : [];
      A.state.settings = Object.assign({}, A.state.settings, parsed.settings);

      if (!A.state.ui) A.state.ui = {};
      if (!A.state.ui.periodMode) A.state.ui.periodMode = "this-month";
      if (!A.state.ui.periodFrom) A.state.ui.periodFrom = "";
      if (!A.state.ui.periodTo) A.state.ui.periodTo = "";

      A.ensureCostAppliesDefaults();
      A.saveState();

      // refresh inputs + render
      window.EVApp.Init.syncSettingsToInputs();
      window.EVApp.Render.renderAll();
      window.EVApp.Actions.resetEditMode();
      window.EVApp.Actions.resetCostEditMode();

      U.toast("Backup restored", "good");
    } catch (e) {
      console.error(e);
      U.toast("Import failed", "bad");
    }
  }

  A.Export = {
    ensureExportButtons,
    exportBackup,
    importBackup
  };
})();
