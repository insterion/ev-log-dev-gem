/* main.js - Version: Full, Fixed Dynamic Home Price & Garage Toggle, Fixed Charts */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, setDoc, updateDoc, enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-FbmvdK3eaYUsaT9Iqc3dUILH4rYDe8U",
  authDomain: "ev-log-2487f.firebaseapp.com",
  projectId: "ev-log-2487f",
  storageBucket: "ev-log-2487f.firebasestorage.app",
  messagingSenderId: "313386156743",
  appId: "1:313386156743:web:8451e533f1af823c0534e2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

enableIndexedDbPersistence(db).catch((err) => {
    console.log("Persistence logic:", err.code);
});

// Състояние на приложението
const State = {
    user: null,
    logs: [],
    costs: [],
    garage: { ev: {}, ice: {} },
    settings: { homePrice: 0.24, evEff: 3.0, iceMpg: 44, fuelPrice: 1.45 },
    currentGarageTab: 'ev',
    editLogId: null,
    editCostId: null,
    chartMode: 'cumulative' 
};

// AUTH LOGIC
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const userEmailSpan = document.getElementById('user-email');

btnLogin.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => alert("Login failed: " + error.message));
});

btnLogout.addEventListener('click', () => signOut(auth));

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

// DATA LISTENERS
let unsubscribeLogs, unsubscribeCosts, unsubscribeGarage, unsubscribeSettings;

function initDataListeners() {
    const uid = State.user.uid;

    const qLogs = query(collection(db, "logs"), where("uid", "==", uid));
    unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
        State.logs = [];
        snapshot.forEach((doc) => State.logs.push({ id: doc.id, ...doc.data() }));
        State.logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderLogList();
        renderHomeDashboard();
        updateStats();
    });

    const qCosts = query(collection(db, "costs"), where("uid", "==", uid));
    unsubscribeCosts = onSnapshot(qCosts, (snapshot) => {
        State.costs = [];
        snapshot.forEach((doc) => State.costs.push({ id: doc.id, ...doc.data() }));
        State.costs.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderCostsList();
        updateStats();
    });

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

    unsubscribeSettings = onSnapshot(doc(db, "settings", uid), (docSnap) => {
        if (docSnap.exists()) {
            State.settings = { ...State.settings, ...docSnap.data() };
            loadSettingsToUI();
            updateStats();
        } else {
            loadSettingsToUI();
        }
    });
}

// DATABASE ACTIONS
async function dbAddLog(entry) { try { await addDoc(collection(db, "logs"), { ...entry, uid: State.user.uid }); } catch (e) { alert("Error: " + e.message); } }
async function dbUpdateLog(id, entry) { try { await updateDoc(doc(db, "logs", id), entry); } catch (e) { alert("Error: " + e.message); } }
async function dbDeleteLog(id) { try { await deleteDoc(doc(db, "logs", id)); } catch(e) { console.error(e); } }
async function dbAddCost(entry) { try { await addDoc(collection(db, "costs"), { ...entry, uid: State.user.uid }); } catch (e) { alert("Error: " + e.message); } }
async function dbUpdateCost(id, entry) { try { await updateDoc(doc(db, "costs", id), entry); } catch (e) { alert("Error: " + e.message); } }
async function dbDeleteCost(id) { try { await deleteDoc(doc(db, "costs", id)); } catch(e) { console.error(e); } }
async function dbSaveGarage(type, data) {
    const docId = `${State.user.uid}_${type}`;
    try { await setDoc(doc(db, "garage", docId), { ...data, uid: State.user.uid, carType: type }); alert("Garage Saved!"); } catch (e) { alert("Error: " + e.message); }
}
async function dbSaveSettings(settings) {
    try { await setDoc(doc(db, "settings", State.user.uid), settings); alert("Settings Saved!"); } catch (e) { alert("Error: " + e.message); }
}

// EXPORT/IMPORT
function exportToCSV(data, filename) {
    if (!data || !data.length) { alert("Няма данни."); return; }
    let headers = [];
    if(filename.includes("Logs")) headers = ["Date", "Odometer", "Type", "KWh", "Price", "Total", "Note"];
    else headers = ["Date", "Amount", "Category", "Target", "Note"];

    let csvContent = headers.join(",") + "\n";
    data.forEach(row => {
        let rowStr = "";
        if(filename.includes("Logs")) {
            rowStr = [
                row.date, row.odo || '', `"${row.type}"`, row.kwh, row.price,
                (row.total || (row.kwh*row.price)).toFixed(2),
                `"${(row.note || '').replace(/"/g, '""')}"`
            ].join(",");
        } else {
            rowStr = [
                row.date, row.amount, `"${row.cat || row.category}"`, `"${row.target || row.car}"`,
                `"${(row.note || '').replace(/"/g, '""')}"`
            ].join(",");
        }
        csvContent += rowStr + "\n";
    });
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim() !== '');
    if(lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const result = [];
    for(let i=1; i<lines.length; i++) {
        let row = []; let currentToken = ''; let insideQuote = false;
        for(let char of lines[i]) {
            if(char === '"') insideQuote = !insideQuote; 
            else if(char === ',' && !insideQuote) { row.push(currentToken); currentToken = ''; } 
            else currentToken += char;
        }
        row.push(currentToken);
        row = row.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        let obj = {};
        headers.forEach((h, index) => { if(row[index] !== undefined) obj[h] = row[index]; });
        result.push(obj);
    }
    return { type: headers.includes('KWh') ? 'logs' : 'costs', data: result };
}

