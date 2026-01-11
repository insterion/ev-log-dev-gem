/* app-actions.js - Event Listeners */

const AppActions = {
    init: function() {
        console.log("AppActions init...");
        this.bindNav();      // <-- Това оправя табовете
        this.bindLog();
        this.bindCosts();
        this.bindSettings();
        
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

    // --- ЛОГИКА ЗА ТАБОВЕТЕ ---
    bindNav: function() {
        const tabs = document.querySelectorAll('.tabbtn');
        const sections = document.querySelectorAll('.tab');

        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                // 1. Махаме active от всички бутони и секции
                tabs.forEach(t => t.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));
                
                // 2. Слагаме active на натиснатия бутон
                btn.classList.add('active');
                
                // 3. Намираме съответната секция по data-tab и я показваме
                const targetId = btn.getAttribute('data-tab');
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.classList.add('active');
                }
            });
        });
    },

    bindLog: function() {
        // Add Entry
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
                
                // Clear fields
                document.getElementById('kwh').value = '';
                document.getElementById('note').value = '';
                document.getElementById('log-preview').style.display = 'none';
            });
        }

        // Auto Price fill
        const typeSelect = document.getElementById('type');
        if(typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                const opt = e.target.options[e.target.selectedIndex];
                if (opt.dataset.price) {
                    document.getElementById('price').value = opt.dataset.price;
                    this.updatePreview();
                }
            });
        }

        // Live Preview
        const inputs = ['kwh', 'price'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('input', () => this.updatePreview());
        });

        // Same as last
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

    bindSettings: function() {
        // Load Settings
        if(document.getElementById('set_ev_eff')) document.getElementById('set_ev_eff').value = App.settings.evEff;
        if(document.getElementById('set_ice_mpg')) document.getElementById('set_ice_mpg').value = App.settings.iceMpg;
        if(document.getElementById('set_fuel_price')) document.getElementById('set_fuel_price').value = App.settings.fuelPrice;

        // Save
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
        
        // Export
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

// Start
document.addEventListener('DOMContentLoaded', () => {
    AppActions.init();
});
