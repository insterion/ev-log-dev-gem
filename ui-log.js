const UILog = {
    renderList: function(logs) {
        const container = document.getElementById('logTable'); if (!container) return;
        if (!logs || logs.length === 0) { container.innerHTML = '<p style="color:#666; text-align:center;">Няма записи.</p>'; return; }
        let html = '';
        logs.forEach(log => {
            const totalCost = (log.total !== undefined) ? log.total : (log.kwh * log.price);
            html += `<div class="log-entry"><div class="log-info"><div class="log-main"><span class="log-kwh">${log.kwh} kWh</span><span class="log-cost">£${totalCost.toFixed(2)}</span></div><div class="log-sub">${log.date} • ${log.type}</div><div class="log-note">${log.note || ''}</div></div><div class="log-actions"><button onclick="AppActions.editLogEntry(${log.id})" class="btn-icon edit">✎</button><button onclick="AppActions.deleteLogEntry(${log.id})" class="btn-icon delete">✖</button></div></div>`;
        });
        container.innerHTML = html;
    },
    renderPreview: function(calcResult) {
        const div = document.getElementById('log-preview'); if (!div) return;
        if (!calcResult || calcResult.rangeMiles <= 0) { div.style.display = 'none'; return; }
        const color = calcResult.isCheaper ? '#4CAF50' : '#f44336'; const text = calcResult.isCheaper ? 'СПЕСТЯВАШ' : 'ЗАГУБА';
        div.style.display = 'block';
        div.innerHTML = `<div style="background: #1a1a1a; border: 1px solid ${color}; border-radius: 8px; padding: 10px; animation: fadeIn 0.3s;"><div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9em; color:#ccc;"><span>⚡ EV: <strong>£${calcResult.costEV.toFixed(2)}</strong></span><span>⛽ ICE: <strong>£${calcResult.costICE.toFixed(2)}</strong></span></div><div style="text-align:center; border-top:1px solid #333; padding-top:5px; margin-top:5px;"><span style="color:${color}; font-weight:bold; font-size:1.1em;">${text} £${Math.abs(calcResult.savings).toFixed(2)}</span><div style="font-size:0.8em; color:#666;">при пробег ~${calcResult.rangeMiles.toFixed(0)} mi</div></div></div>`;
    }
};