async function importFromCSV(file) {
    if(!file) return alert("Избери файл.");
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const parsed = parseCSV(e.target.result);
            if(!parsed.data.length) return alert("Празен или невалиден файл.");
            if(!confirm(`Открити са ${parsed.data.length} записа (${parsed.type}). Да ги добавя ли?`)) return;
            let count = 0;
            if(parsed.type === 'logs') {
                for(let row of parsed.data) {
                    await dbAddLog({
                        date: row.Date, type: row.Type, kwh: parseFloat(row.KWh), price: parseFloat(row.Price),
                        total: parseFloat(row.Total), note: row.Note, odo: row.Odometer ? parseFloat(row.Odometer) : null
                    });
                    count++;
                }
            } else {
                for(let row of parsed.data) {
                    await dbAddCost({
                        date: row.Date, amount: parseFloat(row.Amount), cat: row.Category, car: row.Target, note: row.Note
                    });
                    count++;
                }
            }
            alert(`Успешно добавени ${count} записа!`);
            document.getElementById('importFile').value = '';
        } catch(err) { alert("Грешка при импорт: " + err.message); }
    };
    reader.readAsText(file);
}

// UI INIT
function initUI() {
    bindNav();
    bindLogForm();
    bindGarage();
    bindSettings();
    bindCompare();
    bindChartControls();
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

function renderHomeDashboard() {
    const div = document.getElementById('home-stats');
    if(!div) return;
    if(State.logs.length === 0) {
        div.innerHTML = `<div style="grid-column: span 2; text-align:center; color:#666; font-style:italic;">Няма данни</div>`;
        return;
    }
    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7);
    const monthLogs = State.logs.filter(l => l.date.startsWith(currentMonthKey));
    let totalCost = 0, totalKwh = 0, totalDist = 0;

    monthLogs.forEach(l => {
        totalCost += (l.total || l.kwh * l.price);
        totalKwh += l.kwh;
        if(l.odo) {
             const currentIndex = State.logs.findIndex(x => x.id === l.id);
             if(currentIndex !== -1) {
                 for(let j = currentIndex + 1; j < State.logs.length; j++) {
                     if(State.logs[j].odo) {
                         totalDist += (l.odo - State.logs[j].odo);
                         break;
                     }
                 }
             }
        }
    });

    const avgEff = totalKwh > 0 && totalDist > 0 ? (totalDist / totalKwh).toFixed(1) : "---";
    const lastLogDate = new Date(State.logs[0].date);
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const logMidnight = new Date(lastLogDate.getFullYear(), lastLogDate.getMonth(), lastLogDate.getDate());
    const diffDays = Math.ceil(Math.abs(todayMidnight - logMidnight) / (1000 * 60 * 60 * 24)); 
    let daysText = diffDays === 0 ? "Днес" : (diffDays === 1 ? "Вчера" : `${diffDays} дни`);

    div.innerHTML = `
        <div style="background:#222; padding:15px; border-radius:12px; border-left:5px solid #4CAF50; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            <div style="font-size:0.85rem; color:#aaa; margin-bottom:8px;">Този Месец</div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px;">
                <span style="font-size:1.6rem; font-weight:800; color:#fff;">£${totalCost.toFixed(2)}</span>
                <span style="font-size:0.9rem; color:#4CAF50; font-weight:bold;">${avgEff} mi/kWh</span>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px solid #333; padding-top:5px; font-size:0.85rem; color:#ccc;">
                <span>${totalDist > 0 ? totalDist : 0} mi</span><span>${totalKwh.toFixed(0)} kWh</span>
            </div>
        </div>
        <div style="background:#222; padding:15px; border-radius:12px; border-left:5px solid #2196F3; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            <div style="font-size:0.85rem; color:#aaa; margin-bottom:8px;">Последно</div>
            <div style="font-size:1.6rem; font-weight:800; color:#fff; margin-bottom:5px;">${daysText}</div>
            <div style="font-size:0.85rem; color:#888;">${State.logs[0].date}</div>
            <div style="margin-top:5px; font-size:0.85rem; color:#2196F3;">${State.logs[0].odo ? State.logs[0].odo + ' mi' : ''}</div>
        </div>
    `;
}

