// ui-summary.js – compact + collapsible summary + "Open Compare" quick jump

(function () {
  const U = window.EVUI;

  // One-time click handler (delegated) for "Open Compare"
  let wired = false;
  function wireOpenCompareOnce() {
    if (wired) return;
    wired = true;

    document.addEventListener("click", (ev) => {
      const btn = ev.target && ev.target.closest && ev.target.closest("[data-action='open-compare']");
      if (!btn) return;

      const ok = U.openTab("compare");
      if (!ok) U.toast("Compare tab not found", "bad");
    });
  }

  function renderSummary(containerIds, summary) {
    wireOpenCompareOnce();

    const [idThis, idLast, idAvg] = containerIds.map((id) =>
      document.getElementById(id)
    );
    if (!idThis || !idLast || !idAvg) return;

    function compactLines(data) {
      if (!data) return "<p>No data.</p>";

      const kwh = U.fmtNum(data.kwh, 1);
      const cost = U.fmtGBP(data.cost);
      const count = data.count != null ? data.count : null;

      const avgPrice =
        data.avgPrice && data.avgPrice > 0 ? `£${Number(data.avgPrice).toFixed(3)}/kWh` : null;

      const perDay =
        data.perDay && data.perDay > 0 ? U.fmtGBP(data.perDay) + "/day" : null;

      return `
        <p style="margin:0 0 4px;">
          <strong>${kwh} kWh</strong> • <strong>${cost}</strong>
          ${count != null ? ` • <strong>${count}</strong> sessions` : ""}
        </p>
        <p style="margin:0;font-size:0.85rem;color:#b0b0b0;">
          ${avgPrice ? `Avg: <strong style="color:#f5f5f5;">${avgPrice}</strong>` : "Avg: n/a"}
          ${perDay ? ` • ~ <strong style="color:#f5f5f5;">${perDay}</strong>` : ""}
        </p>
      `;
    }

    idThis.innerHTML = `
      <details open>
        <summary style="cursor:pointer;"><strong>This month</strong></summary>
        <div style="margin-top:6px;">${compactLines(summary && summary.thisMonth)}</div>
      </details>
    `;

    idLast.innerHTML = `
      <details>
        <summary style="cursor:pointer;"><strong>Last month</strong></summary>
        <div style="margin-top:6px;">${compactLines(summary && summary.lastMonth)}</div>
      </details>
    `;

    idAvg.innerHTML = `
      <details>
        <summary style="cursor:pointer;"><strong>Average (all months)</strong></summary>
        <div style="margin-top:6px;">
          ${
            summary && summary.avg
              ? `
                <p style="margin:0 0 4px;">
                  <strong>${U.fmtNum(summary.avg.kwh, 1)} kWh</strong> •
                  <strong>${U.fmtGBP(summary.avg.cost)}</strong>
                </p>
                <p style="margin:0;font-size:0.85rem;color:#b0b0b0;">
                  Avg price: <strong style="color:#f5f5f5;">£${Number(summary.avg.avgPrice).toFixed(3)}</strong> / kWh
                </p>
              `
              : "<p>No data.</p>"
          }
        </div>
      </details>

      <div style="margin-top:10px;padding:10px 12px;border-radius:18px;border:1px solid #222;background:#080808;">
        <p style="margin:0 0 6px;font-weight:600;">EV vs ICE (quick view)</p>
        <p style="margin:0 0 10px;font-size:0.9rem;color:#b0b0b0;">
          Tip: open <strong style="color:#f5f5f5;">Compare</strong> tab for full breakdown.
        </p>
        <button type="button" class="btn-mini" data-action="open-compare" style="padding:8px 12px;border-radius:22px;">
          Open Compare
        </button>
      </div>
    `;
  }

  window.EVUI.renderSummary = renderSummary;
})();