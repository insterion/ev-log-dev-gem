/* app-core.js - Data & Storage Management */

const App = {
    data: {
        logs: [],   // История на зареждане
        costs: []   // История на разходи
    },
    settings: {
        evEff: 3.5,     // Miles per kWh
        iceMpg: 40,     // Miles per Gallon
        fuelPrice: 1.45 // GBP per Liter
    },
    
    // Зареждане при старт
    init: function() {
        const savedData = localStorage.getItem('ev_log_data');
        if (savedData) {
            try {
                this.data = JSON.parse(savedData);
            } catch (e) {
                console.error('Error parsing data', e);
            }
        }

        const savedSettings = localStorage.getItem('ev_log_settings');
        if (savedSettings) {
            try {
                this.settings = JSON.parse(savedSettings);
            } catch (e) { console.error(e); }
        }
    },

    save: function() {
        localStorage.setItem('ev_log_data', JSON.stringify(this.data));
        localStorage.setItem('ev_log_settings', JSON.stringify(this.settings));
    },

    // --- LOG METHODS ---
    addLog: function(entry) {
        entry.id = Date.now(); // Unique ID based on timestamp
        this.data.logs.unshift(entry); // Add to top
        this.save();
    },

    deleteLog: function(id) {
        this.data.logs = this.data.logs.filter(item => item.id !== id);
        this.save();
    },

    // --- COST METHODS ---
    addCost: function(entry) {
        entry.id = Date.now();
        this.data.costs.unshift(entry);
        this.save();
    },

    deleteCost: function(id) {
        this.data.costs = this.data.costs.filter(item => item.id !== id);
        this.save();
    }
};

// Initialize immediately
App.init();
