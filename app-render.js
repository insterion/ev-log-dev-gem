// app-render.js – UI controls (filters/period) + renderAll + period summary block

(function () {
  const A = window.EVApp;
  const U = A.U;

  // ---------- Costs filter controls ----------
  function ensureCostFilterControls() {
    if (A.$("c_filter_applies")) return;

    const container = A.$("costTable");
    if (!container || !container.parentNode) return;

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "6px";
    wrapper.style.marginBottom = "6px";

    const label = document.createElement("label");
    label.setAttribute("for", "c_filter_applies");
    label.textContent = "Filter:";

    const select = document.createElement("select");
    select.id = "c_filter_applies";

    const options = [
      ["all", "All"],
      ["ev", "EV only"],
      ["ice", "ICE only"],
      ["both", "Both"],
      ["other", "Other"]
    ];

    options.forEach(([val, text]) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = text;
      select.appendChild(opt);
    });

    select.addEventListener("change", () => A.Render.renderAll());

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    container.parentNode.insertBefore(wrapper, container);
  }

  // ---------- Period controls ----------
  function ensurePeriodControls() {
    if (A.$("period_mode")) return;

    const container = A.$("costTable");
    if (!container || !container.parentNode) return;

    const outer = document.createElement("div");
    outer.id = "periodControls";
    outer.style.display = "grid";
    outer.style.gridTemplateColumns = "auto 1fr";
    outer.style.gap = "6px";
    outer.style.alignItems = "center";
    outer.style.marginBottom = "6px";

    const label = document.createElement("label");
    label.setAttribute("for", "period_mode");
    label.textContent = "Period:";

    const select = document.createElement("select");
    select.id = "period_mode";

    const modes = [
      ["this-month", "This month"],
      ["last-month", "Last month"],
      ["last-30", "Last 30 days"],
      ["custom", "Custom…"],
      ["all-time", "All time"]
    ];
    modes.forEach(([val, text]) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = text;
      select.appendChild(opt);
    });

    select.value = A.state.ui.periodMode || "this-month";

    const customRow = document.createElement("div");
    customRow.id = "period_custom_row";
    customRow.style.gridColumn = "1 / -1";
    customRow.style.display = "none";
    customRow.style.gap = "6px";
    customRow.style.alignItems = "center";

    const from = document.createElement("input");
    from.type = "date";
    from.id = "period_from";
    from.value = A.clampISO(A.state.ui.periodFrom) || "";

    const to = document.createElement("input");
    to.type = "date";
    to.id = "period_to";
    to.value = A.clampISO(A.state.ui.periodTo) || "";

    const btnApply = document.createElement("button");
    btnApply.type = "button";
    btnApply.id = "period_apply";
    btnApply.textContent = "Apply";

    const btnReset = document.createElement("button");
    btnReset.type = "button";
    btnReset.id = "period_reset";
    btnReset.textContent = "Reset";

    customRow.appendChild(from);
    customRow.appendChild(to);
    customRow.appendChild(btnApply);
    customRow.appendChild(btnReset);

    const badge = document.createElement("div");
    badge.id = "period_badge";
    badge.style.gridColumn = "1 / -1";
    badge.style.fontSize = "0.85rem";
    badge.style.color = "#b0b0b0";
    badge.style.marginTop = "2px";

    function refreshCustomVisibility() {
      const mode = (select.value || "this-month").toLowerCase();
      customRow.style.display = mode === "custom" ? "flex" : "none";
    }

    function savePeriod(mode, fromIso, toIso) {
      A.state.ui.periodMode = mode;
      A.state.ui.periodFrom = fromIso || "";
      A.state.ui.periodTo = toIso || "";
      A.saveState();
    }

    select.addEventListener("change", () => {
      const mode = (select.value || "this-month").toLowerCase();
      refreshCustomVisibility();

      if (mode !== "custom") {
        savePeriod(mode, "", "");
        A.Render.renderAll();
      }
    });

    btnApply.addEventListener("click", () => {
      const f = A.clampISO(from.value);
      const t = A.clampISO(to.value);
      if (!f || !t) {
        U.toast("Pick From and To dates", "bad");
        return;
      }
      savePeriod("custom", f, t);
      A.Render.renderAll();
      U.toast("Period applied", "good");
    });

    btnReset.addEventListener("click", () => {
      from.value = "";
      to.value = "";
      savePeriod("this-month", "", "");
      select.value = "this-month";
      refreshCustomVisibility();
      A.Render.renderAll();
      U.toast("Period reset", "info");
    });

    outer.appendChild(label);
    outer.appendChild(select);

    container.parentNode.insertBefore(outer, container);
    container.parentNode.insertBefore(customRow, container);
    container.parentNode.insertBefore(badge, container);

    refreshCustomVisibility();
  }

  function renderPeriodBadge() {
    const el = A.$("period_badge");
    if (!el) return;
    const p = A.getActivePeriod();
    el.textContent = "Period active: " + (p.label || "");
  }

  // ---------- Summary: period block ----------
  function ensurePeriodSummaryBlock() {
    const anchor = A.$("summary_this");
    if (!anchor) return;

    let box = A.$("summary_period");
    if (box) return;

    box = document.createElement("div");
    box.id = "summary_period";
    box.style.borderRadius = "18px";
    box.style.border = "1px solid #222";
    box.style.background = "#080808";
    box.style.padding = "10px 12px";
    box.style.marginBottom = "10px";
    box.style.fontSize = "0.9rem";

    anchor.parentNode.insertBefore(box, anchor);
  }

  function computeStatsForEntries(entries) {
    const arr = entries || [];
    const totalKwh = arr.reduce((s, e) => s + (Number(e.kwh) || 0), 0);
    const totalCost = arr.reduce((s, e) => s + ((Number(e.kwh) || 0) * (Number(e.price) || 0)), 0);
    const count = arr.length;

    const avgPrice = totalKwh > 0 ? totalCost / totalKwh : 0;

    const p = A.getActivePeriod();
    let perDay = 0;
    if (p.mode !== "all-time" && p.from && p.to) {
      const fromT = A.isoToTime(p.from);
      const toT = A.isoToTime(p.to);
      if (!isNaN(fromT) && !isNaN(toT)) {
        const days = Math.floor((toT - fromT) / (24 * 3600 * 1000)) + 1;
        if (days > 0) perDay = totalCost / days;
      }
    }

    return { totalKwh, totalCost, count, avgPrice, perDay };
  }

  function renderPeriodSummary(entriesForPeriod) {
    const box = A.$("summary_period");
    if (!box) return;

    const p = A.getActivePeriod();
    const st = computeStatsForEntries(entriesForPeriod);

    const openCompareBtn = `
      <button type="button" data-open-tab="compare" style="margin-top:8px;">Open Compare</button>
    `;

    box.innerHTML = `
      <details open>
        <summary style="cursor:pointer;"><strong>Selected period (from Costs)</strong></summary>
        <div style="margin-top:6px;">
          <p style="margin:0 0 4px;color:#b0b0b0;">${p.label}</p>
          ${
            st.count
              ? `
                <p style="margin:0 0 4px;">
                  <strong>${U.fmtNum(st.totalKwh, 1)} kWh</strong> •
                  <strong>${U.fmtGBP(st.totalCost)}</strong> •
                  <strong>${st.count}</strong> sessions
                </p>
                <p style="margin:0;font-size:0.85rem;color:#b0b0b0;">
                  Avg price: <strong style="color:#f5f5f5;">£${st.avgPrice.toFixed(3)}</strong> / kWh
                  ${st.perDay > 0 ? ` • ~ <strong style="color:#f5f5f5;">${U.fmtGBP(st.perDay)}</strong> / day` : ""}
                </p>
              `
              : `<p style="margin:0;">No data for this period.</p>`
          }
          ${openCompareBtn}
        </div>
      </details>
    `;
  }

  // ---------- renderAll ----------
  function renderAll() {
    U.renderLogTable("logTable", A.state.entries);

    // Costs table = period + applies filter
    const filter = A.getCostFilterValue();

    const costsBase = A.filterByPeriod(A.state.costs || [], (c) => c.date);
    let costsToRender = costsBase;

    if (filter !== "all") {
      costsToRender = costsBase.filter((c) => (c.applies || "other").toLowerCase() === filter);
    }

    U.renderCostTable("costTable", costsToRender);

    // Summary (original) = all-time entries
    const summary = A.C.buildSummary(A.state.entries);
    U.renderSummary(["summary_this", "summary_last", "summary_avg"], summary);

    // Period summary (entries filtered by active period)
    ensurePeriodSummaryBlock();
    const entriesForPeriod = A.filterByPeriod(A.state.entries || [], (e) => e.date);
    renderPeriodSummary(entriesForPeriod);

    // Compare v2 = active period + ICE miles input
    const p = A.getActivePeriod(); // {mode, from, to, label}
    const cmp = A.C.buildCompareV2(A.state, p);

    U.renderCompare("compareStats", cmp);

    // keep existing totals blocks elsewhere
    A.Totals.renderMaintenanceTotalInCosts();
    A.Totals.renderMaintenanceTotalInCompare();

    renderPeriodBadge();
  }

  window.EVApp.Render = {
    ensureCostFilterControls,
    ensurePeriodControls,
    renderAll,
    renderPeriodBadge
  };
})();