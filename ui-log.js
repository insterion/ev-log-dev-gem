// ui-log.js – render charging log table (newest first)

(function () {
  const U = window.EVUI;

  function renderLogTable(containerId, entries) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const list = Array.isArray(entries) ? entries : [];

    if (!list.length) {
      el.innerHTML = "<p>No entries yet.</p>";
      return;
    }

    const rows = list
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map((e) => {
        const typeLabel =
          e.type === "public"
            ? "Public"
            : e.type === "public-xp"
            ? "Public xp"
            : e.type === "home"
            ? "Home"
            : "Home xp";

        const cost = (Number(e.kwh) || 0) * (Number(e.price) || 0);
        const safeNote = U.escapeHTML(e.note || "");
        const idAttr = e.id ? String(e.id) : "";

        return `<tr>
          <td>${U.fmtDate(e.date)}</td>
          <td>${U.fmtNum(e.kwh, 1)}</td>
          <td><span class="badge">${typeLabel}</span></td>
          <td>${U.fmtGBP(cost)}</td>
          <td>${safeNote}</td>
          <td class="actcol">
            <button type="button" class="btn-mini" data-action="edit-entry" data-id="${idAttr}" aria-label="Edit">
              <span class="ico">✎</span><span class="txt"> Edit</span>
            </button>
            <button type="button" class="btn-mini danger" data-action="delete-entry" data-id="${idAttr}" aria-label="Delete">✕</button>
          </td>
        </tr>`;
      });

    const totalKwh = list.reduce((s, e) => s + (Number(e.kwh) || 0), 0);
    const totalCost = list.reduce(
      (s, e) => s + (Number(e.kwh) || 0) * (Number(e.price) || 0),
      0
    );
    const sessions = list.length;

    const summaryBlock = `
      <details open style="margin:4px 0 8px;">
        <summary style="cursor:pointer;color:#cccccc;">
          <strong>Total so far</strong>
        </summary>
        <div style="margin-top:6px;font-size:0.85rem;color:#cccccc;">
          <p style="margin:0;">
            <strong>${U.fmtNum(totalKwh, 1)} kWh</strong> •
            <strong>${U.fmtGBP(totalCost)}</strong> •
            <strong>${sessions}</strong> sessions
          </p>
        </div>
      </details>
    `;

    el.innerHTML = `
      ${summaryBlock}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>kWh</th>
            <th>Type</th>
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
            <td>${U.fmtNum(totalKwh, 1)}</td>
            <td></td>
            <td>${U.fmtGBP(totalCost)}</td>
            <td></td>
            <td class="actcol"></td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  window.EVUI.renderLogTable = renderLogTable;
})();