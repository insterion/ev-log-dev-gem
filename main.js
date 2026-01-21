/* main.js - Edit & Offline Support Version */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, setDoc, updateDoc, enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- PASTE YOUR FIREBASE CONFIG HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyA-FbmvdK3eaYUsaT9Iqc3dUILH4rYDe8U",
  authDomain: "ev-log-2487f.firebaseapp.com",
  projectId: "ev-log-2487f",
  storageBucket: "ev-log-2487f.firebasestorage.app",
  messagingSenderId: "313386156743",
  appId: "1:313386156743:web:8451e533f1af823c0534e2"
};
// ---------------------------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- ENABLE OFFLINE PERSISTENCE ---
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.log('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
    } else if (err.code == 'unimplemented') {
        console.log('The current browser does not support all of the features required to enable persistence');
    }
});

// App State
const State = {
    user: null,
    logs: [],
    costs: [],
    garage: { ev: {}, ice: {} },
    settings: { evEff: 3.0, iceMpg: 44, fuelPrice: 1.45 },
    currentGarageTab: 'ev',
    editLogId: null,  // ID на записа, който редактираме в момента
    editCostId: null  // ID на разхода, който редактираме
};

// --- AUTH LOGIC ---
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const userEmailSpan = document.getElementById('user-email');

btnLogin.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => alert("Login failed: " + error.message));
});

btnLogout.addEventListener('click', () => {
    signOut(auth);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        State.user = user;
        loginScreen.style.display = 'none';
        appContent.style.display = 'block';
        if(userEmailSpan) userEmailSpan.innerText = user.email;
        initDataListeners();
        initUI();
    } else {
        State.user = null;
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

// --- FIRESTORE LISTENERS ---
let unsubscribeLogs, unsubscribeCosts, unsubscribeGarage, unsubscribeSettings;

function initDataListeners() {
    const uid = State.user.uid;

    // Logs
    const qLogs = query(collection(db, "logs"), where("uid", "==", uid));
    unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
        State.logs = [];
        snapshot.forEach((doc) => State.logs.push({ id: doc.id, ...doc.data() }));
        State.logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderLogList();
        updateStats();
    });

    // Costs
    const qCosts = query(collection(db, "costs"), where("uid", "==", uid));
    unsubscribeCosts = onSnapshot(qCosts, (snapshot) => {
        State.costs = [];
        snapshot.forEach((doc) => State.costs.push({ id: doc.id, ...doc.data() }));
        State.costs.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderCostsList();
        updateStats();
    });

    // Garage
    const qGarage = query(collection(db, "garage"), where("uid", "==", uid));
    unsubscribeGarage = onSnapshot(qGarage, (snapshot) => {
        State.garage = { ev: {}, ice: {} };
        snapshot.forEach((doc) => {
            const data = doc.data();
            if(data.carType === 'ev') State.garage.ev = data;
            if(data.carType === 'ice') State.garage.ice = data;
        });
        loadGarageDataToUI();
    });

    // Settings
    unsubscribeSettings = onSnapshot(doc(db, "settings", uid), (docSnap) => {
        if (docSnap.exists()) {
            State.settings = docSnap.data();
            loadSettingsToUI();
            updateStats();
        }
    });
}

// --- DATABASE ACTIONS (CRUD) ---

// LOGS
async function dbAddLog(entry) {
    try { await addDoc(collection(db, "logs"), { ...entry, uid: State.user.uid }); } 
    catch (e) { alert("Error: " + e.message); }
}
async function dbUpdateLog(id, entry) {
    try { await updateDoc(doc(db, "logs", id), entry); } 
    catch (e) { alert("Error updating: " + e.message); }
}
async function dbDeleteLog(id) {
    try { await deleteDoc(doc(db, "logs", id)); } catch(e) { console.error(e); }
}

// COSTS
async function dbAddCost(entry) {
    try { await addDoc(collection(db, "costs"), { ...entry, uid: State.user.uid }); } 
    catch (e) { alert("Error: " + e.message); }
}
async function dbUpdateCost(id, entry) {
    try { await updateDoc(doc(db, "costs", id), entry); } 
    catch (e) { alert("Error updating: " + e.message); }
}
async function dbDeleteCost(id) {
    try { await deleteDoc(doc(db, "costs", id)); } catch(e) { console.error(e); }
}

