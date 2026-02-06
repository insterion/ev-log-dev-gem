/* main.js - Version: Odometer & Distance Calculation */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, setDoc, updateDoc, enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- ТВОЯТ FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyA-FbmvdK3eaYUsaT9Iqc3dUILH4rYDe8U",
  authDomain: "ev-log-2487f.firebaseapp.com",
  projectId: "ev-log-2487f",
  storageBucket: "ev-log-2487f.firebasestorage.app",
  messagingSenderId: "313386156743",
  appId: "1:313386156743:web:8451e533f1af823c0534e2"
};
// -----------------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Enable Offline Persistence
enableIndexedDbPersistence(db).catch((err) => {
    console.log("Persistence logic:", err.code);
});

// App State
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

// --- AUTH LOGIC ---
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

// --- FIRESTORE LISTENERS ---
let unsubscribeLogs, unsubscribeCosts, unsubscribeGarage, unsubscribeSettings;

function initDataListeners() {
    const uid = State.user.uid;

    // Logs - Sort Descending (Newest first) is crucial for Odo math
    const qLogs = query(collection(db, "logs"), where("uid", "==", uid));
    unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
        State.logs = [];
        snapshot.forEach((doc) => State.logs.push({ id: doc.id, ...doc.data() }));
        State.logs.sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest first
        renderLogList();
        renderHomeDashboard();
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

// --- DATABASE ACTIONS ---
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

// --- IMPORT / EXPORT FUNCTIONS ---
function exportToCSV(data, filename) {
    if (!data || !data.length) { alert("Няма данни."); return; }
    let headers = [];
    if(filename.includes("Logs")) headers = ["Date", "Odometer", "Type", "KWh", "Price", "Total", "Note"]; // Added Odometer
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

// CSV Parser
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


// --- UI LOGIC ---

function initUI() {
    bindNav();
    bindLogForm();
    bindCostsForm();
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

// *** UPGRADED HOME DASHBOARD (With Miles & Efficiency) ***
function renderHomeDashboard() {
    const div = document.getElementById('home-stats');
    if(!div) return;

    if(State.logs.length === 0) {
        div.innerHTML = `<div style="grid-column: span 2; text-align:center; color:#666; font-style:italic;">Няма данни</div>`;
        return;
    }

    // 1. Current Month Filter
    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7); // "2024-02"
    
    // Взимаме само записите за този месец
    const monthLogs = State.logs.filter(l => l.date.startsWith(currentMonthKey));
    
    // 2. Calculate Totals
    let totalCost = 0;
    let totalKwh = 0;
    let totalDist = 0;

    monthLogs.forEach(l => {
        totalCost += (l.total || l.kwh * l.price);
        totalKwh += l.kwh;

        // Смятане на дистанция за всеки запис от месеца
        if(l.odo) {
             // Търсим предходния запис в ЦЯЛАТА история (не само в месеца)
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

    // Calculate Efficiency (Avoid division by zero)
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

function bindLogForm() {
    const btnAdd = document.getElementById('addEntry');
    const typeSelect = document.getElementById('type');
    const priceInput = document.getElementById('price');
    const kwhInput = document.getElementById('kwh');
    const odoInput = document.getElementById('odo');
    
    // ПОПРАВКА: Тази функция вече само ПРЕДЛАГА цена, но не заключва полето
    const syncPrice = () => {
        const opt = typeSelect.options[typeSelect.selectedIndex];
        // Ако сме в режим на редакция (Edit), не пипай цената, която потребителят е въвел
        if (btnAdd.classList.contains("update-mode-btn")) return;

        if(opt && opt.dataset.price) {
            priceInput.value = opt.dataset.price;
            // ПРЕМАХНАТО: priceInput.setAttribute('readonly', true); -> Вече може да се пише
            // Връщаме нормалния вид на полето
            priceInput.style.opacity = "1";
            priceInput.style.background = "#2c2c2c"; // Стандартния цвят
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
    
    // Първоначално зареждане, ако полето е празно
    if(!priceInput.value) syncPrice();

    btnAdd.addEventListener('click', () => {
        const date = document.getElementById('date').value;
        const kwh = parseFloat(kwhInput.value);
        
        // Ако потребителят е изтрил цената, сложи тази по подразбиране
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
        
        // Изчистване на полетата след запис
        kwhInput.value = '';
        odoInput.value = ''; 
        document.getElementById('note').value = '';
        document.getElementById('log-preview').style.display = 'none';
        
        // Връщаме цената към default за следващия запис
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

function renderLogList() {
    const div = document.getElementById('logTable');
    let html = '';

    // --- НАСТРОЙКИ ЗА СРАВНЕНИЕ (ICE) ---
    const ICE_MPG = 45;           // Твоят разход (45 мили с 1 галон)
    const ICE_FUEL_PRICE = 1.45;  // Цена на литър гориво
    const LITERS_PER_GALLON = 4.54609; // Британски галон към литри
    // ------------------------------------

    for(let i = 0; i < State.logs.length; i++) {
        const l = State.logs[i];
        
        // Реална цена на зареждането (ако има Total ползва него, иначе смята kWh * price)
        const cost = l.total !== undefined ? l.total : (l.kwh * l.price);
        
        let distanceHtml = '';
        let effHtml = '';
        let savingsHtml = '';

        if (l.odo) {
            let dist = 0;
            // Търсим предишен запис, за да видим колко сме минали
            for(let j = i + 1; j < State.logs.length; j++) {
                if(State.logs[j].odo) {
                    dist = l.odo - State.logs[j].odo;
                    break;
                }
            }
            
            if(dist > 0) {
                // 1. Ефективност (mi/kWh)
                const efficiency = dist / l.kwh;
                
                // Цвят за ефективността
                let effColor = '#888'; 
                if(efficiency > 4.0) effColor = '#4CAF50'; 
                else if(efficiency < 2.5) effColor = '#f44336'; 
                
                distanceHtml = `<span style="color:#2196F3; font-weight:bold; font-size:0.9rem; margin-right:8px;">+${dist} mi</span>`;
                effHtml = `<span style="color:${effColor}; font-size:0.8rem; background:#222; padding:2px 6px; border-radius:4px; margin-right:8px;">${efficiency.toFixed(1)} mi/kWh</span>`;

                // 2. СМЕТКА: СПЕСТЯВАНЕ СПРЯМО ДВГ (45 MPG)
                // Колко галона би изгорила ДВГ колата за тези мили?
                const gallonsNeeded = dist / ICE_MPG;
                // Колко литра са това?
                const litersNeeded = gallonsNeeded * LITERS_PER_GALLON;
                // Колко би струвал бензинът?
                const iceCost = litersNeeded * ICE_FUEL_PRICE;
                
                // Разликата (Ако Бензин > Ток = Спестяваме)
                const savings = iceCost - cost;

                if (savings >= 0) {
                    // Зелено (Спестено)
                    savingsHtml = `<span style="color:#4CAF50; font-weight:bold; font-size:0.85rem;">SAVE £${savings.toFixed(2)}</span>`;
                } else {
                    // Червено (Загуба)
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
                    ${distanceHtml}
                    ${effHtml}
                    ${savingsHtml}  </div>

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

    // Закачане на бутоните (Event Listeners)
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
            dbUpdateCost(State.editCostId, entryData);
            State.editCostId = null;
            btnAdd.innerText = "Add Cost";
            btnAdd.classList.remove("update-mode-btn");
        } else { dbAddCost(entryData); }
        document.getElementById('c_amount').value = '';
        document.getElementById('c_note').value = '';
    });
}

function renderCostsList() {
    // Взимаме контейнера (div-а), където ще рисуваме
    // ВНИМАНИЕ: Провери в HTML файла дали div-ът се казва 'costs' или 'costsList'. 
    // Обикновено в tab-content e 'costs'.
    const div = document.getElementById('costs') || document.getElementById('costsList');
    
    if (!div) return; // Защита ако не намери елемента

    // --- 1. КАЛКУЛАЦИЯ НА СПЕСТЯВАНИЯТА (От Logs) ---
    const ICE_MPG = 45; 
    const ICE_FUEL_PRICE = 1.45;
    const LITERS_PER_GALLON = 4.54609;

    let totalEvCost = 0;
    let totalMiles = 0;
    
    // Сортираме логовете по дата
    const sortedLogs = [...State.logs].sort((a, b) => new Date(b.date) - new Date(a.date));

    for(let i = 0; i < sortedLogs.length; i++) {
        const l = sortedLogs[i];
        // Цена на тока
        totalEvCost += (l.total !== undefined ? parseFloat(l.total) : (parseFloat(l.kwh) * parseFloat(l.price)));

        // Изчисляване на изминати мили
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

    // Сметка за ДВГ
    const gallons = totalMiles / ICE_MPG;
    const liters = gallons * LITERS_PER_GALLON;
    const totalIceCost = liters * ICE_FUEL_PRICE;
    const totalSaved = totalIceCost - totalEvCost;

    // Проценти за графиката
    const maxVal = Math.max(totalIceCost, totalEvCost);
    const icePercent = maxVal > 0 ? (totalIceCost / maxVal) * 100 : 0;
    const evPercent = maxVal > 0 ? (totalEvCost / maxVal) * 100 : 0;


    // --- 2. ГЕНЕРИРАНЕ НА HTML ---
    
    // А) Секция "ТАБЛО СПЕСТЯВАНИЯ"
    let html = `
    <div style="background: #1e1e1e; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #333;">
        <h3 style="margin:0; color:#888; font-size: 0.9rem; text-transform: uppercase;">Финансов Баланс (Гориво)</h3>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
            <div>
                <div style="font-size:2rem; font-weight:bold; color: #4CAF50;">£${totalSaved.toFixed(2)}</div>
                <div style="font-size:0.8rem; color:#aaa;">Спестени спрямо ДВГ</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:0.9rem; color:#fff;">${totalMiles.toFixed(0)} mi</div>
                <div style="font-size:0.8rem; color:#666;">Общ пробег</div>
            </div>
        </div>

        <div style="margin-top:20px;">
            <div style="display:flex; align-items:center; margin-bottom:8px;">
                <span style="width:40px; font-size:0.75rem; color:#aaa;">ICE</span>
                <div style="flex-grow:1; background:#333; height:8px; border-radius:4px; margin:0 10px; position:relative;">
                    <div style="width:${icePercent}%; background:#f44336; height:100%; border-radius:4px;"></div>
                </div>
                <span style="width:60px; text-align:right; font-size:0.8rem; color:#f44336;">£${totalIceCost.toFixed(0)}</span>
            </div>
            
            <div style="display:flex; align-items:center;">
                <span style="width:40px; font-size:0.75rem; color:#aaa;">EV</span>
                <div style="flex-grow:1; background:#333; height:8px; border-radius:4px; margin:0 10px; position:relative;">
                    <div style="width:${evPercent}%; background:#4CAF50; height:100%; border-radius:4px;"></div>
                </div>
                <span style="width:60px; text-align:right; font-size:0.8rem; color:#4CAF50;">£${totalEvCost.toFixed(0)}</span>
            </div>
        </div>
    </div>
    
    <hr style="border:0; border-top:1px solid #333; margin: 20px 0;">
    `;

    // Б) Секция "ДОБАВИ РАЗХОД" (Формата)
    html += `
    <div class="input-group">
        <label>Разход за:</label>
        <select id="cost-car" class="input-field">
            <option value="My Car (EV)">Моята Кола (EV)</option>
        </select>
    </div>
    <div class="input-group">
        <label>Дата</label>
        <input type="date" id="cost-date" class="input-field">
    </div>
    <div class="input-group">
        <label>Категория</label>
        <select id="cost-cat" class="input-field">
            <option>Service</option>
            <option>Tires</option>
            <option>Insurance</option>
            <option>Tax</option>
            <option>Repair</option>
            <option>Accessories</option>
            <option>Other</option>
        </select>
    </div>
    <div class="input-group">
        <label>Сума (£)</label>
        <input type="number" id="cost-amount" class="input-field" placeholder="0.00" step="0.01">
    </div>
    <div class="input-group">
        <label>Описание</label>
        <input type="text" id="cost-note" class="input-field" placeholder="ex. Winter tires">
    </div>
    <button id="addCostBtn" class="primary-btn" style="margin-top:10px;">Add Cost</button>
    
    <div style="margin-top:30px;">
        <h3 style="border-left: 4px solid #4CAF50; padding-left: 10px; margin-bottom:15px;">История на разходите</h3>
        <div id="costListContainer"></div>
    </div>
    `;

    div.innerHTML = html;

    // В) Попълване на днешна дата
    const dateInput = document.getElementById('cost-date');
    if(dateInput) dateInput.valueAsDate = new Date();

    // Г) Логика за бутона Add Cost
    const addBtn = document.getElementById('addCostBtn');
    if(addBtn) {
        addBtn.onclick = () => {
            const amount = parseFloat(document.getElementById('cost-amount').value);
            const cat = document.getElementById('cost-cat').value;
            const note = document.getElementById('cost-note').value;
            const date = document.getElementById('cost-date').value;

            if(!amount || !date) return alert('Моля въведете сума и дата.');

            const newCost = {
                id: Date.now(),
                car: 'EV',
                amount,
                category: cat,
                date,
                note
            };

            dbAddCost(newCost); 
        };
    }

    // Д) Рендиране на списъка (долната част)
    const listDiv = document.getElementById('costListContainer');
    let listHtml = '';
    
    const sortedCosts = [...State.costs].sort((a,b) => new Date(b.date) - new Date(a.date));

    sortedCosts.forEach(c => {
        let icon = '🔧';
        if(c.category === 'Tires') icon = '🛞';
        if(c.category === 'Insurance') icon = '📄';
        if(c.category === 'Tax') icon = '🏛️';
        if(c.category === 'Other') icon = '⚡';

        listHtml += `
        <div class="log-entry" style="border-left: 3px solid #FF9800;">
            <div class="log-info">
                <div class="log-main-row">
                    <span style="font-weight:bold; font-size:1.1rem;">£${parseFloat(c.amount).toFixed(2)}</span>
                    <span style="color:#FF9800; font-size:0.9rem;"> ${icon} ${c.category}</span>
                </div>
                <div class="log-sub-row">
                    <span>${c.date}</span>
                </div>
                ${c.note ? `<div class="log-note" style="color:#aaa; font-style:italic;">${c.note}</div>` : ''}
            </div>
            <div class="action-btn-group">
                <button class="delete-btn" id="del-cost-${c.id}">×</button>
            </div>
        </div>`;
    });

    if(listDiv) listDiv.innerHTML = listHtml || '<p style="text-align:center; color:#666;">Няма записани разходи.</p>';

    // Event listeners за триене на разходи
    sortedCosts.forEach(c => {
        const delBtn = document.getElementById(`del-cost-${c.id}`);
        if(delBtn) {
            delBtn.addEventListener('click', () => {
                if(confirm('Delete cost?')) dbDeleteCost(c.id);
            });
        }
    });
}

// *** SMART GARAGE LOGIC (Full Replacement) ***

function bindGarage() {
    const btnEv = document.getElementById('btn-sw-ev');
    const btnIce = document.getElementById('btn-sw-ice');
    
    // Toggle Tabs
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

    // Save Button
    document.getElementById('saveGarageManual').addEventListener('click', () => {
        // Списък с ВСИЧКИ полета, които записваме
        const ids = [
            // Docs
            'g_insurance', 'g_mot', 'g_tax', 'g_service', 
            // Maintenance
            'g_tire_date', 'g_tire_odo', 'g_tire_note',
            'g_12v_date', 'g_filter_date', 'g_wipers_date',
            // Info
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
    
    // Изчисляваме статусите веднага след зареждане
    calculateGarageStats();
}

function calculateGarageStats() {
    // 1. Стандартни документи (Изтичащи дати)
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

    // 2. ГУМИ (Пробег + Възраст)
    const tireDiv = document.getElementById('stat_tires');
    const tireOdo = parseFloat(document.getElementById('g_tire_odo').value) || 0;
    const currentOdo = (State.logs.length > 0 && State.logs[0].odo) ? State.logs[0].odo : 0;
    
    let tireText = "";
    if(tireOdo > 0 && currentOdo > 0) {
        const driven = currentOdo - tireOdo;
        tireText = `Изминати: ${driven} mi`;
    }
    tireDiv.innerText = tireText;

    // 3. Възраст на части (Age Check)
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

        // Ако е старо (над warnYears), оцветяваме в червено
        if (monthsDiff > (warnYears * 12)) color = "#f44336"; 
        
        el.innerText = `Възраст: ${txt}`;
        el.style.color = color;
    };

    checkAge('g_12v_date', 'stat_12v', 3);      // 3 години за акумулатор
    checkAge('g_filter_date', 'stat_filter', 2); // 2 години за филтър
    checkAge('g_wipers_date', 'stat_wipers', 1); // 1 година за чистачки
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
    document.getElementById('btnExportLogs').addEventListener('click', () => exportToCSV(State.logs, 'EV_Logs.csv'));
    document.getElementById('btnExportCosts').addEventListener('click', () => exportToCSV(State.costs, 'EV_Costs.csv'));
    
    // IMPORT BINDING
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

function bindChartControls() {
    const bCum = document.getElementById('btn-chart-cum');
    const bMonth = document.getElementById('btn-chart-month');
    bCum.addEventListener('click', () => { State.chartMode = 'cumulative'; bCum.classList.add('active'); bMonth.classList.remove('active'); renderChart(); });
    bMonth.addEventListener('click', () => { State.chartMode = 'monthly'; bMonth.classList.add('active'); bCum.classList.remove('active'); renderChart(); });
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
    if(window.myChart) window.myChart.destroy();

    let dataSets = [], labels = [];

    if (State.chartMode === 'cumulative') {
        let events = [];
        State.logs.forEach(l => events.push({ date: l.date, ev: (l.total||l.kwh*l.price), ice: (l.kwh*State.settings.evEff/State.settings.iceMpg)*4.54609*State.settings.fuelPrice }));
        State.costs.forEach(c => events.push({ date: c.date, ev: (c.target!=='ice'?parseFloat(c.amount):0), ice: (c.target==='ice'?parseFloat(c.amount):0) }));
        events.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        let cEv=0, cIce=0, dEv=[], dIce=[];
        events.forEach(e => {
            cEv += e.ev; cIce += e.ice;
            labels.push(e.date); dEv.push(cEv); dIce.push(cIce);
        });

        dataSets = [
            { label: 'ICE (Cumul)', data: dIce, borderColor: '#f44336', backgroundColor: '#f44336', fill: false, pointRadius: 0, type: 'line' },
            { label: 'EV (Cumul)', data: dEv, borderColor: '#4CAF50', backgroundColor: '#4CAF50', fill: false, pointRadius: 0, type: 'line' }
        ];

    } else {
        let monthly = {}; 
        
        State.logs.forEach(l => {
            const m = l.date.substring(0, 7);
            if(!monthly[m]) monthly[m] = { ev: 0, ice: 0 };
            monthly[m].ev += (l.total || l.kwh*l.price);
            monthly[m].ice += (l.kwh * State.settings.evEff / State.settings.iceMpg) * 4.54609 * State.settings.fuelPrice;
        });

        State.costs.forEach(c => {
            const m = c.date.substring(0, 7);
            if(!monthly[m]) monthly[m] = { ev: 0, ice: 0 };
            if(c.target === 'ice') monthly[m].ice += parseFloat(c.amount);
            else monthly[m].ev += parseFloat(c.amount);
        });

        labels = Object.keys(monthly).sort();
        let dEv = [], dIce = [];
        labels.forEach(m => {
            dEv.push(monthly[m].ev);
            dIce.push(monthly[m].ice);
        });

        dataSets = [
            { label: 'ICE Cost', data: dIce, backgroundColor: '#f44336', borderColor: '#f44336', borderWidth: 1 },
            { label: 'EV Cost', data: dEv, backgroundColor: '#4CAF50', borderColor: '#4CAF50', borderWidth: 1 }
        ];
    }

    window.myChart = new Chart(ctx, {
        type: State.chartMode === 'cumulative' ? 'line' : 'bar',
        data: { labels: labels, datasets: dataSets },
        options: { 
            responsive: true, maintainAspectRatio: false,
            scales: { x: { display: State.chartMode !== 'cumulative' }, y: { grid: { color: '#333' } } },
            plugins: { legend: { display: true, labels: { color: '#ccc' } } }
        }
    });
}
