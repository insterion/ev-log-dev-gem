/* app-actions.js - Event Listeners */

const AppActions = {
    init: function() {
        this.bindNav();
        this.bindLog();
        this.bindCosts();
        this.bindSettings();
        
        // Initial Render
        UILog.renderList(App.data.logs);
        this.renderCostsList();
        
        // Set default date to today
        document.getElementById('date').valueAsDate = new Date();
        document.getElementById('c_date').valueAsDate = new Date();
    },

    bindNav: function() {
        const tabs = document.querySelectorAll('.tabbtn');
        const sections = document.querySelectorAll('.tab');

        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active')); // CSS class .active { display: block }
                
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.add('active');
            });
        });
    },

    bindLog: function() {
        // 1. ADD ENTRY BUTTON
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

                App.addLog({
                    date, kwh, price, type, note,
                    total: kwh * price
                });

                UILog.renderList(App.data.logs);
                
                // Clear important fields
                document.getElementById('kwh').value = '';
                document.getElementById('note').value = '';
                document.getElementById('log-preview').innerHTML = ''; // Hide preview
            });
        }

        // 2. AUTO PRICE CHANGE
        document.getElementById('type').addEventListener('change', (e) => {
            const opt = e.target.options[e.target.selectedIndex];
            if (opt.dataset.price) {
                document.getElementById('price').value = opt.dataset.price;
                this.updatePreview(); // Recalculate preview
            }
        });

        // 3. REAL-TIME COMPARISON PREVIEW
        ['kwh', 'price'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updatePreview());
        });

        // 4. Same as last
        document.getElementById('sameAsLast').addEventListener('click', () => {
            if(App.data.logs.length > 0) {
                const last = App.data.logs[0];
                document.getElementById('price').value = last.price;
                document.getElementById('type').value = last.type;
                document.getElementById('note').value = last.note;
            }
        });
    },

    updatePreview: function() {
        const kwh = parseFloat(document.getElementById('kwh').value) || 0;
        const price = parseFloat(document.getElementById('price').value) || 0;
        
        // Взимаме настройките от App.settings
        const res = Calc.compare(
            kwh, 
            price, 
            parseFloat(App.settings.evEff), 
            parseFloat(App.settings.iceMpg), 
            parseFloat(App.settings.fuelPrice)
        );

        UILog.renderPreview(res);
    },
    
    deleteLogEntry: function(id) {
        if(confirm('Изтриване?')) {
            App.deleteLog(id);
            UILog.renderList(App.data.logs);
        }
    },

    // --- COSTS SECTION ---
    bindCosts: function() {
        document.getElementById('c_add').addEventListener('click', () => {
            const date = document.getElementById('c_date').value;
            const amount = parseFloat(document.getElementById('c_amount').value);
            const cat = document.getElementById('c_category').value;
            const note = document.getElementById('c_note').value;

            if(!amount || !date) return alert('Въведи сума и дата');

            App.addCost({ date, amount, cat, note });
            this.renderCostsList();
            
            document.getElementById('c_amount').value = '';
            document.getElementById('c_note').value = '';
        });
    },

    renderCostsList: function() {
        const div = document.getElementById('costTable');
        if(!div) return;
        let html = '';
        App.data.costs.forEach(c => {
            html += `<div style="border-bottom:1px solid #333; padding:10px 0; display:flex; justify-content:space-between;">
                <span>${c.date} <strong>${c.cat}</strong><br><small>${c.note}</small></span>
                <span>£${c.amount.toFixed(2)} <button onclick="AppActions.deleteCostEntry(${c.id})" style="color:red; border:none; background:none;">x</button></span>
            </div>`;
        });
        div.innerHTML = html || '<p style="color:#666">Няма разходи.</p>';
    },
    
    deleteCostEntry: function(id) {
        if(confirm('Delete cost?')) {
            App.deleteCost(id);
            this.renderCostsList();
        }
    },

    // --- SETTINGS SECTION ---
    bindSettings: function() {
        // Load settings into inputs
        const s = App.settings;
        if(document.getElementById('set_ev_eff')) document.getElementById('set_ev_eff').value = s.evEff;
        if(document.getElementById('set_ice_mpg')) document.getElementById('set_ice_mpg').value = s.iceMpg;
        if(document.getElementById('set_fuel_price')) document.getElementById('set_fuel_price').value = s.fuelPrice;

        // Save Button
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
        document.getElementById('exportBackup').addEventListener('click', () => {
             const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(App.data));
             const a = document.createElement('a');
             a.href = dataStr;
             a.download = "ev_backup.json";
             a.click();
        });
    }
};

// Start everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AppActions.init();
});