// GARAGE & SETTINGS
async function dbSaveGarage(type, data) {
    const docId = `${State.user.uid}_${type}`;
    try {
        await setDoc(doc(db, "garage", docId), { ...data, uid: State.user.uid, carType: type });
        alert("Garage Saved!");
    } catch (e) { alert("Error: " + e.message); }
}
async function dbSaveSettings(settings) {
    try { await setDoc(doc(db, "settings", State.user.uid), settings); alert("Settings Saved!"); } 
    catch (e) { alert("Error: " + e.message); }
}

// --- UI LOGIC ---

function initUI() {
    bindNav();
    bindLogForm();
    bindCostsForm();
    bindGarage();
    bindSettings();
    bindCompare();
    
    // Set Today
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('date')) document.getElementById('date').value = today;
    if(document.getElementById('c_date')) document.getElementById('c_date').value = today;
}

function bindNav() {
    document.querySelectorAll('.tabbtn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tabbtn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            const t = document.getElementById(btn.dataset.tab);
            if(t) t.classList.add('active');
            if(btn.dataset.tab === 'compare') updateStats();
            if(btn.dataset.tab === 'garage') loadGarageDataToUI();
        });
    });
}

// --- LOG FORM LOGIC (With Edit) ---
function bindLogForm() {
    const btnAdd = document.getElementById('addEntry');
    const typeSelect = document.getElementById('type');
    const priceInput = document.getElementById('price');
    const kwhInput = document.getElementById('kwh');
    
    // Auto Price logic
    typeSelect.addEventListener('change', () => {
        // Only change price if we are NOT in edit mode OR if user explicitly changed type
        // Actually, simple logic: if user changes type, update price.
        const opt = typeSelect.options[typeSelect.selectedIndex];
        if(opt && opt.dataset.price) {
            priceInput.value = opt.dataset.price;
            priceInput.setAttribute('readonly', true);
            priceInput.style.opacity = "0.7";
            priceInput.style.background = "#333";
        } else {
            priceInput.removeAttribute('readonly');
            priceInput.style.opacity = "1";
            priceInput.style.background = "#222";
        }
        updateLogPreview();
    });

    kwhInput.addEventListener('input', updateLogPreview);
    priceInput.addEventListener('input', updateLogPreview);

    btnAdd.addEventListener('click', () => {
        const date = document.getElementById('date').value;
        const kwh = parseFloat(kwhInput.value);
        const price = parseFloat(priceInput.value);
        const type = typeSelect.options[typeSelect.selectedIndex].text;
        const note = document.getElementById('note').value;

        if(!date || isNaN(kwh) || isNaN(price)) return alert('Missing fields');
        const entryData = { date, kwh, price, type, note, total: kwh * price };

        if (State.editLogId) {
            // UPDATE MODE
            dbUpdateLog(State.editLogId, entryData);
            // Reset UI
            State.editLogId = null;
            btnAdd.innerText = "Add Entry";
            btnAdd.classList.remove("update-mode-btn");
        } else {
            // CREATE MODE
            dbAddLog(entryData);
        }

        // Clear form
        kwhInput.value = '';
        document.getElementById('note').value = '';
        document.getElementById('log-preview').style.display = 'none';
    });
}

function updateLogPreview() {
    const kwh = parseFloat(document.getElementById('kwh').value) || 0;
    const price = parseFloat(document.getElementById('price').value) || 0;
    const div = document.getElementById('log-preview');
    if(kwh <= 0 || price <= 0) { div.style.display = 'none'; return; }

    const range = kwh * State.settings.evEff;
    const costEV = kwh * price;
    const costICE = (range / State.settings.iceMpg) * 4.54609 * State.settings.fuelPrice;
    const diff = costICE - costEV;
    const isCheaper = diff > 0;

    div.style.display = 'block';
    div.innerHTML = `
        <div style="background: #222; border: 1px solid ${isCheaper?'#4CAF50':'#f44336'}; padding:10px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; font-size:0.9em; color:#ccc;">
                <span>EV: £${costEV.toFixed(2)}</span>
                <span>ICE: £${costICE.toFixed(2)}</span>
            </div>
            <div style="text-align:center; margin-top:5px; font-weight:bold; color:${isCheaper?'#4CAF50':'#f44336'}">
                ${isCheaper?'СПЕСТЯВАШ':'ЗАГУБА'} £${Math.abs(diff).toFixed(2)}
            </div>
        </div>`;
}

