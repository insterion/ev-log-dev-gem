/* file: ui-compare.js */
const UICompare = {
    // Връзка с елементите от HTML (ще ги създадем динамично, ако липсват, или ще ползваме наличните)
    id: 'view-compare',
    
    // Тук пазим настройките локално в браузъра
    state: {
        efficiency: 3.0,
        mpg: 44.0,
        priceKwh: 0.56, // Взех го от твоята снимка
        priceFuel: 6.50 // £/gallon
    },

    init: function() {
        this.loadState();
        this.render();
    },

    loadState: function() {
        const saved = localStorage.getItem('ev_compare_settings');
        if (saved) {
            this.state = { ...this.state, ...JSON.parse(saved) };
        }
    },

    saveState: function() {
        localStorage.setItem('ev_compare_settings', JSON.stringify(this.state));
    },

    updateState: function(key, value) {
        this.state[key] = parseFloat(value);
        this.saveState();
        this.calculate(); // Автоматично преизчисляване при промяна
    },

    // Основна функция за рисуване на екрана
    render: function() {
        const container = document.getElementById('compare-container') || document.getElementById('app-content');
        if (!container) return; // Защита

        // Използвам CSS класове, които вероятно вече имаш (form-group, form-control, btn)
        // Но добавям и inline стилове, за да съм сигурен, че ще изглежда добре
        container.innerHTML = `
            <div class="view-compare" style="padding: 15px; max-width: 600px; margin: 0 auto;">
                
                <div class="card" style="background: #1e1e1e; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <h3 style="margin-top:0; color:#eee;">Данни за сравнение</h3>
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display:block; color:#aaa; margin-bottom:5px;">Заредени kWh</label>
                        <input type="number" id="cmp-kwh" class="form-control" placeholder="40" 
                               style="width:100%; padding:12px; background:#000; border:1px solid #333; color:#fff; border-radius:8px; box-sizing:border-box;">
                    </div>

                    <div style="display:flex; gap:10px; margin-bottom: 15px;">
                        <div style="flex:1;">
                            <label style="display:block; color:#aaa; font-size:0.9em;">Ефективност (mi/kWh)</label>
                            <input type="number" id="cmp-eff" value="${this.state.efficiency}" step="0.1" 
                                   style="width:100%; padding:10px; background:#000; border:1px solid #333; color:#fff; border-radius:8px; box-sizing:border-box;">
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; color:#aaa; font-size:0.9em;">ДВГ Разход (MPG)</label>
                            <input type="number" id="cmp-mpg" value="${this.state.mpg}" step="1" 
                                   style="width:100%; padding:10px; background:#000; border:1px solid #333; color:#fff; border-radius:8px; box-sizing:border-box;">
                        </div>
                    </div>

                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="display:block; color:#aaa; font-size:0.9em;">Ток (£/kWh)</label>
                            <input type="number" id="cmp-p-el" value="${this.state.priceKwh}" step="0.01" 
                                   style="width:100%; padding:10px; background:#000; border:1px solid #333; color:#fff; border-radius:8px; box-sizing:border-box;">
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; color:#aaa; font-size:0.9em;">Гориво (£/Gal)</label>
                            <input type="number" id="cmp-p-fuel" value="${this.state.priceFuel}" step="0.01" 
                                   style="width:100%; padding:10px; background:#000; border:1px solid #333; color:#fff; border-radius:8px; box-sizing:border-box;">
                        </div>
                    </div>
                </div>

                <button id="btn-calc" style="width:100%; padding:15px; background:#2E7D32; color:white; border:none; border-radius:25px; font-size:1.1em; font-weight:bold; margin-bottom:20px; cursor:pointer;">
                    Изчисли
                </button>

                <div id="cmp-results" style="display:none; animation: fadeIn 0.5s;">
                    </div>

            </div>
        `;

        this.addEvents();
    },

    addEvents: function() {
        // Закачаме слушатели за промяна на настройките
        document.getElementById('cmp-eff').addEventListener('input', (e) => this.updateState('efficiency', e.target.value));
        document.getElementById('cmp-mpg').addEventListener('input', (e) => this.updateState('mpg', e.target.value));
        document.getElementById('cmp-p-el').addEventListener('input', (e) => this.updateState('priceKwh', e.target.value));
        document.getElementById('cmp-p-fuel').addEventListener('input', (e) => this.updateState('priceFuel', e.target.value));

        // Основен бутон
        document.getElementById('btn-calc').addEventListener('click', () => this.calculate());
        
        // Enter key на полето за kWh също стартира
        document.getElementById('cmp-kwh').addEventListener('keyup', (e) => {
            if(e.key === 'Enter') this.calculate();
        });
    },

    calculate: function() {
        const kwh = parseFloat(document.getElementById('cmp-kwh').value);
        if (!kwh || kwh <= 0) return; // Не правим нищо ако няма вход

        const results = Calc.analyze(
            kwh,
            this.state.efficiency,
            this.state.priceKwh,
            this.state.mpg,
            this.state.priceFuel
        );

        this.renderResults(results);
    },

    renderResults: function(data) {
        const resDiv = document.getElementById('cmp-results');
        resDiv.style.display = 'block';

        const fmtMoney = (n) => '£' + n.toFixed(2);
        const fmtDist = (n) => n.toFixed(1) + ' mi';

        // Определяме цвят за резултата
        const resultColor = data.diff.isCheaper ? '#4CAF50' : '#F44336'; // Зелено или Червено
        const resultText = data.diff.isCheaper ? 'СПЕСТЯВАШ' : 'ЗАГУБА';

        resDiv.innerHTML = `
            <div style="background: #1e1e1e; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #333; text-align: center;">
                <div style="color: #aaa; font-size: 0.9em; margin-bottom: 5px;">ПРОГНОЗЕН ПРОБЕГ</div>
                <div style="font-size: 2.5em; font-weight: bold; color: #fff;">${fmtDist(data.rangeMiles)}</div>
                
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333; display: flex; justify-content: space-around;">
                    <div>
                        <div style="color: #4CAF50; font-weight: bold;">EV ЦЕНА</div>
                        <div style="font-size: 1.4em;">${fmtMoney(data.ev.totalCost)}</div>
                        <div style="font-size: 0.7em; color: #888;">${(data.ev.costPerMile*100).toFixed(1)}p / mi</div>
                    </div>
                    <div style="border-left: 1px solid #333;"></div>
                    <div>
                        <div style="color: #FF9800; font-weight: bold;">ICE ЦЕНА</div>
                        <div style="font-size: 1.4em;">${fmtMoney(data.ice.totalCost)}</div>
                        <div style="font-size: 0.7em; color: #888;">${(data.ice.costPerMile*100).toFixed(1)}p / mi</div>
                    </div>
                </div>
            </div>

            <div style="background: ${resultColor}22; border: 1px solid ${resultColor}; border-radius: 10px; padding: 15px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <span style="display:block; font-size:0.8em; color:${resultColor}; font-weight:bold;">${resultText}</span>
                    <span style="font-size:1.5em; font-weight:bold; color:#fff;">${fmtMoney(Math.abs(data.diff.value))}</span>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:1.2em; color:#fff; font-weight:bold;">${Math.abs(data.diff.percent).toFixed(0)}%</span>
                    <span style="display:block; font-size:0.8em; color:#aaa;">разлика</span>
                </div>
            </div>
            
            <div style="text-align:center; margin-top:10px; color:#666; font-size:0.8em;">
                Сравнение при ${this.state.mpg} MPG и ${this.state.priceFuel} £/gal
            </div>
        `;
    }
};