function bindLogForm() {
    const btnAdd = document.getElementById('addEntry');
    const typeSelect = document.getElementById('type');
    const priceInput = document.getElementById('price');
    const kwhInput = document.getElementById('kwh');
    const odoInput = document.getElementById('odo');
    
    const syncPrice = () => {
        if (btnAdd.classList.contains("update-mode-btn")) return;
        const opt = typeSelect.options[typeSelect.selectedIndex];
        
        if (opt.value === "home" || opt.text.includes("Home") || opt.text.includes("Домашно")) {
            priceInput.value = State.settings.homePrice || 0.24; 
        } else if(opt && opt.dataset.price) {
            priceInput.value = opt.dataset.price;
        }
        
        priceInput.style.opacity = "1";
        priceInput.style.background = "#2c2c2c";
        updateLogPreview();
    };

    typeSelect.addEventListener('change', syncPrice);
    kwhInput.addEventListener('input', updateLogPreview);
    priceInput.addEventListener('input', updateLogPreview);
    syncPrice();

    btnAdd.addEventListener('click', () => {
        const date = document.getElementById('date').value;
        const kwh = parseFloat(kwhInput.value);
        if (!priceInput.value) syncPrice();
        const price = parseFloat(priceInput.value);
        const type = typeSelect.options[typeSelect.selectedIndex].text;
        const note = document.getElementById('note').value;
        const odo = odoInput.value ? parseFloat(odoInput.value) : null;

        if(!date || isNaN(kwh) || isNaN(price)) return alert('Липсващи полета');
        const entryData = { date, kwh, price, type, note, odo, total: Number((kwh * price).toFixed(2)) };

        if (State.editLogId) {
            dbUpdateLog(State.editLogId, entryData);
            State.editLogId = null;
            btnAdd.innerText = "Add Entry";
            btnAdd.classList.remove("update-mode-btn");
        } else {
            dbAddLog(entryData);
        }
        
        kwhInput.value = ''; odoInput.value = ''; document.getElementById('note').value = '';
        document.getElementById('log-preview').style.display = 'none';
        syncPrice(); 
    });
}

function updateLogPreview() {
    const kwh = parseFloat(document.getElementById('kwh').value) || 0;
    const price = parseFloat(document.getElementById('price').value) || 0;
    const div = document.getElementById('log-preview');
    if(kwh <= 0 || price <= 0) { div.style.display = 'none'; return; }

    const range = kwh * (State.settings.evEff || 3.0);
    const costEV = kwh * price;
    const costICE = (range / (State.settings.iceMpg || 45)) * 4.54609 * (State.settings.fuelPrice || 1.45);
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

    const ICE_MPG = State.settings.iceMpg || 45;
    const ICE_FUEL_PRICE = State.settings.fuelPrice || 1.45;
    const LITERS_PER_GALLON = 4.54609;

    for(let i = 0; i < State.logs.length; i++) {
        const l = State.logs[i];
        const cost = l.total !== undefined ? l.total : (l.kwh * l.price);
        let distanceHtml = '', effHtml = '', savingsHtml = '';

        if (l.odo) {
            let dist = 0;
            for(let j = i + 1; j < State.logs.length; j++) {
                if(State.logs[j].odo) { dist = l.odo - State.logs[j].odo; break; }
            }
            if(dist > 0) {
                const efficiency = dist / l.kwh;
                let effColor = efficiency > 4.0 ? '#4CAF50' : (efficiency < 2.5 ? '#f44336' : '#888');
                distanceHtml = `<span style="color:#2196F3; font-weight:bold; font-size:0.9rem; margin-right:8px;">+${dist} mi</span>`;
                effHtml = `<span style="color:${effColor}; font-size:0.8rem; background:#222; padding:2px 6px; border-radius:4px; margin-right:8px;">${efficiency.toFixed(1)} mi/kWh</span>`;

                const iceCost = (dist / ICE_MPG) * LITERS_PER_GALLON * ICE_FUEL_PRICE;
                const savings = iceCost - cost;
                savingsHtml = `<span style="color:${savings>=0?'#4CAF50':'#f44336'}; font-weight:bold; font-size:0.85rem;">${savings>=0?'SAVE':'LOSS'} £${Math.abs(savings).toFixed(2)}</span>`;
            } else {
                distanceHtml = `<span style="color:#666; font-size:0.9em; margin-right:10px;">${l.odo} mi</span>`;
            }
        }

        html += `
        <div class="log-entry" id="log-row-${l.id}">
            <div class="log-info">
                <div class="log-main-row"><span>${l.kwh} kWh</span><span class="cost-tag">£${cost.toFixed(2)}</span></div>
                <div class="log-sub-row" style="margin-top:6px; align-items:center; flex-wrap:wrap;">${distanceHtml} ${effHtml} ${savingsHtml}</div>
                <div class="log-sub-row" style="margin-top:4px;"><span>${l.date}</span><span> • </span><span>${l.type}</span></div>
                ${l.note ? `<div class="log-note">${l.note}</div>` : ''}
            </div>
            <div class="action-btn-group">
                <button class="edit-btn" id="edit-log-${l.id}">✎</button>
                <button class="delete-btn" id="del-log-${l.id}">×</button>
            </div>
        </div>`;
    }
    div.innerHTML = html || '<p style="text-align:center; color:#666; padding:20px;">Няма записи</p>';

    State.logs.forEach(l => {
        document.getElementById(`del-log-${l.id}`).addEventListener('click', () => { if(confirm('Изтриване?')) dbDeleteLog(l.id); });
        document.getElementById(`edit-log-${l.id}`).addEventListener('click', () => {
            document.getElementById('date').value = l.date;
            document.getElementById('kwh').value = l.kwh;
            document.getElementById('price').value = l.price;
            document.getElementById('note').value = l.note || '';
            document.getElementById('odo').value = l.odo || '';
            const sel = document.getElementById('type');
            for(let i=0; i<sel.options.length; i++) { if(sel.options[i].text === l.type) { sel.selectedIndex = i; break; } }
            
            State.editLogId = l.id;
            const btn = document.getElementById('addEntry');
            btn.innerText = "Update Entry";
            btn.classList.add("update-mode-btn");
            document.querySelector('#log').scrollIntoView({behavior: 'smooth'});
            document.getElementById('kwh').dispatchEvent(new Event('input'));
        });
    });
}