function renderLogList() {
    const div = document.getElementById('logTable');
    let html = '';
    State.logs.forEach(l => {
        const cost = l.total || (l.kwh * l.price);
        html += `
        <div class="log-entry" id="log-row-${l.id}">
            <div class="log-info">
                <div class="log-main-row">
                    <span>${l.kwh} kWh</span>
                    <span class="cost-tag">£${cost.toFixed(2)}</span>
                </div>
                <div class="log-sub-row">
                    <span>${l.date}</span><span>•</span><span>${l.type}</span>
                </div>
                ${l.note ? `<div class="log-note">${l.note}</div>` : ''}
            </div>
            <div class="action-btn-group">
                <button class="edit-btn" id="edit-log-${l.id}">✎</button>
                <button class="delete-btn" id="del-log-${l.id}">×</button>
            </div>
        </div>`;
    });
    div.innerHTML = html || '<p style="text-align:center; color:#666; padding:20px;">Няма записи</p>';

    // Attach Events
    State.logs.forEach(l => {
        // Delete
        document.getElementById(`del-log-${l.id}`).addEventListener('click', () => {
            if(confirm('Delete?')) dbDeleteLog(l.id);
        });
        // Edit
        document.getElementById(`edit-log-${l.id}`).addEventListener('click', () => {
            // Populate Form
            document.getElementById('date').value = l.date;
            document.getElementById('kwh').value = l.kwh;
            document.getElementById('price').value = l.price;
            document.getElementById('note').value = l.note || '';
            
            // Try to set type. Hard because text might vary with emojis. 
            // Simple approach: loop options and see if text matches.
            const sel = document.getElementById('type');
            for(let i=0; i<sel.options.length; i++) {
                if(sel.options[i].text === l.type) {
                    sel.selectedIndex = i;
                    break;
                }
            }

            // Set UI to Edit Mode
            State.editLogId = l.id;
            const btn = document.getElementById('addEntry');
            btn.innerText = "Update Entry";
            btn.classList.add("update-mode-btn");
            
            // Scroll to top
            document.querySelector('#log').scrollIntoView({behavior: 'smooth'});
            updateLogPreview();
        });
    });
}

// --- COSTS FORM LOGIC (With Edit) ---
function bindCostsForm() {
    const btnAdd = document.getElementById('c_add');
    
    btnAdd.addEventListener('click', () => {
        const date = document.getElementById('c_date').value;
        const amount = parseFloat(document.getElementById('c_amount').value);
        const cat = document.getElementById('c_category').value;
        const note = document.getElementById('c_note').value;
        const target = document.getElementById('c_target').value;

        if(!date || !amount) return alert('Enter amount and date');
        
        const entryData = { date, amount, cat, note, target };

        if (State.editCostId) {
            // UPDATE
            dbUpdateCost(State.editCostId, entryData);
            State.editCostId = null;
            btnAdd.innerText = "Add Cost";
            btnAdd.classList.remove("update-mode-btn");
        } else {
            // ADD
            dbAddCost(entryData);
        }
        
        document.getElementById('c_amount').value = '';
        document.getElementById('c_note').value = '';
    });
}

function renderCostsList() {
    const div = document.getElementById('costTable');
    let html = '';
    State.costs.forEach(c => {
        const isIce = c.target === 'ice';
        const icon = isIce ? '⛽' : '⚡';
        html += `
        <div class="log-entry" style="border-left: 3px solid ${isIce ? '#f44336' : '#4CAF50'}; padding-left:10px;">
            <div class="log-info">
                <div class="log-main-row">
                    <span>£${parseFloat(c.amount).toFixed(2)}</span>
                    <span style="font-size:0.8em; font-weight:normal; color:#aaa;">${icon} ${c.cat}</span>
                </div>
                <div class="log-sub-row"><span>${c.date}</span></div>
                ${c.note ? `<div class="log-note">${c.note}</div>` : ''}
            </div>
            <div class="action-btn-group">
                <button class="edit-btn" id="edit-cost-${c.id}">✎</button>
                <button class="delete-btn" id="del-cost-${c.id}">×</button>
            </div>
        </div>`;
    });
    div.innerHTML = html || '<p style="text-align:center; color:#666; padding:20px;">Няма разходи</p>';
    
    State.costs.forEach(c => {
        document.getElementById(`del-cost-${c.id}`).addEventListener('click', () => {
            if(confirm('Delete?')) dbDeleteCost(c.id);
        });
        document.getElementById(`edit-cost-${c.id}`).addEventListener('click', () => {
            document.getElementById('c_date').value = c.date;
            document.getElementById('c_amount').value = c.amount;
            document.getElementById('c_category').value = c.cat;
            document.getElementById('c_note').value = c.note || '';
            document.getElementById('c_target').value = c.target;

            State.editCostId = c.id;
            const btn = document.getElementById('c_add');
            btn.innerText = "Update Cost";
            btn.classList.add("update-mode-btn");
            
            document.querySelector('#costs').scrollIntoView({behavior: 'smooth'});
        });
    });
}

