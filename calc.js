/* calc.js - Updated Logic */

const Calc = {
    // Единично сравнение (за калкулатора)
    compare: function(kwh, pricePerKwh, evEfficiency, iceMpg, fuelPricePerLiter) {
        const rangeMiles = kwh * evEfficiency;
        const costEV = kwh * pricePerKwh;
        
        const gallons = rangeMiles / iceMpg;
        const liters = gallons * 4.54609;
        const costICE = liters * fuelPricePerLiter;

        return {
            rangeMiles, costEV, costICE,
            savings: costICE - costEV,
            isCheaper: costEV < costICE
        };
    },

    // НОВО: Глобална статистика (TCO)
    calculateTCO: function(logs, costs, settings) {
        let totalKwh = 0;
        let totalEvChargingCost = 0;
        
        // 1. Сумираме зарежданията
        logs.forEach(l => {
            totalKwh += parseFloat(l.kwh);
            // Ако има записано total, ползваме го, иначе смятаме
            let cost = (l.total !== undefined) ? l.total : (l.kwh * l.price);
            totalEvChargingCost += parseFloat(cost);
        });

        // 2. Сумираме допълнителните разходи (Costs)
        let totalMaintenance = 0;
        costs.forEach(c => {
            totalMaintenance += parseFloat(c.amount);
        });

        // 3. Изчисляваме еквивалента на ДВГ
        const totalMiles = totalKwh * settings.evEff;
        
        const gallons = totalMiles / settings.iceMpg;
        const liters = gallons * 4.54609;
        const totalIceFuelCost = liters * settings.fuelPrice;

        // 4. Големите тотали
        const totalSpentEV = totalEvChargingCost + totalMaintenance;
        
        // Спестено само от гориво (Ток vs Бензин)
        const fuelSavings = totalIceFuelCost - totalEvChargingCost;

        // "Нетен баланс" - Спестеното от гориво покрива ли поддръжката?
        const netBalance = fuelSavings - totalMaintenance;

        return {
            totalMiles,
            totalKwh,
            totalEvChargingCost,
            totalMaintenance,
            totalSpentEV,
            totalIceFuelCost,
            fuelSavings,
            netBalance
        };
    }
};
