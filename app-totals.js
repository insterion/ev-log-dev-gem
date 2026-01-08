// app-totals.js – maintenance + insurance totals and small render helpers

(function () {
  const A = window.EVApp;
  const U = A.U;

  function computeMaintenanceTotals() {
    const costs = A.state.costs || [];
    let evOnly = 0, iceOnly = 0, both = 0, other = 0;

    for (const c of costs) {
      if (!c) continue;
      const amount = Number(c.amount ?? 0) || 0;
      if (!amount) continue;

      const a = (c.applies || "other").toLowerCase();
      if (a === "ev") evOnly += amount;
      else if (a === "ice") iceOnly += amount;
      else if (a === "both") both += amount;
      else other += amount;
    }

    return {
      ev: evOnly + both,
      ice: iceOnly + both,
      both,
      other,
      total: evOnly + iceOnly + both + other
    };
  }

  function computeInsuranceTotals() {
    const costs = A.state.costs || [];
    let evOnly = 0, iceOnly = 0, both = 0, other = 0;

    for (const c of costs) {
      if (!c) continue;
      const amount = Number(c.amount ?? 0) || 0;
      if (!amount) continue;

      const cat = String(c.category || "").toLowerCase();
      if (cat !== "insurance") continue;

      const a = (c.applies || "other").toLowerCase();
      if (a === "ev") evOnly += amount;
      else if (a === "ice") iceOnly += amount;
      else if (a === "both") both += amount;
      else other += amount;
    }

    return {
      ev: evOnly + both,
      ice: iceOnly + both,
      both,
      other,
      total: evOnly + iceOnly + both + other
    };
  }

  function renderMaintenanceTotalInCosts() {
    try {
      const container = A.$("costTable");
      if (!container) return;

      const totals = computeMaintenanceTotals();
      let el = A.$("maintenanceTotalCosts");
      if (!el) {
        el = document.createElement("p");
        el.id = "maintenanceTotalCosts";
        el.className = "small";
        el.style.marginTop = "6px";
        if (container.parentNode) {
          container.parentNode.insertBefore(el, container.nextSibling);
        }
      }

      const diff = totals.ev - totals.ice;
      el.textContent =
        "Maintenance totals (all time) – " +
        "EV: " + U.fmtGBP(totals.ev) +
        ", ICE: " + U.fmtGBP(totals.ice) +
        ", Both: " + U.fmtGBP(totals.both) +
        ", Other: " + U.fmtGBP(totals.other) +
        ", Diff (EV–ICE): " + U.fmtGBP(diff);
    } catch (e) {
      console && console.warn && console.warn("renderMaintenanceTotalInCosts failed", e);
    }
  }

  function renderMaintenanceTotalInCompare() {
    try {
      const container = A.$("compareStats");
      if (!container) return;

      const totals = computeMaintenanceTotals();
      let el = A.$("maintenanceTotalCompare");
      if (!el) {
        el = document.createElement("p");
        el.id = "maintenanceTotalCompare";
        el.className = "small";
        el.style.marginTop = "8px";
        container.appendChild(el);
      }

      const diff = totals.ev - totals.ice;
      el.textContent =
        "Maintenance (all time) – " +
        "EV: " + U.fmtGBP(totals.ev) +
        ", ICE: " + U.fmtGBP(totals.ice) +
        ", Both: " + U.fmtGBP(totals.both) +
        ", Other: " + U.fmtGBP(totals.other) +
        ", Diff (EV–ICE): " + U.fmtGBP(diff);
    } catch (e) {
      console && console.warn && console.warn("renderMaintenanceTotalInCompare failed", e);
    }
  }

  A.Totals = {
    computeMaintenanceTotals,
    computeInsuranceTotals,
    renderMaintenanceTotalInCosts,
    renderMaintenanceTotalInCompare
  };
})();