function renderCostsList() {
    const div = document.getElementById('costs');
    if (!div) return;

    const ICE_MPG = State.settings.iceMpg || 45;
    const ICE_FUEL_PRICE = State.settings.fuelPrice || 1.45;
    const LITERS_PER_GALLON = 4.54609;

    let totalEvCost = 0, totalMiles = 0;
    const sortedLogs = [...State.logs].sort((a, b) => new Date(b.date) - new Date(a.date));

    for(let i = 0; i < sortedLogs.length; i++) {
        const l = sortedLogs[i];
        totalEvCost += (l.total !== undefined ? parseFloat(l.total) : (parseFloat(l.kwh) * parseFloat(l.price)));
        if (l.odo) {
            for(let j = i + 1; j < sortedLogs.length; j++) {
                if(sortedLogs[j].odo) {
                    const diff = parseFloat(l.odo) - parseFloat(sortedLogs[j].odo);
                    if(diff > 0) totalMiles += diff;
                    break;
                }
            }
        }
    }

    const totalIceCost = (totalMiles / ICE_MPG) * LITERS_PER_GALLON * ICE_FUEL_PRICE;
    const totalSaved = totalIceCost - totalEvCost;
    const savedColor = totalSaved >= 0 ? '#4CAF50' : '#f44336'; 
    const maxVal = Math.max(totalIceCost, totalEvCost);
    const icePercent = maxVal > 0 ? (totalIceCost / maxVal) * 100 : 0;
    const evPercent = maxVal > 0 ? (totalEvCost / maxVal) * 100 : 0;

    let html = `
    <div style="background: #1e1e1e; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #333;">
        <h3 style="margin:0; color:#888; font-size: 0.9rem; text-transform: uppercase;">⚡ Икономия от Гориво (EV)</h3>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
            <div>
                <div style="font-size:2rem; font-weight:bold; color: ${savedColor};">${totalSaved >= 0 ? 'SAVE' : 'LOSS'} £${Math.abs(totalSaved).toFixed(2)}</div>
                <div style="font-size:0.8rem; color:#aaa;">Спрямо ДВГ (${ICE_MPG} mpg)</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:0.9rem; color:#fff;">${totalMiles.toFixed(0)} mi</div>
                <div style="font-size:0.8rem; color:#666;">Общ пробег</div>
            </div>
        </div>
        <div style="margin-top:20px;">
            <div style="display:flex; align-items:center; margin-bottom:8px;">
                <span style="width:30px; font-size:0.7rem; color:#aaa;">ICE</span>
                <div style="flex-grow:1; background:#333; height:8px; border-radius:4px; margin:0 10px;">
                    <div style="width:${icePercent}%; background:#f44336; height:100%; border-radius:4px;"></div>
                </div>
                <span style="width:50px; text-align:right; font-size:0.8rem; color:#f44336;">£${totalIceCost.toFixed(0)}</span>
            </div>
            <div style="display:flex; align-items:center;">
                <span style="width:30px; font-size:0.7rem; color:#aaa;">EV</span>
                <div style="flex-grow:1; background:#333; height:8px; border-radius:4px; margin:0 10px;">
                    <div style="width:${evPercent}%; background:${savedColor}; height:100%; border-radius:4px;"></div>
                </div>
                <span style="width:50px; text-align:right; font-size:0.8rem; color:${savedColor};">£${totalEvCost.toFixed(0)}</span>
            </div>
        </div>
    </div>
    <hr style="border:0; border-top:1px solid #333; margin: 20px 0;">
    <div style="display:flex; gap:10px; margin-bottom:15px;">
        <button id="btn-select-ev-cost" class="tabbtn active" style="flex:1; border-radius:8px; background:#4CAF50;">⚡ EV</button>
        <button id="btn-select-ice-cost" class="tabbtn" style="flex:1; border-radius:8px; background:#333;">⛽ ICE</button>
    </div>
    <input type="hidden" id="cost-car-type" value="ev">

    <div class="input-group"><label>Категория</label>
        <select id="cost-cat" class="input-field">
            <option>Service</option><option>Tires</option><option>Insurance</option><option>Tax</option>
            <option>Repair</option><option>Parts</option><option>Accessories</option><option>Other</option>
        </select>
    </div>
    <div class="input-group"><label>Дата</label><input type="date" id="cost-date" class="input-field"></div>
    <div class="input-group"><label>Сума (£)</label><input type="number" id="cost-amount" class="input-field" placeholder="0.00" step="0.01"></div>
    <div class="input-group"><label>Описание</label><input type="text" id="cost-note" class="input-field" placeholder="Бележка..."></div>
    <button id="addCostBtn" class="primary-btn" style="margin-top:10px;">Add Cost</button>
    <button id="updateCostBtn" class="primary-btn" style="margin-top:10px; display:none; background:#FF9800;">Update Cost</button>
    <div style="margin-top:30px;"><h3 style="border-left: 4px solid #FF9800; padding-left: 10px; margin-bottom:15px;">История на поддръжката</h3><div id="costListContainer"></div></div>`;
    div.innerHTML = html;

    const dInput = document.getElementById('cost-date');
    if(dInput) dInput.valueAsDate = new Date();

    const btnEvC = document.getElementById('btn-select-ev-cost');
    const btnIceC = document.getElementById('btn-select-ice-cost');
    const carInput = document.getElementById('cost-car-type');

    btnEvC.onclick = () => { carInput.value = 'ev'; btnEvC.style.background = '#4CAF50'; btnIceC.style.background = '#333'; };
    btnIceC.onclick = () => { carInput.value = 'ice'; btnIceC.style.background = '#FF9800'; btnEvC.style.background = '#333'; };

    document.getElementById('addCostBtn').onclick = () => {
        const amount = parseFloat(document.getElementById('cost-amount').value);
        const cat = document.getElementById('cost-cat').value;
        const note = document.getElementById('cost-note').value;
        const date = document.getElementById('cost-date').value;
        const car = document.getElementById('cost-car-type').value;
        if(!amount || !date) return alert('Въведете сума и дата');
        dbAddCost({ car, amount, category: cat, date, note });
    };

    document.getElementById('updateCostBtn').onclick = () => {
        if(!State.editCostId) return;
        const amount = parseFloat(document.getElementById('cost-amount').value);
        const cat = document.getElementById('cost-cat').value;
        const note = document.getElementById('cost-note').value;
        const date = document.getElementById('cost-date').value;
        const car = document.getElementById('cost-car-type').value;
        dbUpdateCost(State.editCostId, { car, amount, category: cat, date, note });
        State.editCostId = null;
        document.getElementById('addCostBtn').style.display = 'block';
        document.getElementById('updateCostBtn').style.display = 'none';
        document.getElementById('cost-amount').value = ''; document.getElementById('cost-note').value = '';
    };

    const listDiv = document.getElementById('costListContainer');
    let listHtml = '';
    const sortedCosts = [...State.costs].sort((a,b) => new Date(b.date) - new Date(a.date));

    sortedCosts.forEach(c => {
        const catName = c.category || c.cat || 'Other';
        const carType = c.car || 'ev';
        const carColor = carType === 'ice' ? '#FF9800' : '#4CAF50';
        const carIcon = carType === 'ice' ? '⛽' : '⚡';
        listHtml += `
        <div class="log-entry" style="border-left: 3px solid ${carColor};">
            <div class="log-info">
                <div class="log-main-row"><span style="font-weight:bold;">£${parseFloat(c.amount).toFixed(2)}</span><span style="font-size:0.9rem; margin-left:10px;"><span style="color:${carColor}; font-weight:bold;">${carIcon}</span> ${catName}</span></div>
                <div class="log-sub-row"><span>${c.date}</span></div>
                ${c.note ? `<div class="log-note">${c.note}</div>` : ''}
            </div>
            <div class="action-btn-group"><button class="edit-btn" id="edit-cost-${c.id}">✎</button><button class="delete-btn" id="del-cost-${c.id}">×</button></div>
        </div>`;
    });
    listDiv.innerHTML = listHtml || '<p style="text-align:center; color:#666;">Няма разходи.</p>';

    sortedCosts.forEach(c => {
        document.getElementById(`del-cost-${c.id}`).onclick = () => { if(confirm('Delete?')) dbDeleteCost(c.id); };
        document.getElementById(`edit-cost-${c.id}`).onclick = () => {
            document.getElementById('cost-amount').value = c.amount;
            document.getElementById('cost-date').value = c.date;
            document.getElementById('cost-note').value = c.note || '';
            const sel = document.getElementById('cost-cat');
            for(let i=0; i<sel.options.length; i++) { if(sel.options[i].value === (c.category || c.cat)) sel.selectedIndex = i; }
            if((c.car || 'ev') === 'ice') btnIceC.click(); else btnEvC.click();
            State.editCostId = c.id;
            document.getElementById('addCostBtn').style.display = 'none';
            document.getElementById('updateCostBtn').style.display = 'block';
            document.getElementById('costs').scrollIntoView({behavior:'smooth'});
        };
    });
}

