/* main.js - Compact UI Version */

const App = {
    data: { logs: [], costs: [] },
    settings: { evEff: 3.0, iceMpg: 44, fuelPrice: 1.45 },
    
    init: function() {
        console.log("App Starting...");
        // 1. Load Data
        try {
            const d = localStorage.getItem('ev_log_data'); 
            if(d) this.data = JSON.parse(d);
            
            const s = localStorage.getItem('ev_log_settings'); 
            if(s) this.settings = JSON.parse(s);
        } catch(e) {
            console.error("Error loading data", e);
            this.data = { logs: [], costs: [] }; 
        }
        
        // Ensure arrays exist
        if(!this.data.logs) this.data.logs = [];
        if(!this.data.costs) this.data.costs = [];
        
        // 2. Start UI
        this.initUI();
    },

    save: function() {
        localStorage.setItem('ev_log_data', JSON.stringify(this.data));
        localStorage.setItem('ev_log_settings', JSON.stringify(this.settings));
    },

    addLog: function(entry) { 
        entry.id = Date.now(); 
        this.data.logs.unshift(entry); 
        this.save(); 
    },
    
    deleteLog: function(id) { 
        this.data.logs = this.data.logs.filter(i => i.id !== id); 
        this.save(); 
    },
    
    addCost: function(entry) { 
        entry.id = Date.now(); 
        this.data.costs.unshift(entry); 
        this.save(); 
    },
    
    deleteCost: function(id) { 
        this.data.costs = this.data.costs.filter(i => i.id !== id); 
        this.save(); 
    },

    // --- UI LOGIC ---
    initUI: function() {
        try {
            this.bindNav();
            this.bindLogForm();
            this.bindCostsForm();
            this.bindSettings();
            this.bindCompare();
            
            // Initial Render
            this.renderLogList();
            this.renderCostsList();
            this.updateStats();

            // Set Today's Date
            const today = new Date().toISOString().split('T')[0];
            const dateEl = document.getElementById('date');
            const cDateEl = document.getElementById('c_date');
            if(dateEl) dateEl.value = today;
            if(cDateEl) cDateEl.value = today;
            
        } catch (err) {
            console.error("UI Init Failed:", err);
        }
    },

    bindNav: function() {
        const tabs = document.querySelectorAll('.tabbtn');
        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tabbtn').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));
                btn.classList.add('active');
                const target = document.getElementById(btn.dataset.tab);
                if(target) {
                    target.classList.add('active');
                    if(btn.dataset.tab === 'compare') this.updateStats();
                    if(btn.dataset.tab === 'settings') this.loadSettingsToUI();
                }
            });
        });
    },

    // --- LOGGING ---
    bindLogForm: function() {
        const btnAdd = document.getElementById('addEntry');
        const typeSelect = document.getElementById('type');
        const priceInput = document.getElementById('price');
        const kwhInput = document.getElementById('kwh');
        
        if(!btnAdd || !typeSelect || !priceInput) return;

        const updatePrice = () => {
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
            this.updatePreview();
        };

        typeSelect.addEventListener('change', updatePrice);
        kwhInput.addEventListener('input', () => this.updatePreview());
        priceInput.addEventListener('input', () => this.updatePreview());
        
        updatePrice();

        btnAdd.addEventListener('click', () => {
            const date = document.getElementById('date').value;
            const kwh = parseFloat(kwhInput.value);
            const price = parseFloat(priceInput.value);
            const type = typeSelect.options[typeSelect.selectedIndex].text;
            const note = document.getElementById('note').value;

            if(!date || isNaN(kwh) || isNaN(price)) return alert('Моля попълнете всички полета!');

            this.addLog({ date, kwh, price, type, note, total: kwh * price });
            this.renderLogList();
            
            kwhInput.value = '';
            document.getElementById('note').value = '';
            document.getElementById('log-preview').style.display = 'none';
            this.updateStats();
        });
    },

    updatePreview: function() {
        const kwh = parseFloat(document.getElementById('kwh').value) || 0;
        const price = parseFloat(document.getElementById('price').value) || 0;
        const div = document.getElementById('log-preview');
        
        if(kwh <= 0 || price <= 0) { div.style.display = 'none'; return; }

        const range = kwh * this.settings.evEff;
        const costEV = kwh * price;
        const costICE = (range / this.settings.iceMpg) * 4.54609 * this.settings.fuelPrice;
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
    },

    // --- COMPACT RENDER LOGIC ---
    renderLogList: function() {
        const div = document.getElementById('logTable');
        if(!div) return;
        
        let html = '';
        this.data.logs.forEach(l => {
            const cost = l.total || (l.kwh * l.price);
            html += `
            <div class="log-entry">
                <div class="log-info">
                    <div class="log-main-row">
                        <span>${l.kwh} kWh</span>
                        <span class="cost-tag">£${cost.toFixed(2)}</span>
                    </div>
                    <div class="log-sub-row">
                        <span>${l.date}</span>
                        <span>•</span>
                        <span>${l.type}</span>
                    </div>
                    ${l.note ? `<div class="log-note">${l.note}</div>` : ''}
                </div>
                <button class="delete-btn" onclick="App.confirmDeleteLog(${l.id})">×</button>
            </div>`;
        });
        div.innerHTML = html || '<p style="text-align:center; color:#666; padding:20px;">Няма записи</p>';
    },
    
    confirmDeleteLog: function(id) {
        if(confirm('Изтриване?')) { this.deleteLog(id); this.renderLogList(); this.updateStats(); }
    },

    bindCostsForm: function() {
        const btn = document.getElementById('c_add');
        if(!btn) return;
        
        btn.addEventListener('click', () => {
            const date = document.getElementById('c_date').value;
            const amount = parseFloat(document.getElementById('c_amount').value);
            const cat = document.getElementById('c_category').value;
            const note = document.getElementById('c_note').value;
            const target = document.getElementById('c_target').value;

            if(!date || !amount) return alert('Въведи сума и дата');
            
            this.addCost({ date, amount, cat, note, target });
            this.renderCostsList();
            this.updateStats();
            
            document.getElementById('c_amount').value = '';
            document.getElementById('c_note').value = '';
        });
    },

    // --- COMPACT RENDER COSTS ---
    renderCostsList: function() {
        const div = document.getElementById('costTable');
        if(!div) return;
        
        let html = '';
        this.data.costs.forEach(c => {
            const isIce = c.target === 'ice';
            const icon = isIce ? '⛽' : '⚡';
            
            html += `
            <div class="log-entry" style="border-left: 3px solid ${isIce ? '#f44336' : '#4CAF50'}; padding-left:10px;">
                <div class="log-info">
                    <div class="log-main-row">
                        <span>£${parseFloat(c.amount).toFixed(2)}</span>
                        <span style="font-size:0.8em; font-weight:normal; color:#aaa;">${icon} ${c.cat}</span>
                    </div>
                    <div class="log-sub-row">
                        <span>${c.date}</span>
                    </div>
                    ${c.note ? `<div class="log-note">${c.note}</div>` : ''}
                </div>
                <button class="delete-btn" onclick="App.confirmDeleteCost(${c.id})">×</button>
            </div>`;
        });
        div.innerHTML = html || '<p style="text-align:center; color:#666; padding:20px;">Няма разходи</p>';
    },
    
    confirmDeleteCost: function(id) {
        if(confirm('Изтриване?')) { this.deleteCost(id); this.renderCostsList(); this.updateStats(); }
    },

    // --- STATS ---
    updateStats: function() {
        try {
            const div = document.getElementById('tco-dashboard');
            if(this.data.logs.length === 0 && this.data.costs.length === 0) { 
                if(div) div.style.display = 'none'; 
                return; 
            }
            if(div) div.style.display = 'block';

            let evCharge = 0, kwhTot = 0;
            this.data.logs.forEach(l => { evCharge += (l.total || l.kwh*l.price); kwhTot += parseFloat(l.kwh); });
            
            let evMaint = 0, iceMaint = 0;
            this.data.costs.forEach(c => {
                if(c.target === 'ice') iceMaint += parseFloat(c.amount);
                else evMaint += parseFloat(c.amount);
            });

            const miles = kwhTot * this.settings.evEff;
            const iceFuel = (miles / this.settings.iceMpg) * 4.54609 * this.settings.fuelPrice;
            
            const totalEV = evCharge + evMaint;
            const totalICE = iceFuel + iceMaint;
            const savings = totalICE - totalEV;

            const safeSetText = (id, txt) => { const e=document.getElementById(id); if(e) e.innerText=txt; };

            safeSetText('stat-miles', miles.toFixed(0));
            safeSetText('stat-ev-charge', '£'+evCharge.toFixed(2));
            safeSetText('stat-ev-maint', '£'+evMaint.toFixed(2));
            safeSetText('stat-ice-fuel', '£'+iceFuel.toFixed(2));
            safeSetText('stat-ice-maint', '£'+iceMaint.toFixed(2));

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
            
            if (typeof Chart !== 'undefined') {
                this.renderChart(this.data.logs, this.data.costs);
            }
        } catch(e) {
            console.error("Stats error", e);
        }
    },

    renderChart: function(logs, costs) {
        const ctx = document.getElementById('tcoChart');
        if(!ctx) return;
        
        let events = [];
        logs.forEach(l => events.push({ date: l.date, ev: (l.total||l.kwh*l.price), ice: (l.kwh*this.settings.evEff/this.settings.iceMpg)*4.54609*this.settings.fuelPrice }));
        costs.forEach(c => events.push({ date: c.date, ev: (c.target!=='ice'?parseFloat(c.amount):0), ice: (c.target==='ice'?parseFloat(c.amount):0) }));
        
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
                responsive: true, 
                maintainAspectRatio: false,
                scales: { x: { display: false }, y: { grid: { color: '#333' } } },
                plugins: { legend: { display: false } }
            }
        });
    },

    bindSettings: function() {
        this.loadSettingsToUI();

        const saveBtn = document.getElementById('saveCompareSettings');
        if(saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.settings.evEff = parseFloat(document.getElementById('set_ev_eff').value);
                this.settings.iceMpg = parseFloat(document.getElementById('set_ice_mpg').value);
                this.settings.fuelPrice = parseFloat(document.getElementById('set_fuel_price').value);
                this.save();
                this.updateStats();
                alert('Settings Saved');
            });
        }
        
        const backupBtn = document.getElementById('exportBackup');
        if(backupBtn) {
            backupBtn.addEventListener('click', () => {
                const a = document.createElement('a');
                a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data));
                a.download = "ev_backup.json"; a.click();
            });
        }
        
        const importBtn = document.getElementById('importBackup');
        if(importBtn) {
            importBtn.addEventListener('change', (e) => {
                const r = new FileReader();
                r.onload = (ev) => { try { this.data = JSON.parse(ev.target.result); this.save(); location.reload(); } catch(err){alert('Error parsing JSON');} };
                r.readAsText(e.target.files[0]);
            });
        }
    },
    
    loadSettingsToUI: function() {
        const s = this.settings;
        const setVal = (id, val) => { 
            const el = document.getElementById(id); 
            if(el) el.value = val; 
        };
        setVal('set_ev_eff', s.evEff); 
        setVal('set_ice_mpg', s.iceMpg); 
        setVal('set_fuel_price', s.fuelPrice);
    },

    bindCompare: function() {
        const btn = document.getElementById('btn-calc-trip');
        if(!btn) return;
        
        btn.addEventListener('click', () => {
            const dist = parseFloat(document.getElementById('cmp-dist').value);
            if(!dist) return;
            const evP = parseFloat(document.getElementById('price').value) || 0.56;
            const evC = (dist/this.settings.evEff)*evP;
            const iceC = (dist/this.settings.iceMpg)*4.54609*this.settings.fuelPrice;
            const diff = iceC - evC;
            document.getElementById('compare-result').innerHTML = `
                <div style="background:#222; padding:10px; margin-top:10px; border-radius:5px; border-left:4px solid ${diff>0?'#4CAF50':'#f44336'}">
                    <div>EV: £${evC.toFixed(2)} vs ICE: £${iceC.toFixed(2)}</div>
                    <div style="font-weight:bold; color:${diff>0?'#4CAF50':'#f44336'}">${diff>0?'Спестяваш':'Загуба'} £${Math.abs(diff).toFixed(2)}</div>
                </div>`;
        });
    }
};

window.onload = function() {
    App.init();
};