// --- GARAGE, SETTINGS, STATS (Same as before) ---
function bindGarage() {
    const btnEv = document.getElementById('btn-sw-ev');
    const btnIce = document.getElementById('btn-sw-ice');
    
    btnEv.addEventListener('click', () => {
        State.currentGarageTab = 'ev';
        btnEv.classList.add('active'); btnIce.classList.remove('active');
        document.getElementById('garage-title').innerText = '🔔 Напомняния (EV)';
        loadGarageDataToUI();
    });
    
    btnIce.addEventListener('click', () => {
        State.currentGarageTab = 'ice';
        btnIce.classList.add('active'); btnEv.classList.remove('active');
        document.getElementById('garage-title').innerText = '🔔 Напомняния (ICE)';
        loadGarageDataToUI();
    });

    document.getElementById('saveGarageManual').addEventListener('click', () => {
        const ids = ['g_insurance', 'g_mot', 'g_tax', 'g_service', 'g_plate', 'g_vin', 'g_tyre_f', 'g_tyre_r', 'g_notes'];
        let dataToSave = {};
        ids.forEach(id => {
            const el = document.getElementById(id);
            if(el) dataToSave[id] = el.value;
        });
        dbSaveGarage(State.currentGarageTab, dataToSave);
    });
}

function loadGarageDataToUI() {
    const currentData = State.garage[State.currentGarageTab] || {};
    const ids = ['g_insurance', 'g_mot', 'g_tax', 'g_service', 'g_plate', 'g_vin', 'g_tyre_f', 'g_tyre_r', 'g_notes'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = currentData[id] || ""; });
    updateGarageStatus();
}

function updateGarageStatus() {
    const checkDate = (id, statusId) => {
        const val = document.getElementById(id).value;
        const el = document.getElementById(statusId);
        if(!el) return;
        if(!val) { el.innerText = "--"; el.className = "status-badge"; return; }
        const diff = Math.ceil((new Date(val) - new Date()) / (1000 * 60 * 60 * 24)); 
        if(diff < 0) { el.innerText = `ИЗТЕКЛО!`; el.className = "status-badge status-danger"; } 
        else if (diff <= 30) { el.innerText = `${diff} дни`; el.className = "status-badge status-warning"; } 
        else { el.innerText = `${diff} дни`; el.className = "status-badge status-ok"; }
    };
    checkDate('g_insurance', 'status_insurance');
    checkDate('g_mot', 'status_mot');
    checkDate('g_tax', 'status_tax');
    checkDate('g_service', 'status_service');
}

function bindSettings() {
    document.getElementById('saveCompareSettings').addEventListener('click', () => {
        const s = {
            evEff: parseFloat(document.getElementById('set_ev_eff').value),
            iceMpg: parseFloat(document.getElementById('set_ice_mpg').value),
            fuelPrice: parseFloat(document.getElementById('set_fuel_price').value)
        };
        dbSaveSettings(s);
    });
}

function loadSettingsToUI() {
    const s = State.settings;
    if(document.getElementById('set_ev_eff')) document.getElementById('set_ev_eff').value = s.evEff;
    if(document.getElementById('set_ice_mpg')) document.getElementById('set_ice_mpg').value = s.iceMpg;
    if(document.getElementById('set_fuel_price')) document.getElementById('set_fuel_price').value = s.fuelPrice;
}