function bindGarage() {
    const btnEv = document.getElementById('btn-sw-ev');
    const btnIce = document.getElementById('btn-sw-ice');
    
    if(btnEv && btnIce) {
        btnEv.onclick = () => {
            State.currentGarageTab = 'ev';
            btnEv.classList.add('active'); btnIce.classList.remove('active');
            document.getElementById('garage-title').innerText = '🔔 Напомняния (EV)';
            loadGarageDataToUI();
        };
        btnIce.onclick = () => {
            State.currentGarageTab = 'ice';
            btnIce.classList.add('active'); btnEv.classList.remove('active');
            document.getElementById('garage-title').innerText = '🔔 Напомняния (ICE)';
            loadGarageDataToUI();
        };
    }

    document.getElementById('saveGarageManual').addEventListener('click', () => {
        const ids = ['g_insurance', 'g_mot', 'g_tax', 'g_service', 'g_tire_date', 'g_tire_odo', 'g_tire_note', 'g_12v_date', 'g_filter_date', 'g_wipers_date', 'g_plate', 'g_vin', 'g_notes'];
        let dataToSave = {};
        ids.forEach(id => { const el = document.getElementById(id); if(el) dataToSave[id] = el.value; });
        dbSaveGarage(State.currentGarageTab, dataToSave);
    });
}

