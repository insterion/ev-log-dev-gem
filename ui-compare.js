// ui-compare.js – render compare (costs-only + ICE equivalent fuel for EV miles)

(function () {
  const U = window.EVUI;

  function safeGet(obj, path, def) {
    try {
      let x = obj;
      for (const k of path) x = x && x[k];
      return x == null ? def : x;
    } catch (e) {
      return def;
    }
  }

  function renderBreakdown(title, byCat) {
    const entries = Object.entries(byCat || {});
    if (!entries.length) return "";

    const preferred = ["Tyres", "Pads", "Service", "Insurance", "Other"];
    entries.sort((a, b) => {
      const ai = preferred.indexOf(a[0]);
      const bi = preferred.indexOf(b[0]);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return String(a[0]).localeCompare(String(b[0]));
    });

    const rows = entries
      .filter(([, v]) => Number(v) !== 0)
      .map(([k, v]) => `<p style="margin:0 0 3px;">${U.escapeHTML(k)}: <strong>${U.fmtGBP(v)}</strong></p>`)
      .join("");

    return `
      <div style="margin-top:6px;padding:8px;border-radius:12px;background:#0a0a0a;border:1px solid #222;">
        <p style="margin:0 0 6px;"><strong>${U.escapeHTML(title)}</strong></p>
        ${rows || `<p style="margin:0;color:#b0b0b0;">No items.</p>`}
      </div>
    `;
  }

  function renderCompare(containerId, data) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!data) {
      el.innerHTML = "<p>Not enough data yet.</p>";
      return;
    }

    const evTotal = Number(data.evTotal || 0);
    const iceTotal = Number(data.iceTotal || 0);
    const diffAll = iceTotal - evTotal;

    let allText = "about the same overall";
    if (diffAll > 1) allText = "ICE more expensive overall";
    else if (diffAll < -1) allText = "EV more expensive overall";

    const iceEqFuelCost = Number(data.iceEqFuelCost || 0);
    const iceTotalPlusEqFuel = Number(data.iceTotalPlusEqFuel || (iceTotal + iceEqFuelCost));
    const diffAllPlusFuel = iceTotalPlusEqFuel - evTotal;

    let allTextPlus = "about the same overall";
    if (diffAllPlusFuel > 1) allTextPlus = "ICE more expensive overall";
    else if (diffAllPlusFuel < -1) allTextPlus = "EV more expensive overall";

    const topSummary = `
      <div style="margin-bottom:8px;padding:6px 8px;border-radius:12px;background:#0a0a0a;border:1px solid #222;">
        <p style="margin:0 0 4px;"><strong>Quick summary (selected period)</strong></p>
        <p style="margin:0 0 4px;">
          All-in difference (ICE – EV): <strong>${U.fmtGBP(Math.abs(diffAll))}</strong> (${allText})
        </p>
        <p style="margin:0;">
          All-in + ICE fuel (same miles) (ICE – EV): <strong>${U.fmtGBP(Math.abs(diffAllPlusFuel))}</strong> (${allTextPlus})
        </p>
      </div>
    `;

    const evEnergyCost = Number(data.evEnergyCost || 0);

    const maintEv = safeGet(data, ["maintenance", "ev", "total"], 0);
    const maintIce = safeGet(data, ["maintenance", "ice", "total"], 0);
    const maintBoth = safeGet(data, ["maintenance", "both", "total"], 0);
    const maintOther = safeGet(data, ["maintenance", "other", "total"], 0);

    const insEv = safeGet(data, ["insurance", "ev", "total"], 0);
    const insIce = safeGet(data, ["insurance", "ice", "total"], 0);
    const insBoth = safeGet(data, ["insurance", "both", "total"], 0);
    const insOther = safeGet(data, ["insurance", "other", "total"], 0);

    const evEnergyBlock = `
      <details open>
        <summary style="cursor:pointer;"><strong>EV energy (selected period)</strong></summary>
        <div style="margin-top:6px;">
          <p>Total kWh (period): <strong>${U.fmtNum(data.totalKwh, 1)}</strong></p>
          <p>EV energy cost: <strong>${U.fmtGBP(evEnergyCost)}</strong></p>
        </div>
      </details>
    `;

    const eqFuelBlock = `
      <details>
        <summary style="cursor:pointer;"><strong>ICE equivalent fuel for EV miles (estimate)</strong></summary>
        <div style="margin-top:6px;">
          <p>EV estimated miles (@ ${U.fmtNum(data.evMilesPerKwh, 1)} mi/kWh): <strong>${U.fmtNum(data.evMiles || 0, 0)}</strong></p>
          <p>ICE MPG used: <strong>${U.fmtNum(data.iceMpg || 0, 0)}</strong></p>
          <p>Diesel price used: <strong>£${Number(data.icePerLitre || 0).toFixed(2)}</strong> / litre</p>
          <p>ICE fuel cost (same miles): <strong>${U.fmtGBP(iceEqFuelCost)}</strong></p>
          <p style="margin:6px 0 0;font-size:0.85rem;color:#b0b0b0;">
            This is fuel-only, for the same miles as EV estimated miles (no ICE odometer input).
          </p>
        </div>
      </details>
    `;

    let maintBlock = "";
    if (maintEv || maintIce || maintBoth || maintOther) {
      maintBlock = `
        <details>
          <summary style="cursor:pointer;"><strong>Maintenance (details)</strong></summary>
          <div style="margin-top:6px;">
            <p>Maintenance – EV: <strong>${U.fmtGBP(maintEv)}</strong>, ICE: <strong>${U.fmtGBP(maintIce)}</strong></p>
            <p>Shared (Both): <strong>${U.fmtGBP(maintBoth)}</strong>, Other: <strong>${U.fmtGBP(maintOther)}</strong></p>
            ${renderBreakdown("EV maintenance breakdown", safeGet(data, ["maintenance", "ev", "byCat"], {}))}
            ${renderBreakdown("ICE maintenance breakdown", safeGet(data, ["maintenance", "ice", "byCat"], {}))}
          </div>
        </details>
      `;
    }

    let insuranceBlock = "";
    if (insEv || insIce || insBoth || insOther) {
      const insDiff = Number(insIce || 0) - Number(insEv || 0);
      let insDiffText = "about the same";
      if (insDiff > 1) insDiffText = "ICE insurance higher";
      else if (insDiff < -1) insDiffText = "EV insurance higher";

      insuranceBlock = `
        <details>
          <summary style="cursor:pointer;"><strong>Insurance (details)</strong></summary>
          <div style="margin-top:6px;">
            <p>Insurance – EV: <strong>${U.fmtGBP(insEv)}</strong>, ICE: <strong>${U.fmtGBP(insIce)}</strong></p>
            <p>Shared (Both): <strong>${U.fmtGBP(insBoth)}</strong>, Other: <strong>${U.fmtGBP(insOther)}</strong></p>
            <p>Difference (ICE – EV): <strong>${U.fmtGBP(Math.abs(insDiff))}</strong> (${insDiffText})</p>
          </div>
        </details>
      `;
    }

    const assumptionsLine = `
      Assumptions: Costs-only totals (no ICE fuel/miles logged). Plus an extra ICE fuel estimate for EV miles using ICE mpg and £/litre.
    `;

    el.innerHTML = `
      ${topSummary}
      ${evEnergyBlock}
      ${eqFuelBlock}
      ${maintBlock}
      ${insuranceBlock}
      <p style="margin-top:10px;font-size:0.85rem;color:#b0b0b0;">${assumptionsLine}</p>
    `;
  }

  window.EVUI.renderCompare = renderCompare;
})();