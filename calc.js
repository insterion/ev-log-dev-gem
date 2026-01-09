/* file: calc.js */
const Calc = {
    // Стандартни настройки (ако потребителят не е въвел нищо)
    DEFAULTS: {
        EV_EFFICIENCY: 3.0, // mi/kWh
        ICE_MPG: 44.0,      // Miles per Gallon
        PRICE_KWH: 0.25,    // £/kWh
        PRICE_FUEL: 1.45    // £/liter (или 6.50 за галон, ще го уточним в UI)
    },

    /**
     * Превръща галони в литри и обратно (полезно ако цената е на литър, а разхода в MPG)
     * 1 UK Gallon = 4.54609 Liters
     */
    convert: {
        galToLiters: (gal) => gal * 4.54609,
        litersToGal: (l) => l / 4.54609
    },

    /**
     * Основна функция за сравнение
     */
    analyze: function(kwh, efficiency, priceKwh, mpg, priceFuelPerGallon) {
        // 1. Пробег с този ток
        const range = kwh * efficiency;

        // 2. Разход за EV
        const costEV = kwh * priceKwh;
        const costPerMileEV = range > 0 ? costEV / range : 0;

        // 3. Разход за ДВГ (ICE) за същото разстояние
        // Колко галона са нужни за това разстояние?
        const gallonsNeeded = mpg > 0 ? range / mpg : 0;
        const costICE = gallonsNeeded * priceFuelPerGallon;
        const costPerMileICE = range > 0 ? costICE / range : 0;

        // 4. Сравнение
        const savings = costICE - costEV;
        
        return {
            rangeMiles: range,
            ev: {
                totalCost: costEV,
                costPerMile: costPerMileEV
            },
            ice: {
                totalCost: costICE,
                costPerMile: costPerMileICE,
                gallonsConsumed: gallonsNeeded
            },
            diff: {
                value: savings,
                isCheaper: savings > 0,
                percent: costICE > 0 ? (savings / costICE) * 100 : 0
            }
        };
    }
};
