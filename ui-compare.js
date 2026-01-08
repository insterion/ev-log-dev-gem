/* * ui-compare.js
 * Updated: Dynamic Efficiency Input
 */

const UICompare = {
    elements: {
        inputKwh: document.getElementById('input-load-kwh'),
        inputEfficiency: document.getElementById('input-efficiency'), // Новото поле
        
        // Приемаме, че тези съществуват или ще бъдат добавени
        inputPriceKwh: document.getElementById('price-kwh'), 
        inputPriceFuel: document.getElementById('price-fuel'),
        
        resultContainer: document.getElementById('compare-results') 
    },

    // Стандартни стойности, ако полетата са празни
    defaults: {
        efficiency: 3.0, // Твоето желание за default
        iceMpg: 44.0,
        priceKwh: 0.25,  // Примерна цена
        priceFuel: 6.50  // Примерна цена
    },

    init: function() {
        // Създаваме контейнер за резултати, ако го няма
        if (!this.elements.resultContainer) {
            const container = document.createElement('div');
            container.id = 'compare-results';
            container.style.marginTop = '20px';
            // Добавяме го след последното налично поле
            const parent = this.elements.inputKwh ? this.elements.inputKwh.parentNode : document.body;
            parent.appendChild(container);
            this.elements.resultContainer = container;
        }

        this.addEventListeners();
        // Първоначално изчисление при зареждане
        this.updateDisplay();
    },

    addEventListeners: function() {
        // Закачаме слушатели към всички възможни полета
        const inputs = [
            this.elements.inputKwh, 
            this.elements.inputEfficiency, 
            this.elements.inputPriceKwh, 
            this.elements.inputPriceFuel
        ];

        inputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.updateDisplay());
            }
        });
    },

    getInputs: function() {
        // Взимаме стойностите от полетата или ползваме defaults
        return {
            kwh: parseFloat(this.elements.inputKwh?.value) || 0,
            eff: parseFloat(this.elements.inputEfficiency?.value) || this.defaults.efficiency,
            mpg: this.defaults.iceMpg, // Може и това да стане динамично по-късно
            
            priceKwh: parseFloat(this.elements.inputPriceKwh?.value) || this.defaults.priceKwh,
            priceFuel: parseFloat(this.elements.inputPriceFuel?.value) || this.defaults.priceFuel
        };
    },

    updateDisplay: function() {
        const data = this.getInputs();

        // 1. Колко мили минаваме с тези kWh при тази ефективност?
        const estimatedMiles = Calc.getEstimatedRange(data.kwh, data.eff);

        // 2. Смятаме парите
        const costEV = Calc.getEvCost(data.kwh, data.priceKwh);
        const costICE = Calc.getIceCost(estimatedMiles, data.mpg, data.priceFuel);

        // 3. Сравняваме
        const comparison = Calc.compare(costEV, costICE);

        // 4. Рисуваме
        this.render(estimatedMiles, costEV, costICE, comparison, data);
    },

    render: function(miles, costEV, costICE, comparison, inputs) {
        const container = this.elements.resultContainer;
        
        if (miles <= 0) {
            container.innerHTML = '<div style="text-align:center; color:#ccc; padding:10px;">Въведи kWh...</div>';
            return;
        }

        const fmt = (num) => num.toFixed(2);

        container.innerHTML = `
            <div style="background: #222; color: #eee; padding: 20px; border-radius: 16px; font-family: sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                
                <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #444; padding-bottom: 10px;">
                    <span style="font-size: 0.9em; color: #aaa;">Прогнозен пробег</span><br>
                    <span style="font-size: 1.8em; font-weight: bold; color: #fff;">${miles.toFixed(1)} <small>mi</small></span>
                    <div style="font-size: 0.8em; color: #666; margin-top: 4px;">при ${inputs.eff} mi/kWh</div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 5px;">
                        <span style="color: #4CAF50; font-weight:bold;">⚡ EV Разход</span>
                        <span style="font-size: 1.2em;">${fmt(costEV)}</span>
                    </div>
                    <div style="background: #444; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="width: 100%; background: #4CAF50; height: 100%;"></div>
                    </div>
                </div>

                <div style="margin-bottom: 25px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 5px;">
                        <span style="color: #FF5722; font-weight:bold;">⛽ ДВГ Еквивалент</span>
                        <span style="font-size: 1.2em;">${fmt(costICE)}</span>
                    </div>
                    <div style="background: #444; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${Math.min((costICE / costEV) * 100, 100)}%; background: #FF5722; height: 100%;"></div>
                    </div>
                    <div style="text-align: right; font-size: 0.75em; color: #888; margin-top: 2px;">
                        при ${inputs.mpg} mpg
                    </div>
                </div>

                <div style="background: ${comparison.isCheaper ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 87, 34, 0.15)'}; 
                            border: 1px solid ${comparison.isCheaper ? '#4CAF50' : '#FF5722'};
                            padding: 12px; border-radius: 10px; text-align: center;">
                    
                    ${comparison.isCheaper 
                        ? `<div style="font-size:0.9em; color:#aaa;">Спестяваш</div>
                           <div style="font-size:1.4em; font-weight:bold; color:#4CAF50;">${fmt(comparison.savings)}</div>` 
                        : `<div style="font-size:0.9em; color:#aaa;">Загуба</div>
                           <div style="font-size:1.4em; font-weight:bold; color:#FF5722;">${fmt(Math.abs(comparison.savings))}</div>`
                    }
                </div>

            </div>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    UICompare.init();
});
