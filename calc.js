/* calc.js - Mathematical logic */
const Calc = {
    // Конвертиране
    litersToGallons: (l) => l / 4.54609,
    gallonsToLiters: (g) => g * 4.54609,

    /**
     * Сравнява EV и ICE за дадено количество ток
     * @param {number} kwh - Зареден ток
     * @param {number} evPrice - Цена на тока (£/kWh)
     * @param {number} evEff - Ефективност (mi/kWh)
     * @param {number} iceMpg - Разход на старата кола (MPG)
     * @param {number} fuelPriceLiter - Цена на горивото (£/L)
     */
    compare: function(kwh, evPrice, evEff, iceMpg, fuelPriceLiter) {
        // 1. Колко мили ще минем с този ток?
        const range = kwh * evEff;

        // 2. Колко струва това с EV?
        const costEV = kwh * evPrice;

        // 3. Колко гориво (литри) ни трябват за същите мили?
        // Gallons needed = Miles / MPG
        const gallons = iceMpg > 0 ? range / iceMpg : 0;
        const liters = gallons * 4.54609;

        // 4. Колко струва това с ДВГ?
        const costICE = liters * fuelPriceLiter;

        // 5. Разлика
        const diff = costICE - costEV;

        return {
            rangeMiles: range,
            costEV: costEV,
            costICE: costICE,
            savings: diff,
            isCheaper: diff > 0
        };
    }
};
