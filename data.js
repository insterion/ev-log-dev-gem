// data.js – load/save state in localStorage

(function () {
  const STORAGE_KEY = "ev_log_state_v1";

  const defaultState = {
    entries: [], // charging
    costs: [], // maintenance
    settings: {
      public: 0.56,
      public_xp: 0.76,
      home: 0.09,
      home_xp: 0.30,
      chargerHardware: 0,
      chargerInstall: 0,

      // Compare assumptions
      evMilesPerKwh: 2.8,
      iceMpg: 45,
      icePerLitre: 1.44,
      bothAllocationMode: "split",
      icePerLitreHistory: [],

      // Compare mode (NEW): "costs-only" | "full"
      compareMode: "costs-only",

      // (legacy / optional) ICE miles per period preset
      iceMilesThisMonth: 0,
      iceMilesLastMonth: 0,
      iceMilesCustom: 0
    },
    ui: {
      periodMode: "this-month",
      periodFrom: "",
      periodTo: ""
    }
  };

  function cloneDefault() {
    return JSON.parse(JSON.stringify(defaultState));
  }

  function ensureEntryIds(state) {
    if (!state || !Array.isArray(state.entries)) return;
    let counter = 0;
    for (const e of state.entries) {
      if (!e.id) {
        let newId = null;
        try {
          if (window.crypto && window.crypto.randomUUID) newId = window.crypto.randomUUID();
        } catch (err) {
          console.warn("crypto.randomUUID not available, fallback id", err);
        }
        if (!newId) newId = "e_" + Date.now().toString(36) + "_" + (counter++).toString(36);
        e.id = newId;
      }
    }
  }

  function ensureCostIds(state) {
    if (!state || !Array.isArray(state.costs)) return;
    let counter = 0;
    for (const c of state.costs) {
      if (!c.id) {
        let newId = null;
        try {
          if (window.crypto && window.crypto.randomUUID) newId = window.crypto.randomUUID();
        } catch (err) {
          console.warn("crypto.randomUUID not available for costs, fallback id", err);
        }
        if (!newId) newId = "c_" + Date.now().toString(36) + "_" + (counter++).toString(36);
        c.id = newId;
      }
    }
  }

  // guarantee each cost has applies (ev | ice | both | other)
  function ensureCostApplies(state) {
    if (!state || !Array.isArray(state.costs)) return;
    for (const c of state.costs) {
      if (!c.applies) c.applies = "other";
    }
  }

  function ensureUiDefaults(state) {
    if (!state.ui) state.ui = {};
    if (!state.ui.periodMode) state.ui.periodMode = "this-month";
    if (state.ui.periodFrom == null) state.ui.periodFrom = "";
    if (state.ui.periodTo == null) state.ui.periodTo = "";
  }

  function ensureSettingsDefaults(state) {
    if (!state.settings) state.settings = {};
    const s = state.settings;

    if (typeof s.public !== "number") s.public = 0.56;
    if (typeof s.public_xp !== "number") s.public_xp = 0.76;
    if (typeof s.home !== "number") s.home = 0.09;
    if (typeof s.home_xp !== "number") s.home_xp = 0.30;

    if (typeof s.chargerHardware !== "number") s.chargerHardware = 0;
    if (typeof s.chargerInstall !== "number") s.chargerInstall = 0;

    if (typeof s.evMilesPerKwh !== "number") s.evMilesPerKwh = 2.8;
    if (typeof s.iceMpg !== "number") s.iceMpg = 45;
    if (typeof s.icePerLitre !== "number") s.icePerLitre = 1.44;
    if (!s.bothAllocationMode) s.bothAllocationMode = "split";
    if (!Array.isArray(s.icePerLitreHistory)) s.icePerLitreHistory = [];

    // v2 ICE miles fields (optional)
    if (typeof s.iceMilesThisMonth !== "number") s.iceMilesThisMonth = 0;
    if (typeof s.iceMilesLastMonth !== "number") s.iceMilesLastMonth = 0;
    if (typeof s.iceMilesCustom !== "number") s.iceMilesCustom = 0;
  }

  // NEW: enforce compareMode
  function ensureCompareMode(state) {
    if (!state || !state.settings) return;
    const raw = String(state.settings.compareMode || "").toLowerCase();
    state.settings.compareMode = (raw === "full") ? "full" : "costs-only";
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefault();

      const parsed = JSON.parse(raw);

      const state = cloneDefault();
      if (parsed.entries) state.entries = parsed.entries;
      if (parsed.costs) state.costs = parsed.costs;
      if (parsed.settings) Object.assign(state.settings, parsed.settings);
      if (parsed.ui) Object.assign(state.ui, parsed.ui);

      ensureEntryIds(state);
      ensureCostIds(state);
      ensureCostApplies(state);
      ensureSettingsDefaults(state);
      ensureUiDefaults(state);

      // NEW: compare mode migration
      ensureCompareMode(state);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.warn("Could not persist migrated defaults/ids/applies", e);
      }

      return state;
    } catch (e) {
      console.error("Failed to load state", e);
      return cloneDefault();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save state", e);
    }
  }

  window.EVData = {
    loadState,
    saveState
  };
})();