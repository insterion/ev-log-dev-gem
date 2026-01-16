/* =========================================
   APP.JS - Combined Application Logic
   Updated: Auto-fill price based on Type selection
   ========================================= */

// --- 1. CALCULATOR LOGIC ---
const Calc = {
    compare: function(kwh, pricePerKwh, evEfficiency, iceMpg, fuelPricePerLiter) {
        const rangeMiles = kwh * evEfficiency;
        const costEV = kwh * pricePerKwh;
        const gallons = rangeMiles / iceMpg;
        const liters = gallons * 4.54609;
        const costICE = liters * fuelPricePerLiter;
        return { 
            rangeMiles, costEV, costICE, 
            savings: costICE - costEV, 
            isCheaper: costEV < costICE 
        };
    },
    calculateTCO: function(logs, costs, settings) {
        let totalKwh = 0; 
        let totalEvChargingCost = 0;
        
        logs.forEach(l => {
            totalKwh += parseFloat(l.kwh) || 0;
            let cost = (l.total !== undefined) ? parseFloat(l.total) : (parseFloat(l.kwh) * parseFloat(l.price));
            if(isNaN(cost)) cost = 0;
            totalEvChargingCost += cost;
        });

        let totalEvMaint = 0; 
        let totalIceMaint = 0;
        costs.forEach(c => {
            const target = c.target || 'ev'; 
            const amt = parseFloat(c.amount) || 0;
            if(target === 'ev') totalEvMaint += amt; 
            else totalIceMaint += amt;
        });

        const totalMiles = totalKwh * settings.evEff;
        const gallons = totalMiles / settings.iceMpg;
        const liters = gallons * 4.54609;
        const totalIceFuelCost = liters * settings.fuelPrice;

        const totalSpentEV = totalEvChargingCost + totalEvMaint;
        const totalSpentICE = totalIceFuelCost + totalIceMaint;
        
        return { 
            totalMiles, totalEvChargingCost, totalEvMaint, 
            totalIceFuelCost, totalIceMaint, totalSpentEV, totalSpentICE, 
            netBalance: totalSpentICE - totalSpentEV 
        };
    }
};

// --- 2. APP CORE ---
const App = {
    data: { logs: [], costs: [] },
    settings: { evEff: 3.0, iceMpg: 44, fuelPrice: 1.45 },
    
    init: function() {
        const d = localStorage.getItem('ev_log_data'); 
        if(d) try { this.data = JSON.parse(d); } catch(e){ console.error(e); }
        
        const s = localStorage.getItem('ev_log_settings'); 
        if(s) try { this.settings = JSON.parse(s); } catch(e){ console.error(e); }
        
        if(!this.data.logs) this.data.logs = [];
        if(!this.data.costs) this.data.costs = [];
    },
    save: function() {
        localStorage.setItem('ev_log_data', JSON.stringify(this.data));
        localStorage.setItem('ev_log_settings', JSON.stringify(this.settings));
    },
    addLog: function(e) { e.id = Date.now(); this.data.logs.unshift(e); this.save(); },
    deleteLog: function(id) { this.data.logs = this.data.logs.filter(i => i.id !== id); this.save(); },
    addCost: function(e) { e.id = Date.now(); this.data.costs.unshift(e); this.save(); },
    deleteCost: function(id) { this.data.costs = this.data.costs.filter(i => i.id !== id); this.save(); }
};

