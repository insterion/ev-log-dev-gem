/* main.js - Version: Full Comments & Sections */

//От тук започват IMPORT библиотеките
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, setDoc, updateDoc, enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
//Тук завършват IMPORT библиотеките

//От тук започва FIREBASE CONFIG
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
//Тук завършва FIREBASE CONFIG

//От тук започва APP STATE (Състояние на приложението)
const State = {
    user: null,
    logs: [],
    costs: [],
    garage: { ev: {}, ice: {} },
    settings: { evEff: 3.0, iceMpg: 44, fuelPrice: 1.45 },
    currentGarageTab: 'ev',
    editLogId: null,
    editCostId: null,
    chartMode: 'cumulative' 
};
//Тук завършва APP STATE

//От тук започва AUTH LOGIC (Логин и Логаут)
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
//Тук завършва AUTH LOGIC

//От тук започва function initDataListeners (Слушатели за данни)
let unsubscribeLogs, unsubscribeCosts, unsubscribeGarage, unsubscribeSettings;

function initDataListeners() {
    const uid = State.user.uid;

    // Logs Listener
    const qLogs = query(collection(db, "logs"), where("uid", "==", uid));
    unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
        State.logs = [];
        snapshot.forEach((doc) => State.logs.push({ id: doc.id, ...doc.data() }));
        State.logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderLogList();
        renderHomeDashboard();
        updateStats();
    });

    // Costs Listener
    const qCosts = query(collection(db, "costs"), where("uid", "==", uid));
    unsubscribeCosts = onSnapshot(qCosts, (snapshot) => {
        State.costs = [];
        snapshot.forEach((doc) => State.costs.push({ id: doc.id, ...doc.data() }));
        State.costs.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderCostsList();
        updateStats();
    });

    // Garage Listener
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

    // Settings Listener
    unsubscribeSettings = onSnapshot(doc(db, "settings", uid), (docSnap) => {
        if (docSnap.exists()) {
            State.settings = docSnap.data();
            loadSettingsToUI();
            updateStats();
        }
    });
}
//Тук завършва function initDataListeners

//От тук започват DATABASE ACTIONS (Функции за запис и триене)
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
//Тук завършват DATABASE ACTIONS

