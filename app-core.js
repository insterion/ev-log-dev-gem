const App = {
    data: { logs: [], costs: [] },
    settings: { evEff: 3.5, iceMpg: 40, fuelPrice: 1.45 },
    init: function() {
        const d = localStorage.getItem('ev_log_data'); if(d) try { this.data = JSON.parse(d); } catch(e){}
        const s = localStorage.getItem('ev_log_settings'); if(s) try { this.settings = JSON.parse(s); } catch(e){}
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
App.init();
