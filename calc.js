/* * calc.js
 * Double-checked logic for EV vs ICE comparison
 */

const Calc = {
    // Настройки по подразбиране (ако няма въведени)
    DEFAULT_EV_EFFICIENCY: 3.0, // мили за 1 kWh
    DEFAULT_ICE_MPG: 44.0,      // мили за 1 галон

    /**
     * Изчислява прогнозния пробег на база заредени kWh
     * @param {number} kwh - Заредени киловатчаса
     * @param {number} efficiency - Ефективност (mi/kWh)
     * @returns {number} - Пробег в мили
     */
    getEstimatedRange: function(kwh, efficiency) {
        const eff = efficiency || this.DEFAULT_EV_EFFICIENCY;
        return kwh * eff;
    },

    /**
     * Изчислява цената за пробег с ДВГ (ICE)
     * @param {number} miles - Разстояние в мили
     * @param {number} mpg - Разход (Miles Per Gallon)
     * @param {number} fuelPrice - Цена на гориво за единица (галон/литър)
     * @returns {number} - Цена за пътуването
     */
    getIceCost: function(miles, mpg, fuelPrice) {
        const realMpg = mpg || this.DEFAULT_ICE_MPG;
        if (realMpg === 0) return 0; // Защита от деление на нула
        
        const gallonsNeeded = miles / realMpg;
        return gallonsNeeded * fuelPrice;
    },

    /**
     * Изчислява цената за зареждане на EV
     * @param {number} kwh - Заредени kWh
     * @param {number} kwhPrice - Цена на 1 kWh
     * @returns {number} - Цена за зареждането
     */
    getEvCost: function(kwh, kwhPrice) {
        return kwh * kwhPrice;
    },

    /**
     * Сравнява двата разхода и връща спестената сума
     * @param {number} evCost 
     * @param {number} iceCost 
     * @returns {object} - Обект с разликата и процента
     */
    compare: function(evCost, iceCost) {
        const savings = iceCost - evCost;
        // Защита: ако iceCost е 0, да не връщаме NaN за процента
        const percent = iceCost > 0 ? (savings / iceCost) * 100 : 0;
        
        return {
            savings: savings,
            isCheaper: savings > 0,
            percent: percent.toFixed(1)
        };
    }
};
