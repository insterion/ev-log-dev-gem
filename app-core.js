/* app-core.js - State Management */
const App = {
    data: {
        logs: [],
        costs: []
    },
    settings: {
        evEff: 3.0,
        iceMpg: 44,
        fuelPrice: 1.45 // £/Liter
    },

    init: function() {
        this.load();
    },

    load: function() {
        const d = localStorage.getItem('ev_log_data');
        const s = localStorage.getItem('ev_log_settings');
        if (d) this.data = JSON.parse(d);
        if (s) this.settings = JSON.parse(s);
    },

    save: function() {
        localStorage.setItem('ev_log_data', JSON.stringify(this.data));
        localStorage.setItem('ev_log_settings', JSON.stringify(this.settings));
    },

    addLog: function(entry) {
        // Добавя ID и timestamp
        entry.id = Date.now();
        this.data.logs.unshift(entry); // Най-новите отгоре
        this.save();
    },

    addCost: function(entry) {
        entry.id = Date.now();
        this.data.costs.unshift(entry);
        this.save();
    },

    deleteLog: function(id) {
        this.data.logs = this.data.logs.filter(l => l.id !== id);
        this.save();
    },
    
    deleteCost: function(id) {
        this.data.costs = this.data.costs.filter(c => c.id !== id);
        this.save();
    }
};

// Initialize immediately
App.init();
