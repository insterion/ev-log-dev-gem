// calc.js – simple calculations (Compare v2: costs-only + ICE equivalent fuel for EV miles)

(function () {
  function getMonthKey(dateStr) {
    if (!dateStr) return "";
    return dateStr.slice(0, 7);
  }

  function groupByMonth(entries) {
    const map = new Map();
    for (const e of entries) {
      const key = getMonthKey(e.date);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return map;
  }

  function monthTotals(entries) {
    const kwh = entries.reduce((s, e) => s + (e.kwh || 0), 0);
    const cost = entries.reduce((s, e) => s + (e.kwh * e.price || 0), 0);
    return { kwh, cost, count: entries.length };
  }

  function daysInMonthKey(key) {
    if (!key || key.length < 7) return 30;
    const parts = key.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!year || !month) return 30;
    return new Date(year, month, 0).getDate();
  }

  function buildSummary(entries) {
    if (!entries.length) return { thisMonth: null, lastMonth: null, avg: null };

    const map = groupByMonth(entries);
    const keys = Array.from(map.keys()).sort();

    const now = new Date();
    const thisKey = now.toISOString().slice(0, 7);
    const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastKey = lastDate.toISOString().slice(0, 7);

    let thisMonth = null;
    let lastMonth = null;

    const thisArr = map.get(thisKey);
    if (thisArr) {
      thisMonth = monthTotals(thisArr);
      const dim = daysInMonthKey(thisKey);
      thisMonth.avgPrice = thisMonth.kwh > 0 ? thisMonth.cost / thisMonth.kwh : 0;
      thisMonth.perDay = dim > 0 ? thisMonth.cost / dim : 0;
    }

    const lastArr = map.get(lastKey);
    if (lastArr) {
      lastMonth = monthTotals(lastArr);
      const dimL = daysInMonthKey(lastKey);
      lastMonth.avgPrice = lastMonth.kwh > 0 ? lastMonth.cost / lastMonth.kwh : 0;
      lastMonth.perDay = dimL > 0 ? lastMonth.cost / dimL : 0;
    }

    const monthTotalsArr = keys.map((k) => monthTotals(map.get(k)));
    const totalKwh = monthTotalsArr.reduce((s, m) => s + m.kwh, 0);
    const totalCost = monthTotalsArr.reduce((s, m) => s + m.cost, 0);
    const avg = {
      kwh: totalKwh / monthTotalsArr.length,
      cost: totalCost / monthTotalsArr.length,
      avgPrice: totalKwh > 0 ? totalCost / totalKwh : 0
    };

    return { thisMonth, lastMonth, avg };
  }

  // ---------- helpers ----------
  function clampNum(x, def = 0) {
    const n = Number(x);
    return isFinite(n) ? n : def;
  }

  function inPeriod(dateStr, from, to) {
    const d = (dateStr || "").slice(0, 10);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  function filterByPeriod(arr, period, getDateFn) {
    const from = period && period.from ? String(period.from).slice(0, 10) : "";
    const to = period && period.to ? String(period.to).slice(0, 10) : "";
    if (!from && !to) return (arr || []).slice();
    return (arr || []).filter((x) => inPeriod(getDateFn(x), from, to));
  }

  // UK: miles / mpg = UK gallons; * 4.54609 litres per UK gallon
  function iceFuelCostGBP(miles, mpg, perLitre) {
    const mi = clampNum(miles, 0);
    const m = clampNum(mpg, 0);
    const p = clampNum(perLitre, 0);
    if (mi <= 0 || m <= 0 || p <= 0) return 0;
    const litres = (mi / m) * 4.54609;
    return litres * p;
  }

  function sumByCategory(costsArr) {
    const byCat = {};
    let total = 0;

    for (const c of costsArr || []) {
      const amt = clampNum(c && c.amount, 0);
      if (!amt) continue;

      const catRaw = (c && c.category != null ? String(c.category) : "Other").trim();
      const cat = catRaw || "Other";

      byCat[cat] = (byCat[cat] || 0) + amt;
      total += amt;
    }

    return { total, byCat };
  }

  function getIceMilesKey(periodMode) {
    const m = String(periodMode || "").toLowerCase();
    if (m === "this-month") return "iceMilesThisMonth";
    if (m === "last-month") return "iceMilesLastMonth";
    return "iceMilesCustom";
  }

  function getIceMilesForPeriod(settings, periodMode) {
    const key = getIceMilesKey(periodMode);
    return clampNum(settings && settings[key], 0);
  }

  function setIceMilesForPeriod(settings, periodMode, miles) {
    const key = getIceMilesKey(periodMode);
    if (settings) settings[key] = clampNum(miles, 0);
  }

  // ---------- Compare v1 (legacy) ----------
  function buildCompare(entries, settings) {
    if (!entries.length) return null;

    const totalKwh = entries.reduce((s, e) => s + (e.kwh || 0), 0);
    const evCost = entries.reduce((s, e) => s + (e.kwh * e.price || 0), 0);

    const evMilesPerKwh =
      settings && typeof settings.evMilesPerKwh === "number" && isFinite(settings.evMilesPerKwh) && settings.evMilesPerKwh > 0
        ? settings.evMilesPerKwh
        : 2.8;

    const iceMpg =
      settings && typeof settings.iceMpg === "number" && isFinite(settings.iceMpg) && settings.iceMpg > 0
        ? settings.iceMpg
        : 45;

    const icePerLitreCurrent =
      settings && typeof settings.icePerLitre === "number" && isFinite(settings.icePerLitre) && settings.icePerLitre > 0
        ? settings.icePerLitre
        : 1.44;

    const miles = totalKwh * evMilesPerKwh;

    const gallons = iceMpg > 0 ? miles / iceMpg : 0;
    const litres = gallons * 4.54609;

    let iceCost = null;

    if (settings && Array.isArray(settings.icePerLitreHistory) && settings.icePerLitreHistory.length) {
      const hist = settings.icePerLitreHistory
        .map((x) => ({
          from: (x && typeof x.from === "string") ? x.from.slice(0, 10) : "",
          perLitre: (x && typeof x.perLitre === "number") ? x.perLitre : Number(x && x.perLitre)
        }))
        .filter((x) => x.from && /^d{4}-d{2}-d{2}$/.test(x.from) && isFinite(x.perLitre) && x.perLitre > 0)
        .sort((a, b) => (a.from || "").localeCompare(b.from || ""));

      const getPriceForDate = (d) => {
        const dd = (d && typeof d === "string") ? d.slice(0, 10) : "";
        if (!dd) return icePerLitreCurrent;
        for (let i = hist.length - 1; i >= 0; i--) {
          if (hist[i].from <= dd) return hist[i].perLitre;
        }
        return hist[0] ? hist[0].perLitre : icePerLitreCurrent;
      };

      iceCost = entries.reduce((sum, e) => {
        const kwh = Number(e && e.kwh) || 0;
        if (!kwh) return sum;

        const milesE = kwh * evMilesPerKwh;
        const gallonsE = iceMpg > 0 ? milesE / iceMpg : 0;
        const litresE = gallonsE * 4.54609;

        const p = getPriceForDate(e.date);
        return sum + litresE * p;
      }, 0);
    } else {
      iceCost = litres * icePerLitreCurrent;
    }

    const evPerMile = miles > 0 ? evCost / miles : 0;
    const icePerMile = miles > 0 ? iceCost / miles : 0;

    const publicRate = settings && typeof settings.public === "number" ? settings.public : 0;

    let allPublicCost = null;
    let savedVsPublic = null;

    if (publicRate > 0) {
      allPublicCost = totalKwh * publicRate;
      savedVsPublic = allPublicCost - evCost;
    }

    const hw = settings && typeof settings.chargerHardware === "number" ? settings.chargerHardware : 0;
    const inst = settings && typeof settings.chargerInstall === "number" ? settings.chargerInstall : 0;
    const chargerInvestment = hw + inst;

    let remainingToRecover = null;
    if (chargerInvestment > 0 && savedVsPublic !== null) {
      remainingToRecover = chargerInvestment - savedVsPublic;
    }

    return {
      totalKwh,
      evCost,
      miles,
      iceCost,
      iceMpg,
      icePerLitre: icePerLitreCurrent,
      evMilesPerKwh,
      evPerMile,
      icePerMile,
      publicRate,
      allPublicCost,
      savedVsPublic,
      chargerInvestment,
      remainingToRecover
    };
  }

  // ---------- Compare v2: costs-only totals + ICE equivalent fuel block ----------
  function buildCompareV2(state, period) {
    const entries = (state && Array.isArray(state.entries)) ? state.entries : [];
    const costs = (state && Array.isArray(state.costs)) ? state.costs : [];
    const settings = (state && state.settings) ? state.settings : {};
    const ui = (state && state.ui) ? state.ui : {};

    const periodMode = String(ui.periodMode || "this-month").toLowerCase();

    const ent = filterByPeriod(entries, period, (e) => e.date);
    const cs = filterByPeriod(costs, period, (c) => c.date);

    const totalKwh = ent.reduce((s, e) => s + clampNum(e && e.kwh, 0), 0);
    const evEnergyCost = ent.reduce(
      (s, e) => s + (clampNum(e && e.kwh, 0) * clampNum(e && e.price, 0)),
      0
    );

    const evMilesPerKwh =
      (typeof settings.evMilesPerKwh === "number" && isFinite(settings.evMilesPerKwh) && settings.evMilesPerKwh > 0)
        ? settings.evMilesPerKwh
        : 2.8;

    const iceMpg =
      (typeof settings.iceMpg === "number" && isFinite(settings.iceMpg) && settings.iceMpg > 0)
        ? settings.iceMpg
        : 45;

    const icePerLitre =
      (typeof settings.icePerLitre === "number" && isFinite(settings.icePerLitre) && settings.icePerLitre > 0)
        ? settings.icePerLitre
        : 1.44;

    const compareMode = "costs-only";

    // EV miles estimate (used for ICE equivalent fuel calc)
    const evMiles = totalKwh * evMilesPerKwh;

    // ICE equivalent fuel for SAME miles as EV estimate
    const iceEqMiles = evMiles;
    const iceEqFuelCost = iceFuelCostGBP(iceEqMiles, iceMpg, icePerLitre);

    // In costs-only totals: no ICE fuel/miles
    const iceMiles = 0;
    const iceFuelCost = 0;

    const evCosts = cs.filter((c) => (c && c.applies) === "ev");
    const iceCosts = cs.filter((c) => (c && c.applies) === "ice");
    const bothCosts = cs.filter((c) => (c && c.applies) === "both");
    const otherCosts = cs.filter((c) => (c && (c.applies === "other" || !c.applies)));

    const isInsurance = (c) => String(c && c.category || "").toLowerCase() === "insurance";

    const evMaint = sumByCategory(evCosts.filter((c) => !isInsurance(c)));
    const iceMaint = sumByCategory(iceCosts.filter((c) => !isInsurance(c)));
    const bothMaint = sumByCategory(bothCosts.filter((c) => !isInsurance(c)));
    const otherMaint = sumByCategory(otherCosts.filter((c) => !isInsurance(c)));

    const evIns = sumByCategory(evCosts.filter((c) => isInsurance(c)));
    const iceIns = sumByCategory(iceCosts.filter((c) => isInsurance(c)));
    const bothIns = sumByCategory(bothCosts.filter((c) => isInsurance(c)));
    const otherIns = sumByCategory(otherCosts.filter((c) => isInsurance(c)));

    const mode = String(settings.bothAllocationMode || "split").toLowerCase();
    const bothToEach = (mode === "double") ? bothMaint.total : (bothMaint.total / 2);
    const bothInsToEach = (mode === "double") ? bothIns.total : (bothIns.total / 2);

    const evTotal =
      evEnergyCost +
      evMaint.total +
      bothToEach +
      otherMaint.total +
      evIns.total +
      bothInsToEach +
      otherIns.total;

    const iceTotal =
      iceFuelCost +
      iceMaint.total +
      bothToEach +
      otherMaint.total +
      iceIns.total +
      bothInsToEach +
      otherIns.total;

    const iceTotalPlusEqFuel = iceTotal + iceEqFuelCost;

    return {
      compareMode,
      periodMode,

      totalKwh,
      evEnergyCost,

      evMilesPerKwh,
      evMiles,

      // kept (legacy fields)
      iceMiles,
      iceFuelCost,
      iceMpg,
      icePerLitre,

      // NEW: equivalent fuel based on EV estimated miles
      iceEqMiles,
      iceEqFuelCost,
      iceTotalPlusEqFuel,

      maintenance: {
        ev: evMaint,
        ice: iceMaint,
        both: bothMaint,
        other: otherMaint,
        bothAllocationMode: mode
      },

      insurance: {
        ev: evIns,
        ice: iceIns,
        both: bothIns,
        other: otherIns,
        bothAllocationMode: mode
      },

      evTotal,
      iceTotal,

      evPerMile: 0,
      icePerMile: 0
    };
  }

  window.EVCalc = {
    buildSummary,
    buildCompare,
    buildCompareV2,
    getIceMilesForPeriod,
    setIceMilesForPeriod,
    iceFuelCostGBP
  };
})();