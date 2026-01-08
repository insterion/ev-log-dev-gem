/* * ui-compare.js
 * Handles the User Interface for the Comparison Tab
 * Dependencies: calc.js
 */

const UICompare = {
    // Кеширани DOM елементи
    elements: {
        inputKwh: document.getElementById('input-load-kwh'), // Твоето поле за kWh
        // Приемам, че тези полета съществуват. Ако не - кодът ще ползва defaults.
        inputPriceKwh: document.getElementById('price-kwh'), 
        inputPriceFuel: document.getElementById('price-fuel'),
        resultContainer: document.getElementById('compare-results') 
    },

    // Конфигурация за сравнението
    config: {
        evEfficiency: 4.0, // mi/kWh
        iceMpg: 44.0       // MPG
    },

    init: function() {
        console.log('UI Compare Initialized');
        
        // Ако контейнерът за резултати липсва, създаваме го динамично
        if (!this.elements.resultContainer) {
            const container = document.createElement('div');
            container.id = 'compare-results';
            container.style.marginTop = '20px';
            // Добавяме го след инпута за kWh (или където е подходящо в твоя HTML)
            if(this.elements.inputKwh) {
                this.elements.inputKwh.parentNode.appendChild(container);
            }
            this.elements.resultContainer = container;
        }

        this.addEventListeners();
    },

    addEventListeners: function() {
        // Слушаме за промяна във въведените kWh
        if (this.elements.inputKwh) {
            this.elements.inputKwh.addEventListener('input', () => this.updateDisplay());
        }
        
        // Слушаме и за промяна в цените (ако полетата съществуват)
        if (this.elements.inputPriceKwh) {
            this.elements.inputPriceKwh.addEventListener('input', () => this.updateDisplay());
        }
        if (this.elements.inputPriceFuel) {
            this.elements.inputPriceFuel.addEventListener('input', () => this.updateDisplay());
        }
    },

    getInputs: function() {
        // Взимаме стойностите или ползваме защитни такива (0 или стандартни цени)
        const kwh = parseFloat(this.elements.inputKwh ? this.elements.inputKwh.value : 0) || 0;
        
        // Опитваме да вземем цените от полетата, ако ги няма - слагаме примерни
        const priceKwh = this.elements.inputPriceKwh ? parseFloat(this.elements.inputPriceKwh.value) : 0.25; 
        const priceFuel = this.elements.inputPriceFuel ? parseFloat(this.elements.inputPriceFuel.value) : 6.50; // Примерна цена за галон (UK/US)

        return { kwh, priceKwh, priceFuel };
    },

    updateDisplay: function() {
        const data = this.getInputs();

        // 1. Изчисляваме колко мили можем да минем с този ток
        const estimatedMiles = Calc.getEstimatedRange(data.kwh, this.config.evEfficiency);

        // 2. Изчисляваме разходите
        const costEV = Calc.getEvCost(data.kwh, data.priceKwh);
        const costICE = Calc.getIceCost(estimatedMiles, this.config.iceMpg, data.priceFuel);

        // 3. Сравняваме
        const comparison = Calc.compare(costEV, costICE);

        // 4. Рендираме (Визуализация)
        this.render(estimatedMiles, costEV, costICE, comparison);
    },

    render: function(miles, costEV, costICE, comparison) {
        const container = this.elements.resultContainer;
        
        if (miles <= 0) {
            container.innerHTML = '<p style="color:#888; text-align:center;">Въведете kWh за изчисление...</p>';
            return;
        }

        // Форматиране на валутата (може да го смениш на 'BGN' или 'GBP')
        const fmt = (num) => num.toFixed(2);

        // HTML шаблон за "по-добрия вид"
        container.innerHTML = `
            <div style="background: #1e1e1e; color: #fff; padding: 15px; border-radius: 12px; font-family: sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                
                <h3 style="margin-top:0; border-bottom: 1px solid #444; padding-bottom: 10px;">
                    Прогноза: <span style="color: #4CAF50;">${miles.toFixed(1)} мили</span>
                </h3>
                
                <div style="margin-bottom: 15px;">
                    <div style="display:flex; justify-content:space-between; font-size: 0.9em; margin-bottom: 5px;">
                        <span>⚡ EV Цена</span>
                        <strong>${fmt(costEV)}</strong>
                    </div>
                    <div style="background: #333; height: 10px; border-radius: 5px; overflow: hidden;">
                        <div style="width: 100%; background: #4CAF50; height: 100%;"></div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <div style="display:flex; justify-content:space-between; font-size: 0.9em; margin-bottom: 5px;">
                        <span>⛽ ICE Цена (${this.config.iceMpg} mpg)</span>
                        <strong>${fmt(costICE)}</strong>
                    </div>
                    <div style="background: #333; height: 10px; border-radius: 5px; overflow: hidden;">
                        <div style="width: ${Math.min((costICE / costEV) * 100, 100)}%; background: #FF5722; height: 100%;"></div>
                    </div>
                </div>

                <div style="text-align: center; padding: 10px; background: ${comparison.isCheaper ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 87, 34, 0.2)'}; border-radius: 8px;">
                    ${comparison.isCheaper 
                        ? `✅ Спестяваш: <strong>${fmt(comparison.savings)}</strong>` 
                        : `❌ По-скъпо с: <strong>${fmt(Math.abs(comparison.savings))}</strong>`}
                </div>

            </div>
        `;
    }
};

// Стартираме скрипта, когато страницата зареди
document.addEventListener('DOMContentLoaded', () => {
    UICompare.init();
});