function loadGarageDataToUI() {
    const currentData = State.garage[State.currentGarageTab] || {};
    const ids = ['g_insurance', 'g_mot', 'g_tax', 'g_service', 'g_tire_date', 'g_tire_odo', 'g_tire_note', 'g_12v_date', 'g_filter_date', 'g_wipers_date', 'g_plate', 'g_vin', 'g_notes'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = currentData[id] || ""; });
    calculateGarageStats();
}

function calculateGarageStats() {
    const checkExpiry = (inputId, labelId) => {
        const val = document.getElementById(inputId).value;
        const el = document.getElementById(labelId);
        if(!el) return;
        if(!val) { el.innerText = "--"; el.className = "status-badge"; return; }
        const diff = Math.ceil((new Date(val) - new Date()) / (1000 * 60 * 60 * 24)); 
        if(diff < 0) { el.innerText = "ИЗТЕКЛО!"; el.className = "status-badge status-danger"; } 
        else if (diff <= 30) { el.innerText = `${diff} дни`; el.className = "status-badge status-warning"; } 
        else { el.innerText = `${diff} дни`; el.className = "status-badge status-ok"; }
    };

    checkExpiry('g_insurance', 'status_insurance'); checkExpiry('g_mot', 'status_mot');
    checkExpiry('g_tax', 'status_tax'); checkExpiry('g_service', 'status_service');

    const tireDiv = document.getElementById('stat_tires');
    const tireOdo = parseFloat(document.getElementById('g_tire_odo').value) || 0;
    const currentOdo = (State.logs.length > 0 && State.logs[0].odo) ? State.logs[0].odo : 0;
    if(tireDiv) tireDiv.innerText = (tireOdo > 0 && currentOdo > 0) ? `Изминати: ${currentOdo - tireOdo} mi` : "";

    const checkAge = (inputId, outputId, warnYears) => {
        const val = document.getElementById(inputId).value;
        const el = document.getElementById(outputId);
        if(!val || !el) return;
        const monthsDiff = (new Date().getFullYear() - new Date(val).getFullYear()) * 12 + (new Date().getMonth() - new Date(val).getMonth());
        el.innerText = `Възраст: ${monthsDiff < 12 ? monthsDiff + ' мес.' : (monthsDiff/12).toFixed(1) + ' г.'}`;
        el.style.color = monthsDiff > (warnYears * 12) ? "#f44336" : "#aaa";
    };
    checkAge('g_12v_date', 'stat_12v', 3); checkAge('g_filter_date', 'stat_filter', 2); checkAge('g_wipers_date', 'stat_wipers', 1);
}

// SETTINGS & COMPARE
function bindSettings() {
    document.getElementById('saveCompareSettings').addEventListener('click', () => {
        const s = {
            homePrice: parseFloat(document.getElementById('set_home_price').value) || 0.24,
            evEff: parseFloat(document.getElementById('set_ev_eff').value),
            iceMpg: parseFloat(document.getElementById('set_ice_mpg').value),
            fuelPrice: parseFloat(document.getElementById('set_fuel_price').value)
        };
        dbSaveSettings(s);
    });
    document.getElementById('btnExportLogs').addEventListener('click', () => exportToCSV(State.logs, 'EV_Logs.csv'));
    document.getElementById('btnExportCosts').addEventListener('click', () => exportToCSV(State.costs, 'EV_Costs.csv'));
    document.getElementById('btnImport').addEventListener('click', () => importFromCSV(document.getElementById('importFile').files[0]));
}