// --- 3. UI RENDER LOGIC ---
const UILog = {
    renderList: function(logs) {
        const container = document.getElementById('logTable'); 
        if (!container) return;
        if (!logs || logs.length === 0) { 
            container.innerHTML = '<p style="color:#666; text-align:center;">Няма записи.</p>'; 
            return; 
        }
        let html = '';
        logs.forEach(log => {
            const totalCost = (log.total !== undefined) ? parseFloat(log.total) : (log.kwh * log.price);
            html += `
            <div class="log-entry">
                <div class="log-info">
                    <div class="log-main">
                        <span class="log-kwh">${log.kwh} kWh</span>
                        <span class="log-cost">£${totalCost.toFixed(2)}</span>
                    </div>
                    <div class="log-sub">${log.date} • ${log.type}</div>
                    <div class="log-note">${log.note || ''}</div>
                </div>
                <div class="log-actions">
                    <button onclick="AppActions.editLogEntry(${log.id})" class="btn-icon edit">✎</button>
                    <button onclick="AppActions.deleteLogEntry(${log.id})" class="btn-icon delete">✖</button>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    },
    renderPreview: function(calcResult) {
        const div = document.getElementById('log-preview'); 
        if (!div) return;
        if (!calcResult || calcResult.rangeMiles <= 0) { div.style.display = 'none'; return; }
        const color = calcResult.isCheaper ? '#4CAF50' : '#f44336'; 
        const text = calcResult.isCheaper ? 'СПЕСТЯВАШ' : 'ЗАГУБА';
        div.style.display = 'block';
        div.innerHTML = `
            <div style="background: #1a1a1a; border: 1px solid ${color}; border-radius: 8px; padding: 10px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9em; color:#ccc;">
                    <span>⚡ EV: <strong>£${calcResult.costEV.toFixed(2)}</strong></span>
                    <span>⛽ ICE: <strong>£${calcResult.costICE.toFixed(2)}</strong></span>
                </div>
                <div style="text-align:center; border-top:1px solid #333; padding-top:5px; margin-top:5px;">
                    <span style="color:${color}; font-weight:bold; font-size:1.1em;">${text} £${Math.abs(calcResult.savings).toFixed(2)}</span>
                    <div style="font-size:0.8em; color:#666;">при пробег ~${calcResult.rangeMiles.toFixed(0)} mi</div>
                </div>
            </div>`;
    }
};

// --- 4. APP ACTIONS (CONTROLLER) ---
let editModeId = null;
let editCostModeId = null;
let myChart = null;

const AppActions = {
    init: function() {
        App.init(); 
        
        this.bindNav();
        this.bindLog();
        this.bindCosts();
        this.bindSettings();
        this.bindCompare();
        
        UILog.renderList(App.data.logs);
        this.renderCostsList();
        
        const today = new Date().toISOString().split('T')[0];
        if(document.getElementById('date')) document.getElementById('date').value = today;
        if(document.getElementById('c_date')) document.getElementById('c_date').value = today;

        this.updateStats();
    },

    bindNav: function() {
        const tabs = document.querySelectorAll('.tabbtn');
        const sections = document.querySelectorAll('.tab');

        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));
                btn.classList.add('active');
                const targetId = btn.getAttribute('data-tab');
                document.getElementById(targetId).classList.add('active');
                if(targetId === 'compare') this.updateStats();
            });
        });
    },

    // --- LOG LOGIC (UPDATED WITH AUTO-PRICE) ---
    bindLog: function() {
        const btnAdd = document.getElementById('addEntry');
        const kwhInput = document.getElementById('kwh');
        const priceInput = document.getElementById('price');
        const typeSelect = document.getElementById('type');
        const sameAsLastBtn = document.getElementById('sameAsLast');

        // Helper: Update price from dropdown and refresh preview
        const syncPriceFromType = () => {
            const opt = typeSelect.options[typeSelect.selectedIndex];
            if(opt && opt.dataset.price) {
                priceInput.value = opt.dataset.price;
            }
            updatePreview();
        };

        const updatePreview = () => {
             const kwh = parseFloat(kwhInput.value) || 0;
             const price = parseFloat(priceInput.value) || 0;
             const res = Calc.compare(kwh, price, parseFloat(App.settings.evEff), parseFloat(App.settings.iceMpg), parseFloat(App.settings.fuelPrice));
             UILog.renderPreview(res);
        };

        // Event: When TYPE changes -> Update Price automatically
        typeSelect.addEventListener('change', syncPriceFromType);

        // Event: When Inputs change -> Just update preview
        kwhInput.addEventListener('input', updatePreview);
        priceInput.addEventListener('input', updatePreview);

        // Initialize Price on Load
        syncPriceFromType();

        // Add Button Logic
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const date = document.getElementById('date').value;
                const kwh = parseFloat(kwhInput.value);
                const price = parseFloat(priceInput.value);
                const type = typeSelect.value;
                const note = document.getElementById('note').value;

                if (!date || isNaN(kwh) || isNaN(price)) return alert('Моля попълнете всички полета');

                if (editModeId) {
                    const index = App.data.logs.findIndex(l => l.id === editModeId);
                    if (index !== -1) {
                        App.data.logs[index] = { id: editModeId, date, kwh, price, type, note, total: kwh * price };
                        App.save();
                    }
                    editModeId = null;
                    btnAdd.innerText = "Add Entry";
                    btnAdd.style.backgroundColor = ""; 
                } else {
                    App.addLog({ date, kwh, price, type, note, total: kwh * price });
                }

                UILog.renderList(App.data.logs);
                this.clearLogForm();
                this.updateStats();
            });
        }
        
        // "Same as Last" Logic
        sameAsLastBtn.addEventListener('click', () => {
            if(App.data.logs.length > 0) {
                const last = App.data.logs[0];
                priceInput.value = last.price;
                typeSelect.value = last.type;
                document.getElementById('note').value = last.note;
                updatePreview();
            }
        });
    },

    editLogEntry: function(id) {
        const entry = App.data.logs.find(l => l.id === id);
        if(!entry) return;
        document.getElementById('date').value = entry.date;
        document.getElementById('kwh').value = entry.kwh;
        document.getElementById('price').value = entry.price;
        document.getElementById('type').value = entry.type;
        document.getElementById('note').value = entry.note;
        
        document.querySelector('[data-tab="log"]').click();
        document.getElementById('log').scrollIntoView({behavior: 'smooth'});
        editModeId = id;
        const btn = document.getElementById('addEntry');
        btn.innerText = "Update Entry";
        btn.style.backgroundColor = "#ff9800";
    },

    deleteLogEntry: function(id) {
        if(confirm('Delete log?')) {
            App.deleteLog(id);
            UILog.renderList(App.data.logs);
            this.updateStats();
            if(editModeId === id) this.clearLogForm();
        }
    },

    clearLogForm: function() {
        document.getElementById('kwh').value = '';
        document.getElementById('note').value = '';
        document.getElementById('log-preview').style.display = 'none';
        
        // Reset type to first option and auto-set price
        const typeSelect = document.getElementById('type');
        typeSelect.selectedIndex = 0;
        const opt = typeSelect.options[0];
        if(opt && opt.dataset.price) document.getElementById('price').value = opt.dataset.price;

        editModeId = null;
        document.getElementById('addEntry').innerText = "Add Entry";
        document.getElementById('addEntry').style.backgroundColor = ""; 
    },

    // COSTS
    bindCosts: function() {
        const btn = document.getElementById('c_add');
        if(btn) {
            btn.addEventListener('click', () => {
                const date = document.getElementById('c_date').value;
                const amount = parseFloat(document.getElementById('c_amount').value);
                const cat = document.getElementById('c_category').value;
                const note = document.getElementById('c_note').value;
                const target = document.getElementById('c_target').value; 
                
                if(!amount || !date) return alert('Enter amount and date');

                if (editCostModeId) {
                    const index = App.data.costs.findIndex(c => c.id === editCostModeId);
                    if (index !== -1) {
                        App.data.costs[index] = { id: editCostModeId, date, amount, cat, note, target };
                        App.save();
                    }
                    editCostModeId = null;
                    btn.innerText = "Add Cost";
                    btn.style.backgroundColor = "";
                } else {
                    App.addCost({ date, amount, cat, note, target });
                }

                this.renderCostsList();
                this.clearCostForm();
                this.updateStats();
            });
        }
    },

    renderCostsList: function() {
        const div = document.getElementById('costTable');
        if(!div) return;
        let html = '';
        if(App.data.costs.length === 0) div.innerHTML = '<p style="color:#666;">Няма разходи.</p>';
        else {
            App.data.costs.forEach(c => {
                const isIce = (c.target === 'ice');
                html += `<div class="log-entry" style="border-left: 3px solid ${isIce ? '#f44336' : '#4CAF50'}">
                    <div class="log-info"><span style="color:#fff;">${c.date} ${isIce?'⛽':'🚗'} <strong>${c.cat}</strong></span><br><small style="color:#888;">${c.note}</small></div>
                    <div><span style="color:#fff; font-weight:bold; margin-right:10px;">£${parseFloat(c.amount).toFixed(2)}</span></div>
                    <div class="log-actions"><button onclick="AppActions.editCostEntry(${c.id})" class="btn-icon edit">✎</button><button onclick="AppActions.deleteCostEntry(${c.id})" class="btn-icon delete">✖</button></div>
                </div>`;
            });
            div.innerHTML = html;
        }
    },

    editCostEntry: function(id) {
        const entry = App.data.costs.find(c => c.id === id);
        if(!entry) return;
        document.getElementById('c_date').value = entry.date;
        document.getElementById('c_amount').value = entry.amount;
        document.getElementById('c_category').value = entry.cat;
        document.getElementById('c_note').value = entry.note;
        document.getElementById('c_target').value = entry.target || 'ev';
        
        document.querySelector('[data-tab="costs"]').click();
        document.getElementById('costs').scrollIntoView({behavior: 'smooth'});
        editCostModeId = id;
        const btn = document.getElementById('c_add');
        btn.innerText = "Update Cost";
        btn.style.backgroundColor = "#ff9800";
    },

    deleteCostEntry: function(id) {
        if(confirm('Delete cost?')) {
            App.deleteCost(id);
            this.renderCostsList();
            this.updateStats();
            if(editCostModeId === id) this.clearCostForm();
        }
    },

    clearCostForm: function() {
        document.getElementById('c_amount').value = '';
        document.getElementById('c_note').value = '';
        document.getElementById('c_target').value = 'ev'; 
        editCostModeId = null;
        document.getElementById('c_add').innerText = "Add Cost";
        document.getElementById('c_add').style.backgroundColor = "";
    },

    // STATS
    updateStats: function() {
        const stats = Calc.calculateTCO(App.data.logs, App.data.costs, App.settings);

        const elIds = {
            'stat-miles': stats.totalMiles.toFixed(0),
            'stat-ev-charge': '£' + stats.totalEvChargingCost.toFixed(2),
            'stat-ev-maint': '£' + stats.totalEvMaint.toFixed(2),
            'stat-ice-fuel': '£' + stats.totalIceFuelCost.toFixed(2),
            'stat-ice-maint': '£' + stats.totalIceMaint.toFixed(2)
        };
        for(const [id, val] of Object.entries(elIds)){
            const el = document.getElementById(id);
            if(el) el.innerText = val;
        }

        const card = document.getElementById('tco-card');
        if(card) {
            const isPositive = stats.netBalance >= 0;
            const color = isPositive ? '#4CAF50' : '#f44336';
            card.style.border = `2px solid ${color}`;
            card.innerHTML = `
                <div style="font-size:0.9rem; color:#ccc;">Общ Резултат (Savings)</div>
                <div style="font-size:1.8rem; font-weight:bold; color:${color}; margin:10px 0;">${isPositive ? '+' : ''}£${stats.netBalance.toFixed(2)}</div>
                <div style="font-size:0.8rem; color:#888;">ICE Total (£${stats.totalSpentICE.toFixed(0)}) vs EV Total (£${stats.totalSpentEV.toFixed(0)})</div>`;
        }

        this.renderChart(App.data.logs, App.data.costs, App.settings);
        this.renderMonthlyStats(App.data.logs, App.data.costs, App.settings);
    },

    renderMonthlyStats: function(logs, costs, settings) {
        const container = document.getElementById('monthly-stats-table');
        if(!container) return;

        let monthlyData = {};

        logs.forEach(l => {
            const month = l.date.substring(0, 7); 
            if(!monthlyData[month]) monthlyData[month] = { ev:0, ice:0, kwh:0 };
            
            const cost = (l.total !== undefined) ? parseFloat(l.total) : (l.kwh * l.price);
            monthlyData[month].ev += cost;
            monthlyData[month].kwh += parseFloat(l.kwh);
        });

        costs.forEach(c => {
            const month = c.date.substring(0, 7);
            if(!monthlyData[month]) monthlyData[month] = { ev:0, ice:0, kwh:0 };
            
            if(c.target === 'ice') monthlyData[month].ice += parseFloat(c.amount);
            else monthlyData[month].ev += parseFloat(c.amount);
        });

        Object.keys(monthlyData).forEach(m => {
            const miles = monthlyData[m].kwh * settings.evEff;
            const fuelCost = (miles / settings.iceMpg) * 4.54609 * settings.fuelPrice;
            monthlyData[m].ice += fuelCost;
        });

        const sortedMonths = Object.keys(monthlyData).sort().reverse();

        let html = '<table style="width:100%; border-collapse: collapse; font-size:0.9rem;">';
        html += '<tr style="border-bottom:1px solid #444; color:#888; text-align:left;"><th>Месец</th><th style="text-align:right">EV</th><th style="text-align:right">ICE</th><th style="text-align:right">Net</th></tr>';
        
        sortedMonths.forEach(m => {
            const d = monthlyData[m];
            const net = d.ice - d.ev;
            const color = net >= 0 ? '#4CAF50' : '#f44336';
            const cleanDate = new Date(m + "-01").toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            
            html += `<tr style="border-bottom:1px solid #222;">
                <td style="padding:10px 0; color:#ccc;">${cleanDate}</td>
                <td style="padding:10px 0; text-align:right; color:#ccc;">£${d.ev.toFixed(0)}</td>
                <td style="padding:10px 0; text-align:right; color:#ccc;">£${d.ice.toFixed(0)}</td>
                <td style="padding:10px 0; text-align:right; font-weight:bold; color:${color}">£${net.toFixed(0)}</td>
            </tr>`;
        });
        html += '</table>';
        
        if(sortedMonths.length === 0) html = '<p style="color:#666; font-size:0.8rem;">Няма данни за месечен отчет.</p>';
        container.innerHTML = html;
    },

    renderChart: function(logs, costs, settings) {
        const ctx = document.getElementById('tcoChart');
        if(!ctx) return;
        
        let allEvents = [];
        logs.forEach(l => {
            const cost = (l.total !== undefined) ? parseFloat(l.total) : (l.kwh * l.price);
            const miles = l.kwh * settings.evEff;
            const fuelCost = (miles / settings.iceMpg) * 4.54609 * settings.fuelPrice;
            allEvents.push({ date: l.date, evCost: cost, iceCost: fuelCost });
        });
        costs.forEach(c => {
            const amt = parseFloat(c.amount);
            if(c.target === 'ice') allEvents.push({ date: c.date, evCost: 0, iceCost: amt });
            else allEvents.push({ date: c.date, evCost: amt, iceCost: 0 });
        });
        allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

        let labels = []; let evData = []; let iceData = [];
        let cumulativeEv = 0; let cumulativeIce = 0;

        allEvents.forEach(e => {
            cumulativeEv += e.evCost;
            cumulativeIce += e.iceCost;
            labels.push(e.date);
            evData.push(cumulativeEv);
            iceData.push(cumulativeIce);
        });

        if (myChart) myChart.destroy();

        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'ICE Total', data: iceData, borderColor: '#f44336', backgroundColor: 'rgba(244, 67, 54, 0.1)', fill: true, tension: 0.1, pointRadius: 0 },
                    { label: 'EV Total', data: evData, borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)', fill: true, tension: 0.1, pointRadius: 0 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { display: false }, y: { ticks: { color: '#888', callback: (v) => '£'+v }, grid: { color: '#333' } } },
                plugins: { legend: { labels: { color: '#ccc' } } },
                interaction: { mode: 'index', intersect: false }
            }
        });
    },

    bindSettings: function() {
        if(document.getElementById('set_ev_eff')) document.getElementById('set_ev_eff').value = App.settings.evEff;
        if(document.getElementById('set_ice_mpg')) document.getElementById('set_ice_mpg').value = App.settings.iceMpg;
        if(document.getElementById('set_fuel_price')) document.getElementById('set_fuel_price').value = App.settings.fuelPrice;

        const btnSave = document.getElementById('saveCompareSettings');
        if(btnSave) {
            btnSave.addEventListener('click', () => {
                App.settings.evEff = parseFloat(document.getElementById('set_ev_eff').value);
                App.settings.iceMpg = parseFloat(document.getElementById('set_ice_mpg').value);
                App.settings.fuelPrice = parseFloat(document.getElementById('set_fuel_price').value);
                App.save();
                AppActions.updateStats();
                alert('Saved!');
            });
        }
        
        const btnExport = document.getElementById('exportBackup');
        if(btnExport) {
            btnExport.addEventListener('click', () => {
                 const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(App.data));
                 const a = document.createElement('a');
                 a.href = dataStr; a.download = "ev_backup.json"; a.click();
            });
        }
        const inpImport = document.getElementById('importBackup');
        if(inpImport) {
            inpImport.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if(!file) return;
                const reader = new FileReader();
                reader.onload = function(e) {
                    try { const imported = JSON.parse(e.target.result); if(imported.logs) App.data = imported; App.save(); location.reload(); } catch(err) { alert('Invalid JSON'); }
                };
                reader.readAsText(file);
            });
        }
    },

    bindCompare: function() {
        const btn = document.getElementById('btn-calc-trip');
        if(btn) {
            btn.addEventListener('click', () => {
                const dist = parseFloat(document.getElementById('cmp-dist').value);
                if(!dist) return;
                const evPrice = parseFloat(document.getElementById('price').value) || 0.56;
                const costEV = (dist / App.settings.evEff) * evPrice;
                const costICE = (dist / App.settings.iceMpg) * 4.54609 * App.settings.fuelPrice;
                const diff = costICE - costEV;
                const isCheaper = diff > 0;
                const resDiv = document.getElementById('compare-result');
                resDiv.innerHTML = `
                    <div style="background:#222; border-left: 4px solid ${isCheaper ? '#4CAF50' : '#f44336'}; padding:15px; margin-top:20px; border-radius:4px;">
                        <h4 style="margin:0 0 10px 0; color:#fff;">За ${dist} мили</h4>
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px; color:#ccc;">
                            <span>🔋 EV: <strong>£${costEV.toFixed(2)}</strong></span>
                            <span>⛽ ICE: <strong>£${costICE.toFixed(2)}</strong></span>
                        </div>
                        <div style="font-size:1.1em; font-weight:bold; color:${isCheaper ? '#4CAF50' : '#f44336'}">
                            ${isCheaper ? 'Спестяваш' : 'По-скъпо с'} £${Math.abs(diff).toFixed(2)}
                        </div>
                    </div>`;
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => { AppActions.init(); });
