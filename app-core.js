// app-core.js – shared state + helpers + period logic

(function () {
  const D = window.EVData;
  const C = window.EVCalc;
  const U = window.EVUI;

  const $ = (id) => document.getElementById(id);

  const state = D.loadState();

  // edit state
  let currentEditId = null;
  let currentEditCostId = null;

  // UI state defaults (period selector)
  if (!state.ui) state.ui = {};
  if (!state.ui.periodMode) state.ui.periodMode = "this-month";
  if (!state.ui.periodFrom) state.ui.periodFrom = "";
  if (!state.ui.periodTo) state.ui.periodTo = "";

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function clampISO(d) {
    return (d && /^d{4}-d{2}-d{2}$/.test(d)) ? d : "";
  }

  function isoToTime(iso) {
    if (!iso) return NaN;
    const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
    if (!y || !m || !d) return NaN;
    return Date.UTC(y, m - 1, d);
  }

  function firstDayOfMonthISO(dt) {
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }

  function lastDayOfMonthISO(dt) {
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  }

  function ensureCostAppliesDefaults() {
    if (!Array.isArray(state.costs)) return;
    for (const c of state.costs) {
      if (!c) continue;
      if (!c.applies) c.applies = "other";
      else c.applies = String(c.applies).toLowerCase();
    }
  }

  function autoPriceForType(type) {
    const s = state.settings;
    switch (type) {
      case "public": return s.public;
      case "public-xp": return s.public_xp;
      case "home": return s.home;
      case "home-xp": return s.home_xp;
      default: return 0;
    }
  }

  function saveState() {
    D.saveState(state);
  }

  // -------- Version 1.1: Compare defaults + diesel price history --------

  function ensureCompareSettingsDefaults() {
    if (!state.settings) state.settings = {};

    if (typeof state.settings.evMilesPerKwh !== "number" || !isFinite(state.settings.evMilesPerKwh) || state.settings.evMilesPerKwh <= 0) {
      state.settings.evMilesPerKwh = 2.8;
    }

    if (typeof state.settings.iceMpg !== "number" || !isFinite(state.settings.iceMpg) || state.settings.iceMpg <= 0) {
      state.settings.iceMpg = 45;
    }

    // current diesel price (cached for UI); history is the source of truth
    if (typeof state.settings.icePerLitre !== "number" || !isFinite(state.settings.icePerLitre) || state.settings.icePerLitre <= 0) {
      state.settings.icePerLitre = 1.44;
    }

    const m = String(state.settings.bothAllocationMode || "split").toLowerCase();
    state.settings.bothAllocationMode = (m === "split" || m === "double") ? m : "split";

    ensureFuelHistoryDefaults();
  }

  function ensureFuelHistoryDefaults() {
    if (!state.settings) state.settings = {};

    if (!Array.isArray(state.settings.icePerLitreHistory)) {
      state.settings.icePerLitreHistory = [];
    }

    if (state.settings.icePerLitreHistory.length === 0) {
      state.settings.icePerLitreHistory.push({
        from: todayISO(),
        perLitre: Number(state.settings.icePerLitre) || 1.44
      });
    }

    state.settings.icePerLitreHistory = state.settings.icePerLitreHistory
      .map((x) => ({
        from: (x && typeof x.from === "string") ? x.from.slice(0, 10) : "",
        perLitre: (x && typeof x.perLitre === "number") ? x.perLitre : Number(x && x.perLitre)
      }))
      .filter((x) => x.from && /^d{4}-d{2}-d{2}$/.test(x.from) && isFinite(x.perLitre) && x.perLitre > 0)
      .sort((a, b) => (a.from || "").localeCompare(b.from || ""));

    // sync cached current price to latest
    const last = state.settings.icePerLitreHistory[state.settings.icePerLitreHistory.length - 1];
    if (last && isFinite(last.perLitre) && last.perLitre > 0) {
      state.settings.icePerLitre = last.perLitre;
    }
  }

  function getIcePerLitreForDate(isoDate) {
    ensureFuelHistoryDefaults();
    const hist = state.settings.icePerLitreHistory;

    const d = (isoDate && typeof isoDate === "string") ? isoDate.slice(0, 10) : "";
    if (!d) return Number(state.settings.icePerLitre) || 1.44;

    for (let i = hist.length - 1; i >= 0; i--) {
      const h = hist[i];
      if (h && h.from && h.from <= d) return Number(h.perLitre) || (Number(state.settings.icePerLitre) || 1.44);
    }

    const first = hist[0];
    if (first && isFinite(first.perLitre) && first.perLitre > 0) return first.perLitre;

    return Number(state.settings.icePerLitre) || 1.44;
  }

  function addIcePerLitreRecord(perLitre, fromISO) {
    ensureFuelHistoryDefaults();

    const p = Number(perLitre);
    if (!isFinite(p) || p <= 0) return false;

    const from = (fromISO && /^d{4}-d{2}-d{2}$/.test(fromISO)) ? fromISO : todayISO();
    const hist = state.settings.icePerLitreHistory;

    const last = hist[hist.length - 1];
    if (last && last.from === from) {
      last.perLitre = p;
    } else {
      hist.push({ from, perLitre: p });
    }

    ensureFuelHistoryDefaults();
    return true;
  }

  // ensure defaults exist immediately after load
  ensureCompareSettingsDefaults();

  // -------- Costs applies filter --------

  function getCostFilterValue() {
    const sel = $("c_filter_applies");
    if (!sel) return "all";
    const v = (sel.value || "all").toLowerCase();
    return (v === "ev" || v === "ice" || v === "both" || v === "other" || v === "all") ? v : "all";
  }

  // -------- Period logic --------

  function getActivePeriod() {
    const mode = (state.ui.periodMode || "this-month").toLowerCase();

    if (mode === "all-time") {
      return { mode, from: "", to: "", label: "All time" };
    }

    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    if (mode === "this-month") {
      const from = firstDayOfMonthISO(todayUtc);
      const to = lastDayOfMonthISO(todayUtc);
      return { mode, from, to, label: `This month (${from} → ${to})` };
    }

    if (mode === "last-month") {
      const lastMonth = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() - 1, 15));
      const from = firstDayOfMonthISO(lastMonth);
      const to = lastDayOfMonthISO(lastMonth);
      return { mode, from, to, label: `Last month (${from} → ${to})` };
    }

    if (mode === "last-30") {
      const to = todayUtc.toISOString().slice(0, 10);
      const fromDt = new Date(todayUtc.getTime() - 29 * 24 * 3600 * 1000);
      const from = fromDt.toISOString().slice(0, 10);
      return { mode, from, to, label: `Last 30 days (${from} → ${to})` };
    }

    // custom
    const from = clampISO(state.ui.periodFrom);
    const to = clampISO(state.ui.periodTo);

    if (!from || !to) {
      const f = firstDayOfMonthISO(todayUtc);
      const t = lastDayOfMonthISO(todayUtc);
      return { mode: "this-month", from: f, to: t, label: `This month (${f} → ${t})` };
    }

    const tf = isoToTime(from);
    const tt = isoToTime(to);
    if (!isNaN(tf) && !isNaN(tt) && tf > tt) {
      return { mode: "custom", from: to, to: from, label: `Custom (${to} → ${from})` };
    }

    return { mode: "custom", from, to, label: `Custom (${from} → ${to})` };
  }

  function filterByPeriod(list, dateGetter) {
    const p = getActivePeriod();
    if (p.mode === "all-time") return list || [];

    const fromT = isoToTime(p.from);
    const toT = isoToTime(p.to);
    if (isNaN(fromT) || isNaN(toT)) return list || [];

    return (list || []).filter((x) => {
      const iso = (dateGetter(x) || "");
      const t = isoToTime(iso);
      if (isNaN(t)) return false;
      return t >= fromT && t <= toT;
    });
  }

  // expose a single shared app object for all modules
  window.EVApp = {
    D, C, U, $,
    state,

    get currentEditId() { return currentEditId; },
    set currentEditId(v) { currentEditId = v; },
    get currentEditCostId() { return currentEditCostId; },
    set currentEditCostId(v) { currentEditCostId = v; },

    todayISO,
    clampISO,
    isoToTime,
    ensureCostAppliesDefaults,
    autoPriceForType,
    saveState,

    // Version 1.1
    ensureCompareSettingsDefaults,
    ensureFuelHistoryDefaults,
    getIcePerLitreForDate,
    addIcePerLitreRecord,

    getCostFilterValue,
    getActivePeriod,
    filterByPeriod
  };
})();