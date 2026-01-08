// ui-costs.js – render costs table (newest first)

(function () {
  const U = window.EVUI;

  function renderCostTable(containerId, costs) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const list = Array.isArray(costs) ? costs : [];

    if (!list.length) {
      el.innerHTML = "<p>No costs yet.</p>";
      return;
    }

    const sorted = list
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const rows = sorted.map((c) => {
      const safeNote = U.escapeHTML(c.note || "");
      const idAttr = c.id ? String(c.id) : "";

      const appliesRaw = (c.applies || "other").toLowerCase();
      let appliesLabel = "Other";
      if (appliesRaw === "ev") appliesLabel = "EV";
      else if (appliesRaw === "ice") appliesLabel = "ICE";
      else if (appliesRaw === "both") appliesLabel = "Both";

      return `<tr>
        <td>${U.fmtDate(c.date)}</td>
        <td><span class="badge">${U.escapeHTML(c.category || "")}</span></td>
        <td><span class="badge">${appliesLabel}</span></td>
        <td>${U.fmtGBP(c.amount)}</td>
        <td>${safeNote}</td>
        <td class="actcol">
          <button type="button" class="btn-mini" data-action="edit-cost" data-id="${idAttr}" aria-label="Edit">
            <span class="ico">✎</span><span class="txt"> Edit</span>
          </button>
          <button type="button" class="btn-mini danger" data-action="delete-cost" data-id="${idAttr}" aria-label="Delete">✕</button>
        </td>
      </tr>`;
    });

    const total = sorted.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    const catMap = new Map();
    for (const c of sorted) {
      const key = c.category || "Other";
      catMap.set(key, (catMap.get(key) || 0) + (Number(c.amount) || 0));
    }

    const catRows = Array.from(catMap.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(
        ([cat, sum]) => `<tr>
          <td>${U.escapeHTML(cat)}</td>
          <td>${U.fmtGBP(sum)}</td>
        </tr>`
      );

    const legend = `
      <p class="small" style="margin:0;line-height:1.35;">
        <strong>For</strong> means which vehicle the cost applies to:
        <strong>EV</strong> = electric car only,
        <strong>ICE</strong> = petrol/diesel car only,
        <strong>Both</strong> = shared/combined cost,
        <strong>Other</strong> = not tied to a specific car.
      </p>
    `;

    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>For</th>
            <th>£</th>
            <th>Note</th>
            <th class="actcol">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join("")}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td>Total</td>
            <td></td>
            <td></td>
            <td>${U.fmtGBP(total)}</td>
            <td></td>
            <td class="actcol"></td>
          </tr>
        </tfoot>
      </table>

      <details style="margin-top:10px;">
        <summary style="cursor:pointer;"><strong>Totals by category</strong></summary>
        <div style="margin-top:6px;">
          <table>
            <thead><tr><th>Category</th><th>Total £</th></tr></thead>
            <tbody>${catRows.join("")}</tbody>
          </table>
        </div>
      </details>

      <details style="margin-top:10px;">
        <summary style="cursor:pointer;"><strong>What does “For” mean?</strong></summary>
        <div style="margin-top:6px;">${legend}</div>
      </details>
    `;
  }

  window.EVUI.renderCostTable = renderCostTable;
})();