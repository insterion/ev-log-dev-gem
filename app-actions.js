// app-actions.js – add/edit/delete handlers + table click handlers

(function () {
  const A = window.EVApp;
  const U = A.U;

  function resetEditMode() {
    A.currentEditId = null;
    const addBtn = A.$("addEntry");
    if (addBtn) addBtn.textContent = "Add entry";
  }

  function resetCostEditMode() {
    A.currentEditCostId = null;
    const btn = A.$("c_add");
    if (btn) btn.textContent = "Add cost";
  }

  function startEditEntry(id) {
    if (!id) return U.toast("Missing entry id", "bad");
    const entry = (A.state.entries || []).find((e) => e.id === id);
    if (!entry) return U.toast("Entry not found", "bad");

    A.currentEditId = id;

    A.$("date").value = entry.date || A.todayISO();
    A.$("kwh").value = entry.kwh;
    A.$("type").value = entry.type;
    A.$("price").value = entry.price;
    A.$("note").value = entry.note || "";

    const addBtn = A.$("addEntry");
    if (addBtn) addBtn.textContent = "Update entry";

    U.toast("Editing entry", "info");
  }

  function startEditCost(id) {
    if (!id) return U.toast("Missing cost id", "bad");
    const cost = (A.state.costs || []).find((c) => c.id === id);
    if (!cost) return U.toast("Cost not found", "bad");

    A.currentEditCostId = id;

    A.$("c_date").value = cost.date || A.todayISO();
    A.$("c_category").value = cost.category || "Tyres";
    A.$("c_amount").value = cost.amount;
    A.$("c_note").value = cost.note || "";

    const appliesSelect = A.$("c_applies");
    if (appliesSelect) {
      const v = (cost.applies || "other").toLowerCase();
      appliesSelect.value = (v === "ev" || v === "ice" || v === "both" || v === "other") ? v : "other";
    }

    const btn = A.$("c_add");
    if (btn) btn.textContent = "Update cost";

    U.toast("Editing cost", "info");
  }

  function getAppliesFromForm() {
    const el = A.$("c_applies");
    if (!el) return "other";
    const v = (el.value || "").toLowerCase();
    return (v === "ev" || v === "ice" || v === "both" || v === "other") ? v : "other";
  }

  function onAddEntry() {
    const date = A.$("date").value || A.todayISO();
    const kwh = parseFloat(A.$("kwh").value);
    const type = A.$("type").value;
    let price = parseFloat(A.$("price").value);
    const note = (A.$("note").value || "").trim();

    if (isNaN(kwh) || kwh <= 0) return U.toast("Please enter kWh", "bad");

    if (isNaN(price) || price <= 0) price = A.autoPriceForType(type);

    if (!A.currentEditId) {
      const entry = {
        id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : "e_" + Date.now().toString(36),
        date, kwh, type, price, note
      };
      A.state.entries.push(entry);
      A.saveState();
      A.Render.renderAll();
      U.toast("Entry added", "good");
      return;
    }

    const idx = A.state.entries.findIndex((e) => e.id === A.currentEditId);
    if (idx === -1) {
      U.toast("Entry to update not found", "bad");
      return resetEditMode();
    }

    const entry = A.state.entries[idx];
    entry.date = date;
    entry.kwh = kwh;
    entry.type = type;
    entry.price = price;
    entry.note = note;

    A.saveState();
    A.Render.renderAll();
    U.toast("Entry updated", "good");
    resetEditMode();
  }

  function onSameAsLast() {
    if (!A.state.entries.length) return U.toast("No previous entry", "info");
    const last = A.state.entries[A.state.entries.length - 1];

    A.$("date").value = last.date;
    A.$("kwh").value = last.kwh;
    A.$("type").value = last.type;
    A.$("price").value = last.price;
    A.$("note").value = last.note || "";

    U.toast("Filled from last", "info");
  }

  function onAddCost() {
    const date = A.$("c_date").value || A.todayISO();
    const category = A.$("c_category").value;
    const amount = parseFloat(A.$("c_amount").value);
    const note = (A.$("c_note").value || "").trim();
    const applies = getAppliesFromForm();

    if (isNaN(amount) || amount <= 0) return U.toast("Please enter amount", "bad");

    if (!A.currentEditCostId) {
      const cost = {
        id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : "c_" + Date.now().toString(36),
        date, category, amount, note, applies
      };
      A.state.costs.push(cost);
      A.saveState();
      A.Render.renderAll();
      U.toast("Cost added", "good");
      return;
    }

    const idx = A.state.costs.findIndex((c) => c.id === A.currentEditCostId);
    if (idx === -1) {
      U.toast("Cost to update not found", "bad");
      return resetCostEditMode();
    }

    const cost = A.state.costs[idx];
    cost.date = date;
    cost.category = category;
    cost.amount = amount;
    cost.note = note;
    cost.applies = applies;

    A.saveState();
    A.Render.renderAll();
    U.toast("Cost updated", "good");
    resetCostEditMode();
  }

  function handleDeleteEntry(id) {
    if (!id) return U.toast("Missing entry id", "bad");
    const idx = A.state.entries.findIndex((e) => e.id === id);
    if (idx === -1) return U.toast("Entry not found", "bad");
    if (!window.confirm("Delete this entry?")) return;

    A.state.entries.splice(idx, 1);
    if (A.currentEditId === id) resetEditMode();
    A.saveState();
    A.Render.renderAll();
    U.toast("Entry deleted", "good");
  }

  function handleDeleteCost(id) {
    if (!id) return U.toast("Missing cost id", "bad");
    const idx = A.state.costs.findIndex((c) => c.id === id);
    if (idx === -1) return U.toast("Cost not found", "bad");
    if (!window.confirm("Delete this cost?")) return;

    A.state.costs.splice(idx, 1);
    if (A.currentEditCostId === id) resetCostEditMode();
    A.saveState();
    A.Render.renderAll();
    U.toast("Cost deleted", "good");
  }

  function onLogTableClick(ev) {
    const btn = ev.target && ev.target.closest && ev.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    if (action === "delete-entry") handleDeleteEntry(id);
    else if (action === "edit-entry") startEditEntry(id);
  }

  function onCostTableClick(ev) {
    const btn = ev.target && ev.target.closest && ev.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    if (action === "delete-cost") handleDeleteCost(id);
    else if (action === "edit-cost") startEditCost(id);
  }

  window.EVApp.Actions = {
    resetEditMode,
    resetCostEditMode,
    onAddEntry,
    onSameAsLast,
    onAddCost,
    onLogTableClick,
    onCostTableClick,
    startEditEntry,
    startEditCost
  };
})();