function loadSettingsToUI() {
    if(document.getElementById('set_home_price')) document.getElementById('set_home_price').value = State.settings.homePrice || 0.24;
    if(document.getElementById('set_ev_eff')) document.getElementById('set_ev_eff').value = State.settings.evEff || 3.0;
    if(document.getElementById('set_ice_mpg')) document.getElementById('set_ice_mpg').value = State.settings.iceMpg || 45;
    if(document.getElementById('set_fuel_price')) document.getElementById('set_fuel_price').value = State.settings.fuelPrice || 1.45;
}

function bindCompare() {
    document.getElementById('btn-calc-trip').addEventListener('click', () => {
        const dist = parseFloat(document.getElementById('cmp-dist').value);
        if(!dist) return;
        const evP = parseFloat(document.getElementById('price').value) || (State.settings.homePrice || 0.24);
        const evC = (dist/(State.settings.evEff || 3.0))*evP;
        const iceC = (dist/(State.settings.iceMpg || 45))*4.54609*(State.settings.fuelPrice || 1.45);
        const diff = iceC - evC;
        document.getElementById('compare-result').innerHTML = `
            <div style="background:#222; padding:10px; margin-top:10px; border-radius:5px; border-left:4px solid ${diff>0?'#4CAF50':'#f44336'}">
                <div>EV: £${evC.toFixed(2)} vs ICE: £${iceC.toFixed(2)}</div>
                <div style="font-weight:bold; color:${diff>0?'#4CAF50':'#f44336'}">${diff>0?'Save':'Loss'} £${Math.abs(diff).toFixed(2)}</div>
            </div>`;
    });
}

function bindChartControls() {
    const bCum = document.getElementById('btn-chart-cum');
    const bMonth = document.getElementById('btn-chart-month');
    if(!bCum || !bMonth) return;
    
    bCum.addEventListener('click', () => { 
        State.chartMode = 'cumulative'; 
        bCum.classList.add('active'); 
        bMonth.classList.remove('active'); 
        updateStats(); 
    });
    
    bMonth.addEventListener('click', () => { 
        State.chartMode = 'monthly'; 
        bMonth.classList.add('active'); 
        bCum.classList.remove('active'); 
        updateStats(); 
    });
}