//От тук започват IMPORT / EXPORT CSV функции
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
                row.date, row.amount, `"${row.cat}"`, `"${row.target}"`,
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
    link.style.visibility = 'hidden';
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
        let row = [];
        let currentToken = '';
        let insideQuote = false;
        
        for(let char of lines[i]) {
            if(char === '"') { insideQuote = !insideQuote; } 
            else if(char === ',' && !insideQuote) { row.push(currentToken); currentToken = ''; } 
            else { currentToken += char; }
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
            const text = e.target.result;
            const parsed = parseCSV(text);
            if(!parsed.data.length) return alert("Празен или невалиден файл.");
            if(!confirm(`Открити са ${parsed.data.length} записа (${parsed.type}). Да ги добавя ли?`)) return;

            let count = 0;
            if(parsed.type === 'logs') {
                for(let row of parsed.data) {
                    await dbAddLog({
                        date: row.Date,
                        type: row.Type,
                        kwh: parseFloat(row.KWh),
                        price: parseFloat(row.Price),
                        total: parseFloat(row.Total),
                        note: row.Note,
                        odo: row.Odometer ? parseFloat(row.Odometer) : null
                    });
                    count++;
                }
            } else {
                for(let row of parsed.data) {
                    await dbAddCost({
                        date: row.Date,
                        amount: parseFloat(row.Amount),
                        cat: row.Category,
                        target: row.Target,
                        note: row.Note
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
//Тук завършват IMPORT / EXPORT CSV функции

//От тук започва function initUI (Старт на интерфейса)
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
//Тук завършва function initUI

//От тук започва function bindNav (Навигация)
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
//Тук завършва function bindNav

//От тук започва function renderHomeDashboard (Начален екран)
function renderHomeDashboard() {
    const div = document.getElementById('home-stats');
    if(!div) return;

    if(State.logs.length === 0) {
        div.innerHTML = `<div style="grid-column: span 2; text-align:center; color:#666; font-style:italic;">Няма данни</div>`;
        return;
    }

    // 1. Current Month Filter
    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7);
    const monthLogs = State.logs.filter(l => l.date.startsWith(currentMonthKey));
    
    // 2. Calculate Totals
    let totalCost = 0;
    let totalKwh = 0;
    let totalDist = 0;

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

    // 3. Last Charge Logic
    const lastLogDate = new Date(State.logs[0].date);
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const logMidnight = new Date(lastLogDate.getFullYear(), lastLogDate.getMonth(), lastLogDate.getDate());
    const diffTime = Math.abs(todayMidnight - logMidnight);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    let daysText = "Днес";
    if(diffDays === 1) daysText = "Вчера";
    if(diffDays > 1) daysText = `${diffDays} дни`;

    // 4. Render HTML
    div.innerHTML = `
        <div style="background:#222; padding:15px; border-radius:12px; border-left:5px solid #4CAF50; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            <div style="font-size:0.85rem; color:#aaa; margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">Този Месец</div>
            
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px;">
                <span style="font-size:1.6rem; font-weight:800; color:#fff;">£${totalCost.toFixed(2)}</span>
                <span style="font-size:0.9rem; color:#4CAF50; font-weight:bold;">${avgEff} <span style="font-size:0.7em; font-weight:normal; color:#888;">mi/kWh</span></span>
            </div>
            
            <div style="display:flex; justify-content:space-between; border-top:1px solid #333; padding-top:5px; font-size:0.85rem; color:#ccc;">
                <span>${totalDist > 0 ? totalDist : 0} mi</span>
                <span>${totalKwh.toFixed(0)} kWh</span>
            </div>
        </div>

        <div style="background:#222; padding:15px; border-radius:12px; border-left:5px solid #2196F3; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            <div style="font-size:0.85rem; color:#aaa; margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">Последно</div>
            <div style="font-size:1.6rem; font-weight:800; color:#fff; margin-bottom:5px;">${daysText}</div>
            <div style="font-size:0.85rem; color:#888;">${State.logs[0].date}</div>
            <div style="margin-top:5px; font-size:0.85rem; color:#2196F3;">${State.logs[0].odo ? State.logs[0].odo + ' mi' : ''}</div>
        </div>
    `;
}
//Тук завършва function renderHomeDashboard

//От тук започва function bindLogForm (Форма за зареждане)
function bindLogForm() {
    const btnAdd = document.getElementById('addEntry');
    const typeSelect = document.getElementById('type');
    const priceInput = document.getElementById('price');
    const kwhInput = document.getElementById('kwh');
    const odoInput = document.getElementById('odo');
    
    const syncPrice = () => {
        const opt = typeSelect.options[typeSelect.selectedIndex];
        if (btnAdd.classList.contains("update-mode-btn")) return;

        if(opt && opt.dataset.price) {
            priceInput.value = opt.dataset.price;
            priceInput.style.opacity = "1";
            priceInput.style.background = "#2c2c2c";
        } else {
            priceInput.removeAttribute('readonly');
            priceInput.style.opacity = "1";
            priceInput.style.background = "#2c2c2c";
        }
        updateLogPreview();
    };

    typeSelect.addEventListener('change', syncPrice);
    kwhInput.addEventListener('input', updateLogPreview);
    priceInput.addEventListener('input', updateLogPreview);
    
    if(!priceInput.value) syncPrice();

    btnAdd.addEventListener('click', () => {
        const date = document.getElementById('date').value;
        const kwh = parseFloat(kwhInput.value);
        if (!priceInput.value) syncPrice();
        
        const price = parseFloat(priceInput.value);
        const type = typeSelect.options[typeSelect.selectedIndex].text;
        const note = document.getElementById('note').value;
        const odo = odoInput.value ? parseFloat(odoInput.value) : null;

        if(!date || isNaN(kwh) || isNaN(price)) return alert('Missing fields');
        const entryData = { date, kwh, price, type, note, odo, total: kwh * price };

        if (State.editLogId) {
            dbUpdateLog(State.editLogId, entryData);
            State.editLogId = null;
            btnAdd.innerText = "Add Entry";
            btnAdd.classList.remove("update-mode-btn");
        } else {
            dbAddLog(entryData);
        }
        
        kwhInput.value = '';
        odoInput.value = ''; 
        document.getElementById('note').value = '';
        document.getElementById('log-preview').style.display = 'none';
        syncPrice(); 
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
//Тук завършва function bindLogForm

//От тук започва function renderLogList (Списък зареждания)
function renderLogList() {
    const div = document.getElementById('logTable');
    let html = '';

    const ICE_MPG = 45;
    const ICE_FUEL_PRICE = 1.45;
    const LITERS_PER_GALLON = 4.54609;

    for(let i = 0; i < State.logs.length; i++) {
        const l = State.logs[i];
        const cost = l.total !== undefined ? l.total : (l.kwh * l.price);
        
        let distanceHtml = '';
        let effHtml = '';
        let savingsHtml = '';

        if (l.odo) {
            let dist = 0;
            for(let j = i + 1; j < State.logs.length; j++) {
                if(State.logs[j].odo) {
                    dist = l.odo - State.logs[j].odo;
                    break;
                }
            }
            
            if(dist > 0) {
                const efficiency = dist / l.kwh;
                let effColor = '#888'; 
                if(efficiency > 4.0) effColor = '#4CAF50'; 
                else if(efficiency < 2.5) effColor = '#f44336'; 
                
                distanceHtml = `<span style="color:#2196F3; font-weight:bold; font-size:0.9rem; margin-right:8px;">+${dist} mi</span>`;
                effHtml = `<span style="color:${effColor}; font-size:0.8rem; background:#222; padding:2px 6px; border-radius:4px; margin-right:8px;">${efficiency.toFixed(1)} mi/kWh</span>`;

                const gallonsNeeded = dist / ICE_MPG;
                const litersNeeded = gallonsNeeded * LITERS_PER_GALLON;
                const iceCost = litersNeeded * ICE_FUEL_PRICE;
                const savings = iceCost - cost;

                if (savings >= 0) {
                    savingsHtml = `<span style="color:#4CAF50; font-weight:bold; font-size:0.85rem;">SAVE £${savings.toFixed(2)}</span>`;
                } else {
                    savingsHtml = `<span style="color:#f44336; font-weight:bold; font-size:0.85rem;">LOSS £${Math.abs(savings).toFixed(2)}</span>`;
                }
            } else {
                distanceHtml = `<span style="color:#666; font-size:0.9em; margin-right:10px;">${l.odo} mi</span>`;
            }
        }

        html += `
        <div class="log-entry" id="log-row-${l.id}">
            <div class="log-info">
                <div class="log-main-row">
                    <span>${l.kwh} kWh</span>
                    <span class="cost-tag">£${cost.toFixed(2)}</span>
                </div>
                <div class="log-sub-row" style="margin-top:6px; align-items:center; flex-wrap:wrap;">
                    ${distanceHtml} ${effHtml} ${savingsHtml}
                </div>
                <div class="log-sub-row" style="margin-top:4px;">
                    <span>${l.date}</span><span> • </span><span>${l.type}</span>
                </div>
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
            
            const event = new Event('input');
            document.getElementById('kwh').dispatchEvent(event);
        });
    });
}
//Тук завършва function renderLogList

//От тук започва function renderCostsList (Списък разходи и форма)
//От тук започва function renderCostsList (Списък разходи и форма)
function renderCostsList() {
    const div = document.getElementById('costs') || document.getElementById('costsList');
    if (!div) return;

    // --- 0. MIGRATION (Автоматично поправяне на стари записи) ---
    // Ако има записи без поле 'car', приемаме че са за EV
    let migrationNeeded = false;
    State.costs.forEach(c => {
        if (!c.car) { c.car = 'ev'; migrationNeeded = true; }
    });
    if (migrationNeeded) {
        console.log("Migrating old costs to EV...");
        // Записваме промените тихо в базата, за да не пита всеки път
        State.costs.forEach(c => { if(!c.car) dbUpdateCost(c.id, {car: 'ev'}); });
    }

    // --- 1. КАЛКУЛАЦИЯ (Само за EV - Ток vs Бензин) ---
    const ICE_MPG = 45; 
    const ICE_FUEL_PRICE = 1.45;
    const LITERS_PER_GALLON = 4.54609;

    let totalEvCost = 0;
    let totalMiles = 0;
    
    // Смятаме само от ЛОГОВЕТЕ (Зарежданията)
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

    const gallons = totalMiles / ICE_MPG;
    const liters = gallons * LITERS_PER_GALLON;
    const totalIceCost = liters * ICE_FUEL_PRICE;
    const totalSaved = totalIceCost - totalEvCost;
    const savedColor = totalSaved >= 0 ? '#4CAF50' : '#f44336'; 
    const maxVal = Math.max(totalIceCost, totalEvCost);
    const icePercent = maxVal > 0 ? (totalIceCost / maxVal) * 100 : 0;
    const evPercent = maxVal > 0 ? (totalEvCost / maxVal) * 100 : 0;

    // --- 2. HTML (Горна част - Спестявания от Гориво) ---
    let html = `
    <div style="background: #1e1e1e; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #333;">
        <h3 style="margin:0; color:#888; font-size: 0.9rem; text-transform: uppercase;">⚡ Икономия от Гориво (EV)</h3>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
            <div>
                <div style="font-size:2rem; font-weight:bold; color: ${savedColor};">
                    ${totalSaved >= 0 ? 'SAVE' : 'LOSS'} £${Math.abs(totalSaved).toFixed(2)}
                </div>
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
        <button id="btn-select-ev" class="tabbtn active" style="flex:1; border-radius:8px;">⚡ EV</button>
        <button id="btn-select-ice" class="tabbtn" style="flex:1; border-radius:8px;">⛽ ICE</button>
    </div>
    <input type="hidden" id="cost-car-type" value="ev">

    <div class="input-group"><label>Категория</label>
        <select id="cost-cat" class="input-field">
            <option>Service</option>
            <option>Tires</option>
            <option>Insurance</option>
            <option>Tax</option>
            <option>Repair</option>
            <option>Parts</option>
            <option>Accessories</option>
            <option>Other</option>
        </select>
    </div>
    <div class="input-group"><label>Дата</label><input type="date" id="cost-date" class="input-field"></div>
    <div class="input-group"><label>Сума (£)</label><input type="number" id="cost-amount" class="input-field" placeholder="0.00" step="0.01"></div>
    <div class="input-group"><label>Описание</label><input type="text" id="cost-note" class="input-field" placeholder="Бележка..."></div>
    
    <button id="addCostBtn" class="primary-btn" style="margin-top:10px;">Add Cost</button>
    <button id="updateCostBtn" class="primary-btn" style="margin-top:10px; display:none; background:#FF9800;">Update Cost</button>
    
    <div style="margin-top:30px;">
        <h3 style="border-left: 4px solid #FF9800; padding-left: 10px; margin-bottom:15px;">История на поддръжката</h3>
        <div id="costListContainer"></div>
    </div>`;

    div.innerHTML = html;

    const dInput = document.getElementById('cost-date');
    if(dInput) dInput.valueAsDate = new Date();

    // ЛОГИКА ЗА БУТОНИТЕ EV / ICE
    const btnEv = document.getElementById('btn-select-ev');
    const btnIce = document.getElementById('btn-select-ice');
    const carInput = document.getElementById('cost-car-type');

    btnEv.onclick = () => {
        carInput.value = 'ev';
        btnEv.classList.add('active'); btnIce.classList.remove('active');
        btnEv.style.background = '#4CAF50'; btnIce.style.background = '#333';
    };
    btnIce.onclick = () => {
        carInput.value = 'ice';
        btnIce.classList.add('active'); btnEv.classList.remove('active');
        btnIce.style.background = '#FF9800'; btnEv.style.background = '#333';
    };
    // Initial style
    btnEv.style.background = '#4CAF50';

    // ADD Logic
    document.getElementById('addCostBtn').onclick = () => {
        const amount = parseFloat(document.getElementById('cost-amount').value);
        const cat = document.getElementById('cost-cat').value;
        const note = document.getElementById('cost-note').value;
        const date = document.getElementById('cost-date').value;
        const car = document.getElementById('cost-car-type').value; // 'ev' or 'ice'

        if(!amount || !date) return alert('Въведете сума и дата');
        dbAddCost({ id: Date.now(), car, amount, category: cat, date, note });
    };

    // UPDATE Logic
    document.getElementById('updateCostBtn').onclick = () => {
        if(!State.editCostId) return;
        const amount = parseFloat(document.getElementById('cost-amount').value);
        const cat = document.getElementById('cost-cat').value;
        const note = document.getElementById('cost-note').value;
        const date = document.getElementById('cost-date').value;
        const car = document.getElementById('cost-car-type').value;
        
        const updatedCost = { id: State.editCostId, car, amount, category: cat, date, note };
        dbDeleteCost(State.editCostId, false);
        setTimeout(() => dbAddCost(updatedCost), 500); 
    };

    // RENDER LIST
    const listDiv = document.getElementById('costListContainer');
    let listHtml = '';
    const sortedCosts = [...State.costs].sort((a,b) => new Date(b.date) - new Date(a.date));

    sortedCosts.forEach(c => {
        const catName = c.category || c.cat || c.type || 'Other';
        const carType = c.car || 'ev'; // Fallback if missing
        
        // Определяне на икона и цвят според колата
        let carIcon = '⚡';
        let carColor = '#4CAF50'; // Green for EV
        if(carType === 'ice') {
            carIcon = '⛽';
            carColor = '#FF9800'; // Orange for ICE
        }

        let catIcon = '🔧';
        if(catName === 'Tires') catIcon = '🛞';
        if(catName === 'Insurance') catIcon = '📄';
        if(catName === 'Other') catIcon = '📦';

        listHtml += `
        <div class="log-entry" style="border-left: 3px solid ${carColor};">
            <div class="log-info">
                <div class="log-main-row">
                    <span style="font-weight:bold;">£${parseFloat(c.amount).toFixed(2)}</span>
                    <span style="font-size:0.9rem; margin-left:10px;">
                        <span style="color:${carColor}; font-weight:bold;">${carIcon}</span> ${catIcon} ${catName}
                    </span>
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
    listDiv.innerHTML = listHtml || '<p style="text-align:center; color:#666;">Няма разходи.</p>';

    // LISTENERS FOR EDIT/DELETE
    sortedCosts.forEach(c => {
        document.getElementById(`del-cost-${c.id}`).onclick = () => { if(confirm('Delete?')) dbDeleteCost(c.id); };
        document.getElementById(`edit-cost-${c.id}`).onclick = () => {
            document.getElementById('cost-amount').value = c.amount;
            document.getElementById('cost-date').value = c.date;
            document.getElementById('cost-note').value = c.note || '';
            const catName = c.category || c.cat || c.type || 'Other';
            const sel = document.getElementById('cost-cat');
            for(let i=0; i<sel.options.length; i++) { if(sel.options[i].value === catName) sel.selectedIndex = i; }
            
            // Set Car Type Button
            const carType = c.car || 'ev';
            if(carType === 'ice') btnIce.click();
            else btnEv.click();

            State.editCostId = c.id;
            document.getElementById('addCostBtn').style.display = 'none';
            document.getElementById('updateCostBtn').style.display = 'block';
            document.getElementById('costs').scrollIntoView({behavior:'smooth'});
        };
    });
}
//Тук завършва function renderCostsList
//Тук завършва function renderCostsList

//От тук започва GARAGE LOGIC (Гараж и Напомняния)
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
        const ids = [
            'g_insurance', 'g_mot', 'g_tax', 'g_service', 
            'g_tire_date', 'g_tire_odo', 'g_tire_note',
            'g_12v_date', 'g_filter_date', 'g_wipers_date',
            'g_plate', 'g_vin', 'g_notes'
        ];
        
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
    const ids = [
        'g_insurance', 'g_mot', 'g_tax', 'g_service', 
        'g_tire_date', 'g_tire_odo', 'g_tire_note',
        'g_12v_date', 'g_filter_date', 'g_wipers_date',
        'g_plate', 'g_vin', 'g_notes'
    ];
    
    ids.forEach(id => { 
        const el = document.getElementById(id); 
        if(el) el.value = currentData[id] || ""; 
    });
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

    checkExpiry('g_insurance', 'status_insurance');
    checkExpiry('g_mot', 'status_mot');
    checkExpiry('g_tax', 'status_tax');
    checkExpiry('g_service', 'status_service');

    const tireDiv = document.getElementById('stat_tires');
    const tireOdo = parseFloat(document.getElementById('g_tire_odo').value) || 0;
    const currentOdo = (State.logs.length > 0 && State.logs[0].odo) ? State.logs[0].odo : 0;
    
    let tireText = "";
    if(tireOdo > 0 && currentOdo > 0) {
        const driven = currentOdo - tireOdo;
        tireText = `Изминати: ${driven} mi`;
    }
    tireDiv.innerText = tireText;

    const checkAge = (inputId, outputId, warnYears) => {
        const val = document.getElementById(inputId).value;
        const el = document.getElementById(outputId);
        if(!val || !el) return;
        const date = new Date(val);
        const now = new Date();
        const monthsDiff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
        let txt = "";
        let color = "#aaa";
        if(monthsDiff < 12) txt = `${monthsDiff} мес.`;
        else txt = `${(monthsDiff/12).toFixed(1)} г.`;
        if (monthsDiff > (warnYears * 12)) color = "#f44336"; 
        el.innerText = `Възраст: ${txt}`;
        el.style.color = color;
    };
    checkAge('g_12v_date', 'stat_12v', 3);
    checkAge('g_filter_date', 'stat_filter', 2);
    checkAge('g_wipers_date', 'stat_wipers', 1);
}
//Тук завършва GARAGE LOGIC

//От тук започва SETTINGS & COMPARE (Настройки и Калкулатор)
function bindSettings() {
    document.getElementById('saveCompareSettings').addEventListener('click', () => {
        const s = {
            evEff: parseFloat(document.getElementById('set_ev_eff').value),
            iceMpg: parseFloat(document.getElementById('set_ice_mpg').value),
            fuelPrice: parseFloat(document.getElementById('set_fuel_price').value)
        };
        dbSaveSettings(s);
    });
    document.getElementById('btnExportLogs').addEventListener('click', () => exportToCSV(State.logs, 'EV_Logs.csv'));
    document.getElementById('btnExportCosts').addEventListener('click', () => exportToCSV(State.costs, 'EV_Costs.csv'));
    
    document.getElementById('btnImport').addEventListener('click', () => {
        const fileInput = document.getElementById('importFile');
        importFromCSV(fileInput.files[0]);
    });
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
//Тук завършва SETTINGS & COMPARE

//От тук започва CHART & STATS LOGIC (Графики и Статистика)
function bindChartControls() {
    const bCum = document.getElementById('btn-chart-cum');
    const bMonth = document.getElementById('btn-chart-month');
    bCum.addEventListener('click', () => { State.chartMode = 'cumulative'; bCum.classList.add('active'); bMonth.classList.remove('active'); renderChart(); });
    bMonth.addEventListener('click', () => { State.chartMode = 'monthly'; bMonth.classList.add('active'); bCum.classList.remove('active'); renderChart(); });
}

//От тук започва CHART & STATS LOGIC (Графики и Статистика)
function updateStats() {
    const div = document.getElementById('tco-dashboard');
    if(!State.logs.length && !State.costs.length) { if(div) div.style.display = 'none'; return; }
    if(div) div.style.display = 'block';

    // 1. Смятаме ТОК (EV Energy)
    let evEnergyCost = 0; 
    let kwhTot = 0;
    State.logs.forEach(l => { 
        evEnergyCost += (l.total || l.kwh*l.price); 
        kwhTot += parseFloat(l.kwh); 
    });
    
    // 2. Смятаме ПОДДРЪЖКА (EV vs ICE)
    let evMaint = 0;
    let iceMaint = 0;

    State.costs.forEach(c => {
        const amount = parseFloat(c.amount);
        if(c.car === 'ice') {
            iceMaint += amount;
        } else {
            // Всичко друго е EV (вкл. старите записи)
            evMaint += amount;
        }
    });

    // 3. Сравнение с теоретичен бензин
    const miles = kwhTot * State.settings.evEff;
    const iceFuelTheoretical = (miles / State.settings.iceMpg) * 4.54609 * State.settings.fuelPrice;
    
    // ОБЩО
    const totalEV = evEnergyCost + evMaint;
    // Тук е малко tricky: ICE Total = Теоретичен Бензин (защото нямаме реален log) + Реална Поддръжка
    const totalICE = iceFuelTheoretical + iceMaint;
    
    const savings = totalICE - totalEV;

    // --- HTML RENDER ---
    const setText = (id, txt) => { const e=document.getElementById(id); if(e) e.innerText=txt; };
    setText('stat-miles', miles.toFixed(0));
    
    // Лява колона (EV)
    setText('stat-ev-charge', '£'+evEnergyCost.toFixed(2)); // Ток
    setText('stat-ev-maint', '£'+evMaint.toFixed(2));     // Поддръжка
    
    // Дясна колона (ICE)
    setText('stat-ice-fuel', '£'+iceFuelTheoretical.toFixed(2)); // Теоретичен Бензин
    setText('stat-ice-maint', '£'+iceMaint.toFixed(2));          // Реална поддръжка

    const card = document.getElementById('tco-card');
    if(card) {
        const color = savings >= 0 ? '#4CAF50' : '#f44336';
        card.style.border = `2px solid ${color}`;
        card.innerHTML = `
            <div style="color:#ccc; font-size:0.9em; text-transform:uppercase;">Общ Баланс (ТCO)</div>
            <div style="font-size:2em; font-weight:bold; color:${color}; margin:10px 0">
                ${savings>0?'+':''}£${savings.toFixed(2)}
            </div>
            <div style="display:flex; justify-content:space-between; color:#888; font-size:0.85rem; margin-top:5px;">
                <span>⚡ EV: £${totalEV.toFixed(0)}</span>
                <span>⛽ ICE: £${totalICE.toFixed(0)}</span>
            </div>
            <div style="font-size:0.75rem; color:#666; margin-top:5px;">(Вкл. Гориво + Поддръжка)</div>
        `;
    }
    
    // Update Chart if exists
    if (typeof Chart !== 'undefined' && typeof renderChart === 'function') renderChart();
}
//Тук завършва CHART & STATS LOGIC
