/* app-actions.js - Event Listeners & Logic */

let editModeId = null;       // За LOG (Зареждане)
let editCostModeId = null;   // НОВО: За COSTS (Разходи)

const AppActions = {
    init: function() {
        this.bindNav();
        this.bindLog();
        this.bindCosts();
        this.bindSettings();
        this.bindCompare();
        
        // Рендериране на списъците при старт
        if(typeof UILog !== 'undefined') UILog.renderList(App.data.logs);
        this.renderCostsList();

        // Слагаме днешна дата по подразбиране
        const today = new Date().toISOString().split('T')[0];
        if(document.getElementById('date')) document.getElementById('date').value = today;
        if(document.getElementById('c_date')) document.getElementById('c_date').value = today;
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

                // Обновяваме статистиката само ако сме в Compare таба
                if(targetId === 'compare') {
                    this.updateStats();
                }
            });
        });
    },

    // ================= LOG (ЗАРЕЖДАНЕ) LOGIC =================

    bindLog: function() {
        const btnAdd = document.getElementById('addEntry');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const date = document.getElementById('date').value;
                const kwh = parseFloat(document.getElementById('kwh').value);
                const price = parseFloat(document.getElementById('price').value);
                const type = document.getElementById('type').value;
                const note = document.getElementById('note').value;

                if (!date || isNaN(kwh) || isNaN(price)) {
                    alert('Моля попълнете Дата, kWh и Цена.');
                    return;
                }

                if (editModeId) {
                    // UPDATE LOGIC
                    const index = App.data.logs.findIndex(l => l.id === editModeId);
                    if (index !== -1) {
                        App.data.logs[index] = { id: editModeId, date, kwh, price, type, note, total: kwh * price };
                        App.save();
                    }
                    editModeId = null;
                    btnAdd.innerText = "Add Entry";
                    btnAdd.style.backgroundColor = ""; 
                } else {
                    // ADD LOGIC
                    App.addLog({ date, kwh, price, type, note, total: kwh * price });
                }

                UILog.renderList(App.data.logs);
                this.clearLogForm();
            });
        }

        ['kwh', 'price'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updatePreview());
        });
        
        document.getElementById('type').addEventListener('change', (e) => {
             const opt = e.target.options[e.target.selectedIndex];
             if(opt.dataset.price) {
                 document.getElementById('price').value = opt.dataset.price;
                 this.updatePreview();
             }
        });

        document.getElementById('sameAsLast').addEventListener('click', () => {
            if(App.data.logs.length > 0) {
                const last = App.data.logs[0];
                document.getElementById('price').value = last.price;
                document.getElementById('type').value = last.type;
                document.getElementById('note').value = last.note;
                this.updatePreview();
            }
        });
    },

    updatePreview: function() {
        const kwh = parseFloat(document.getElementById('kwh').value) || 0;
        const price = parseFloat(document.getElementById('price').value) || 0;
        
        if(typeof Calc !== 'undefined') {
            const res = Calc.compare(
                kwh, price, 
                parseFloat(App.settings.evEff), 
                parseFloat(App.settings.iceMpg), 
                parseFloat(App.settings.fuelPrice)
            );
            UILog.renderPreview(res);
        }
    },

    editLogEntry: function(id) {
        const entry = App.data.logs.find(l => l.id === id);
        if(!entry) return;
        
        document.getElementById('date').value = entry.date;
        document.getElementById('kwh').value = entry.kwh;
        document.getElementById('price').value = entry.price;
        document.getElementById('type').value = entry.type;
        document.getElementById('note').value = entry.note;

        document.getElementById('log').scrollIntoView({behavior: 'smooth'});

        editModeId = id;
        const btn = document.getElementById('addEntry');
        btn.innerText = "Update Entry";
        btn.style.backgroundColor = "#ff9800";
        this.updatePreview();
    },
    
    deleteLogEntry: function(id) {
        if(confirm('Delete log?')) {
            App.deleteLog(id);
            UILog.renderList(App.data.logs);
            if(editModeId === id) this.clearLogForm();
        }
    },

    clearLogForm: function() {
        document.getElementById('kwh').value = '';
        document.getElementById('note').value = '';
        document.getElementById('log-preview').style.display = 'none';
        editModeId = null;
        const btn = document.getElementById('addEntry');
        btn.innerText = "Add Entry";
        btn.style.backgroundColor = ""; 
    },

    // ================= COSTS (РАЗХОДИ) LOGIC =================

    bindCosts: function() {
        const btn = document.getElementById('c_add');
        if(btn) {
            btn.addEventListener('click', () => {
                const date = document.getElementById('c_date').value;
                const amount = parseFloat(document.getElementById('c_amount').value);
                const cat = document.getElementById('c_category').value;
                const note = document.getElementById('c_note').value;
                
                if(!amount || !date) return alert('Enter amount and date');

                if (editCostModeId) {
                    // UPDATE COST
                    const index = App.data.costs.findIndex(c => c.id === editCostModeId);
                    if (index !== -1) {
                        App.data.costs[index] = { id: editCostModeId, date, amount, cat, note };
                        App.save();
                    }
                    editCostModeId = null;
                    btn.innerText = "Add Cost";
                    btn.style.backgroundColor = "";
                } else {
                    // ADD COST
                    App.addCost({ date, amount, cat, note });
                }

                this.renderCostsList();
                this.clearCostForm();
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
                html += `<div class="log-entry">
                    <div class="log-info">
                        <span style="color:#fff;">${c.date} • <strong>${c.cat}</strong></span><br>
                        <small style="color:#888;">${c.note}</small>
                    </div>
                    <div>
                        <span style="color:#fff; font-weight:bold; margin-right:10px;">£${c.amount.toFixed(2)}</span>
                    </div>
                    <div class="log-actions">
                        <button onclick="AppActions.editCostEntry(${c.id})" class="btn-icon edit">✎</button>
                        <button onclick="AppActions.deleteCostEntry(${c.id})" class="btn-icon delete">✖</button>
                    </div>
                </div>`;
            });
            div.innerHTML = html;
        }
    },

    // НОВО: Функция за зареждане на данните за редакция
    editCostEntry: function(id) {
        const entry = App.data.costs.find(c => c.id === id);
        if(!entry) return;

        document.getElementById('c_date').value = entry.date;
        document.getElementById('c_amount').value = entry.amount;
        document.getElementById('c_category').value = entry.cat;
        document.getElementById('c_note').value = entry.note;

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
            if(editCostModeId === id) this.clearCostForm();
        }
    },

    clearCostForm: function() {
        document.getElementById('c_amount').value = '';
        document.getElementById('c_note').value = '';
        editCostModeId = null;
        const btn = document.getElementById('c_add');
        btn.innerText = "Add Cost";
        btn.style.backgroundColor = "";
    },

    // ================= COMPARE & STATS LOGIC =================

    updateStats: function() {
        const dashboard = document.getElementById('tco-dashboard');
        
        if (App.data.logs.length === 0) {
            dashboard.style.display = 'none';
            return;
        }
        dashboard.style.display = 'block';

        const stats = Calc.calculateTCO(App.data.logs, App.data.costs, App.settings);

        document.getElementById('stat-miles').innerText = stats.totalMiles.toFixed(0) + ' mi';
        document.getElementById('stat-ev-charge').innerText = '£' + stats.totalEvChargingCost.toFixed(2);
        document.getElementById('stat-ev-maint').innerText = '£' + stats.totalMaintenance.toFixed(2);
        document.getElementById('stat-ice-fuel').innerText = '£' + stats.totalIceFuelCost.toFixed(2);

        const card = document.getElementById('tco-card');
        const isPositive = stats.netBalance >= 0;
        const color = isPositive ? '#4CAF50' : '#f44336';
        
        card.style.border = `2px solid ${color}`;
        card.innerHTML = `
            <div style="font-size:0.9rem; color:#ccc;">Нетен резултат (Fuel Savings - EV Maint)</div>
            <div style="font-size:1.8rem; font-weight:bold; color:${color}; margin:10px 0;">
                ${isPositive ? '+' : ''}£${stats.netBalance.toFixed(2)}
            </div>
            <div style="font-size:0.8rem; color:#888;">
                Спестеното от гориво (${stats.fuelSavings.toFixed(0)}) 
                ${isPositive ? 'покрива' : 'НЕ покрива'} поддръжката (${stats.totalMaintenance.toFixed(0)})
            </div>
        `;
    },

    bindCompare: function() {
        const btn = document.getElementById('btn-calc-trip');
        if(btn) {
            btn.addEventListener('click', () => {
                const dist = parseFloat(document.getElementById('cmp-dist').value);
                if(!dist) return;
                
                const evEff = parseFloat(App.settings.evEff);
                const iceMpg = parseFloat(App.settings.iceMpg);
                const fuelPrice = parseFloat(App.settings.fuelPrice);
                const evPrice = parseFloat(document.getElementById('price').value) || 0.56;

                const costEV = (dist / evEff) * evPrice;
                const costICE = (dist / iceMpg) * 4.54609 * fuelPrice;
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
                alert('Saved!');
            });
        }
        
        const btnExport = document.getElementById('exportBackup');
        if(btnExport) {
            btnExport.addEventListener('click', () => {
                 const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(App.data));
                 const a = document.createElement('a');
                 a.href = dataStr;
                 a.download = "ev_backup.json";
                 a.click();
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AppActions.init();
});