// Функции за обработка на данни за TCO графиката
function prepareTcoData(mode) {
    let monthsData = {};
    const ICE_MPG = State.settings.iceMpg || 45;
    const ICE_FUEL_PRICE = State.settings.fuelPrice || 1.45;
    const EV_EFF = State.settings.evEff || 3.5;
    const LITERS_PER_GALLON = 4.54609;

    // Обединяване и сортиране на всички записи по дата
    const allRecords = [
        ...State.logs.map(l => ({ ...l, type: 'charge' })),
        ...State.costs.map(c => ({ ...c, type: 'cost' }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    allRecords.forEach(record => {
        const monthKey = record.date.substring(0, 7); // Взимаме "ГГГГ-ММ"
        if (!monthsData[monthKey]) {
            monthsData[monthKey] = { evCost: 0, iceCost: 0, kwh: 0, evMaint: 0, iceMaint: 0 };
        }

        if (record.type === 'charge') {
            const cost = record.total !== undefined ? parseFloat(record.total) : (parseFloat(record.kwh) * parseFloat(record.price));
            monthsData[monthKey].evCost += cost;
            monthsData[monthKey].kwh += parseFloat(record.kwh);
            
            // Теоретичен разход за гориво за тази енергия
            const miles = parseFloat(record.kwh) * EV_EFF;
            const theoreticalIceFuel = (miles / ICE_MPG) * LITERS_PER_GALLON * ICE_FUEL_PRICE;
            monthsData[monthKey].iceCost += theoreticalIceFuel;
            
        } else if (record.type === 'cost') {
            const amount = parseFloat(record.amount) || 0;
            if (record.car === 'ice') {
                monthsData[monthKey].iceMaint += amount;
            } else {
                monthsData[monthKey].evMaint += amount;
            }
        }
    });

    const labels = Object.keys(monthsData).sort(); // Сортираме хронологично
    let evData = [];
    let iceData = [];
    
    let runningEv = 0;
    let runningIce = 0;

    labels.forEach(label => {
        const data = monthsData[label];
        const monthEvTotal = data.evCost + data.evMaint;
        const monthIceTotal = data.iceCost + data.iceMaint;

        if (mode === 'cumulative') {
            runningEv += monthEvTotal;
            runningIce += monthIceTotal;
            evData.push(runningEv);
            iceData.push(runningIce);
        } else { // monthly
            evData.push(monthEvTotal);
            iceData.push(monthIceTotal);
        }
    });

    return { labels, evData, iceData };
}

function updateStats() {
    const div = document.getElementById('tco-dashboard');
    if(!State.logs.length && !State.costs.length) { if(div) div.style.display = 'none'; return; }
    if(div) div.style.display = 'block';

    let evEnergyCost = 0, kwhTot = 0, evMaint = 0, iceMaint = 0;
    State.logs.forEach(l => { evEnergyCost += (l.total !== undefined ? parseFloat(l.total) : (parseFloat(l.kwh) * parseFloat(l.price))); kwhTot += parseFloat(l.kwh); });
    State.costs.forEach(c => { const amount = parseFloat(c.amount) || 0; if(c.car === 'ice') iceMaint += amount; else evMaint += amount; });

    const miles = kwhTot * (State.settings.evEff || 3.5);
    const iceFuelTheoretical = (miles / (State.settings.iceMpg || 45)) * 4.54609 * (State.settings.fuelPrice || 1.45);
    
    const totalEV = evEnergyCost + evMaint;
    const totalICE = iceFuelTheoretical + iceMaint;
    const savings = totalICE - totalEV;

    const setText = (id, txt) => { const e=document.getElementById(id); if(e) e.innerText=txt; };
    setText('stat-miles', miles.toFixed(0));
    setText('stat-ev-charge', '£'+evEnergyCost.toFixed(2)); setText('stat-ev-maint', '£'+evMaint.toFixed(2));
    setText('stat-ice-fuel', '£'+iceFuelTheoretical.toFixed(2)); setText('stat-ice-maint', '£'+iceMaint.toFixed(2));

    const card = document.getElementById('tco-card');
    if(card) {
        const color = savings >= 0 ? '#4CAF50' : '#f44336';
        card.style.border = `2px solid ${color}`;
        card.innerHTML = `<div style="color:#ccc; font-size:0.9em; text-transform:uppercase;">Общ Баланс (ТCO)</div>
            <div style="font-size:2em; font-weight:bold; color:${color}; margin:10px 0">${savings>0?'+':''}£${savings.toFixed(2)}</div>
            <div style="display:flex; justify-content:space-between; color:#888; font-size:0.85rem; margin-top:5px;"><span>⚡ EV: £${totalEV.toFixed(0)}</span><span>⛽ ICE: £${totalICE.toFixed(0)}</span></div>`;
    }
    
    // Рисуваме графиките
    if (typeof Chart !== 'undefined') {
        renderCompareChart(evEnergyCost, evMaint, iceFuelTheoretical, iceMaint);
        
        // Подготовка на данни за TCO графиката и рисуване
        const chartType = State.chartMode === 'cumulative' ? 'line' : 'bar';
        const tcoData = prepareTcoData(State.chartMode);
        renderTcoChart(tcoData.labels, tcoData.evData, tcoData.iceData, chartType);
    }
}

// CHARTS LOGIC
let myCompareChart = null;
let myTcoChart = null;

function renderCompareChart(evEnergyCost, evMaint, iceFuelTheoretical, iceMaint) {
    const canvas = document.getElementById('compareChart');
    if (!canvas) return;
    
    if (myCompareChart) {
        myCompareChart.destroy();
    }
    
    myCompareChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['Моята Кола (EV)', 'Алтернатива (ICE)'],
            datasets: [
                { label: 'Движение', data: [evEnergyCost, iceFuelTheoretical], backgroundColor: ['#4CAF50', '#f44336'], borderWidth: 0 },
                { label: 'Поддръжка', data: [evMaint, iceMaint], backgroundColor: ['#81C784', '#e57373'], borderWidth: 0 }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { 
                x: { stacked: true }, 
                y: { stacked: true, beginAtZero: true } 
            } 
        }
    });
}

function renderTcoChart(labels, evData, iceData, chartType = 'line') {
    const canvas = document.getElementById('tcoChart');
    if (!canvas) return;

    if (myTcoChart) {
        myTcoChart.destroy();
    }

    const isLine = chartType === 'line';

    myTcoChart = new Chart(canvas, {
        type: chartType,
        data: {
            labels: labels, 
            datasets: [
                {
                    label: 'EV Общо (£)',
                    data: evData,
                    backgroundColor: isLine ? 'rgba(76, 175, 80, 0.2)' : '#4CAF50',
                    borderColor: '#4CAF50',
                    borderWidth: 2,
                    fill: isLine,
                    tension: 0.3 
                },
                {
                    label: 'ICE Общо (£)',
                    data: iceData,
                    backgroundColor: isLine ? 'rgba(244, 67, 54, 0.2)' : '#f44336',
                    borderColor: '#f44336',
                    borderWidth: 2,
                    fill: isLine,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: { color: '#aaa' },
                    grid: { color: '#333' }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#aaa' },
                    grid: { color: '#333' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                }
            }
        }
    });
}