function bindCompare() {
    document.getElementById('btn-calc-trip').addEventListener('click', () => {
        const dist = parseFloat(document.getElementById('cmp-dist').value);
        if(!dist) return;
        const evP = parseFloat(document.getElementById('price').value) || 0.56;
        const evC = (dist/State.settings.evEff)*evP;
        const iceC = (dist/State.settings.iceMpg)*4.54609*State.settings.fuelPrice;
        const diff = iceC - evC;
        document.getElementById('compare-result').innerHTML = `
            <div style="background:#222; padding:10px; margin-top:10px; border-radius:5px; border-left:4px solid ${diff>0?'#4CAF50':'#f44336'}">
                <div>EV: £${evC.toFixed(2)} vs ICE: £${iceC.toFixed(2)}</div>
                <div style="font-weight:bold; color:${diff>0?'#4CAF50':'#f44336'}">${diff>0?'Save':'Loss'} £${Math.abs(diff).toFixed(2)}</div>
            </div>`;
    });
}

function updateStats() {
    const div = document.getElementById('tco-dashboard');
    if(!State.logs.length && !State.costs.length) { if(div) div.style.display = 'none'; return; }
    if(div) div.style.display = 'block';

    let evCharge = 0, kwhTot = 0;
    State.logs.forEach(l => { evCharge += (l.total || l.kwh*l.price); kwhTot += parseFloat(l.kwh); });
    
    let evMaint = 0, iceMaint = 0;
    State.costs.forEach(c => {
        if(c.target === 'ice') iceMaint += parseFloat(c.amount);
        else evMaint += parseFloat(c.amount);
    });

    const miles = kwhTot * State.settings.evEff;
    const iceFuel = (miles / State.settings.iceMpg) * 4.54609 * State.settings.fuelPrice;
    const totalEV = evCharge + evMaint;
    const totalICE = iceFuel + iceMaint;
    const savings = totalICE - totalEV;

    const setText = (id, txt) => { const e=document.getElementById(id); if(e) e.innerText=txt; };
    setText('stat-miles', miles.toFixed(0));
    setText('stat-ev-charge', '£'+evCharge.toFixed(2));
    setText('stat-ev-maint', '£'+evMaint.toFixed(2));
    setText('stat-ice-fuel', '£'+iceFuel.toFixed(2));
    setText('stat-ice-maint', '£'+iceMaint.toFixed(2));

    const card = document.getElementById('tco-card');
    if(card) {
        const color = savings >= 0 ? '#4CAF50' : '#f44336';
        card.style.border = `2px solid ${color}`;
        card.innerHTML = `
            <div style="color:#ccc; font-size:0.9em">Общ Баланс</div>
            <div style="font-size:1.8em; font-weight:bold; color:${color}; margin:5px 0">
                ${savings>0?'+':''}£${savings.toFixed(2)}
            </div>
            <div style="color:#666; font-size:0.8em">ICE (£${totalICE.toFixed(0)}) vs EV (£${totalEV.toFixed(0)})</div>
        `;
    }
    if (typeof Chart !== 'undefined') renderChart();
}

function renderChart() {
    const ctx = document.getElementById('tcoChart');
    if(!ctx) return;
    
    let events = [];
    State.logs.forEach(l => events.push({ date: l.date, ev: (l.total||l.kwh*l.price), ice: (l.kwh*State.settings.evEff/State.settings.iceMpg)*4.54609*State.settings.fuelPrice }));
    State.costs.forEach(c => events.push({ date: c.date, ev: (c.target!=='ice'?parseFloat(c.amount):0), ice: (c.target==='ice'?parseFloat(c.amount):0) }));
    events.sort((a,b) => new Date(a.date) - new Date(b.date));
    
    let labels=[], dEv=[], dIce=[], cEv=0, cIce=0;
    events.forEach(e => {
        cEv += e.ev; cIce += e.ice;
        labels.push(e.date); dEv.push(cEv); dIce.push(cIce);
    });

    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'ICE', data: dIce, borderColor: '#f44336', fill: false, pointRadius: 0 },
                { label: 'EV', data: dEv, borderColor: '#4CAF50', fill: false, pointRadius: 0 }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            scales: { x: { display: false }, y: { grid: { color: '#333' } } },
            plugins: { legend: { display: false } }
        }
    });
}
