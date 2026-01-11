/* app-actions.js - FINAL VERSION */

const AppActions = {
    init: function() {
        this.bindNav();
        this.bindLog();
        this.bindCosts();
        this.bindSettings();
        this.bindCompare(); // <--- НОВО: Зареждаме логиката за сравнение
        
        // Render history
        if(typeof UILog !== 'undefined') {
            UILog.renderList(App.data.logs);
        }
        this.renderCostsList();

        // Default dates
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
                const targetSection = document.getElementById(targetId);
                if (targetSection) targetSection.classList.add('active');
            });
        });
    },

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
                    alert('Please fill Date, kWh and Price.');
                    return;
                }

                App.addLog({ date, kwh, price, type, note, total: kwh * price });
                UILog.renderList(App.data.logs);
                
                // Clear fields & hide preview
                document.getElementById('kwh').value = '';
                document.getElementById('note').value = '';
                document.getElementById('log-preview').style.display = 'none';
            });
        }

        // Live Preview Logic
        const inputs = ['kwh', 'price'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('input', () => this.updatePreview());
        });
        
        // Update price when dropdown changes
        document.getElementById('type').addEventListener('change', (e) => {
             const opt = e.target.options[e.target.selectedIndex];
             if(opt.dataset.price) {
                 document.getElementById('price').value = opt.dataset.price;
                 this.updatePreview();
             }
        });

        const btnSame = document.getElementById('sameAsLast');
        if(btnSame) {
            btnSame.addEventListener('click', () => {
                if(App.data.logs.length > 0) {
                    const last = App.data.logs[0];
                    document.getElementById('price').value = last.price;
                    document.getElementById('type').value = last.type;
                    document.getElementById('note').value = last.note;
                }
            });
        }
    },

    updatePreview: function() {
        const kwh = parseFloat(document.getElementById('kwh').value) || 0;
        const price = parseFloat(document.getElementById('price').value) || 0;
        
        if(typeof Calc !== 'undefined') {
            const res = Calc.compare(
                kwh, 
                price, 
                parseFloat(App.settings.evEff), 
                parseFloat(App.settings.iceMpg), 
                parseFloat(App.settings.fuelPrice)
            );
            UILog.renderPreview(res);
        }
    },
    
    deleteLogEntry: function(id) {
        if(confirm('Delete log?')) {
            App.deleteLog(id);
            UILog.renderList(App.data.logs);
        }
    },

    bindCosts: function() {
        const btnAddCost = document.getElementById('c_add');
        if(btnAddCost) {
            btnAddCost.addEventListener('click', () => {
                const date = document.getElementById('c_date').value;
                const amount = parseFloat(document.getElementById('c_amount').value);
                const cat = document.getElementById('c_category').value;
                const note = document.getElementById('c_note').value;

                if(!amount || !date) return alert('Enter amount and date');
                App.addCost({ date, amount, cat, note });
                this.renderCostsList();
                
                document.getElementById('c_amount').value = '';
                document.getElementById('c_note').value = '';
            });
        }
    },

    renderCostsList: function() {
        const div = document.getElementById('costTable');
        if(!div) return;
        let html = '';
        if(App.data.costs.length === 0) {
            div.innerHTML = '<p style="color:#666; font-size:0.9rem;">Няма записани разходи.</p>';
            return;
        }
        App.data.costs.forEach(c => {
            html += `<div style="border-bottom:1px solid #333; padding:10px 0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="color:#fff;">${c.date} • <strong>${c.cat}</strong></span><br>
                    <small style="color:#888;">${c.note}</small>
                </div>
                <div>
                    <span style="color:#fff; font-weight:bold; margin-right:10px;">£${c.amount.toFixed(2)}</span>
                    <button onclick="AppActions.deleteCostEntry(${c.id})" style="color:#d32f2f; border:none; background:none; font-size:1.2rem;">&times;</button>
                </div>
            </div>`;
        });
        div.innerHTML = html;
    },
    
    deleteCostEntry: function(id) {
        if(confirm('Delete cost?')) {
            App.deleteCost(id);
            this.renderCostsList();
        }
    },

    // --- НОВО: Логика за Compare таба ---
    bindCompare: function() {
        const btnCalc = document.getElementById('btn-calc-trip');
        if (btnCalc) {
            btnCalc.addEventListener('click', () => {
                const dist = parseFloat(document.getElementById('cmp-dist').value);
                if (!dist) { alert('Въведи мили'); return; }

                // Взимаме настройките
                const evEff = parseFloat(App.settings.evEff);
                const iceMpg = parseFloat(App.settings.iceMpg);
                const fuelPrice = parseFloat(App.settings.fuelPrice);
                
                // Взимаме текущата цена на тока от Log таба (или 0.56 по подразбиране)
                const evPrice = parseFloat(document.getElementById('price').value) || 0.56;

                // Сметки
                const kwhNeeded = dist / evEff;
                const costEV = kwhNeeded * evPrice;
                
                const gallons = dist / iceMpg;
                const liters = gallons * 4.54609;
                const costICE = liters * fuelPrice;
                
                const diff = costICE - costEV;
                const isCheaper = diff > 0;

                // Показване
                const resDiv = document.getElementById('compare-result');
                resDiv.innerHTML = `
                    <div style="background:#222; border-left: 4px solid ${isCheaper ? '#4CAF50' : '#f44336'}; padding:15px; margin-top:20px; border-radius:4px;">
                        <h4 style="margin:0 0 10px 0; color:#fff;">Резултат за ${dist} мили</h4>
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px; color:#ccc;">
                            <span>🔋 EV: <strong>£${costEV.toFixed(2)}</strong></span>
                            <span>⛽ ICE: <strong>£${costICE.toFixed(2)}</strong></span>
                        </div>
                        <div style="font-size:1.1em; font-weight:bold; color:${isCheaper ? '#4CAF50' : '#f44336'}">
                            ${isCheaper ? 'Спестяваш' : 'По-скъпо с'} £${Math.abs(diff).toFixed(2)}
                        </div>
                    </div>
                `;
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
                alert('Настройките са запазени!');
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
