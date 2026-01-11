/* ui-log.js - Rendering Log & Previews */

const UILog = {
    // Рендира таблицата с историята
    renderList: function(logs) {
        const container = document.getElementById('logTable');
        if (!container) return;

        if (logs.length === 0) {
            container.innerHTML = '<p style="color:#666; text-align:center;">Няма записи.</p>';
            return;
        }

        let html = '';
        logs.forEach(log => {
            html += `
            <div style="border-bottom:1px solid #333; padding:10px 0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:bold; color:#fff;">${log.kwh} kWh <span style="color:#aaa; font-weight:normal;">• £${log.total.toFixed(2)}</span></div>
                    <div style="font-size:0.85em; color:#888;">${log.date} • ${log.type}</div>
                    <div style="font-size:0.85em; color:#666;">${log.note || ''}</div>
                </div>
                <button onclick="AppActions.deleteLogEntry(${log.id})" style="background:none; border:none; color:#f44336; font-size:1.2em; cursor:pointer;">&times;</button>
            </div>`;
        });
        container.innerHTML = html;
    },

    // Рендира карето за сравнение (докато пишеш)
    renderPreview: function(calcResult) {
        const div = document.getElementById('log-preview');
        if (!div) return;

        if (!calcResult || calcResult.rangeMiles <= 0) {
            div.innerHTML = '';
            div.style.display = 'none';
            return;
        }

        const color = calcResult.isCheaper ? '#4CAF50' : '#f44336';
        const text = calcResult.isCheaper ? 'СПЕСТЯВАШ' : 'ЗАГУБА';

        div.style.display = 'block';
        div.innerHTML = `
            <div style="background: #1a1a1a; border: 1px solid ${color}; border-radius: 8px; padding: 10px; animation: fadeIn 0.3s;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9em; color:#ccc;">
                    <span>EV: <strong>£${calcResult.costEV.toFixed(2)}</strong></span>
                    <span>ICE: <strong>£${calcResult.costICE.toFixed(2)}</strong></span>
                </div>
                <div style="text-align:center;">
                    <span style="color:${color}; font-weight:bold; font-size:1.1em;">
                        ${text} £${Math.abs(calcResult.savings).toFixed(2)}
                    </span>
                    <div style="font-size:0.8em; color:#666; margin-top:2px;">
                        при пробег ~${calcResult.rangeMiles.toFixed(0)} mi
                    </div>
                </div>
            </div>
        `;
    }
};
