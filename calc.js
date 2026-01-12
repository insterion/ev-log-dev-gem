/* calc.js - Calculation Logic */

const Calc = {
    /**
     * Сравнява зареждане на EV с еквивалентен пробег на ICE (ДВГ)
     * @param {number} kwh - Заредени киловатчаса
     * @param {number} pricePerKwh - Цена на тока
     * @param {number} evEfficiency - Ефективност (мил/kWh)
     * @param {number} iceMpg - Разход на ДВГ (Miles Per Gallon)
     * @param {number} fuelPricePerLiter - Цена на горивото
     */
    compare: function(kwh, pricePerKwh, evEfficiency, iceMpg, fuelPricePerLiter) {
        // 1. Колко мили минаваме с този ток?
        const rangeMiles = kwh * evEfficiency;

        // 2. Колко струва това на ток?
        const costEV = kwh * pricePerKwh;

        // 3. Колко би струвало с ДВГ?
        // UK Gallon = 4.54609 литра
        const gallonsNeeded = rangeMiles / iceMpg;
        const litersNeeded = gallonsNeeded * 4.54609;
        
        const costICE = litersNeeded * fuelPricePerLiter;

        return {
            rangeMiles: rangeMiles,
            costEV: costEV,
            costICE: costICE,
            savings: costICE - costEV, // Положително число = спестено
            isCheaper: costEV < costICE
        };
    }
};
