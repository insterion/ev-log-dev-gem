/* calc.js - Calculation Logic */

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

    // НОВО: TCO с поддръжка за двата типа
    calculateTCO: function(logs, costs, settings) {
        let totalKwh = 0;
        let totalEvChargingCost = 0;
        
        // 1. Ток (EV Fuel)
        logs.forEach(l => {
            totalKwh += parseFloat(l.kwh);
            let cost = (l.total !== undefined) ? l.total : (l.kwh * l.price);
            totalEvChargingCost += parseFloat(cost);
        });

        // 2. Разделяне на разходите (EV vs ICE)
        let totalEvMaint = 0;
        let totalIceMaint = 0;

        costs.forEach(c => {
            // Ако няма дефиниран target (стари записи), приемаме че е EV
            const target = c.target || 'ev';
            const amt = parseFloat(c.amount);

            if(target === 'ev') {
                totalEvMaint += amt;
            } else {
                totalIceMaint += amt;
            }
        });

        // 3. ДВГ Гориво (ICE Fuel Simulation)
        const totalMiles = totalKwh * settings.evEff;
        const gallons = totalMiles / settings.iceMpg;
        const liters = gallons * 4.54609;
        const totalIceFuelCost = liters * settings.fuelPrice;

        // 4. КРАЙНИ СУМИ
        const totalSpentEV = totalEvChargingCost + totalEvMaint;
        const totalSpentICE = totalIceFuelCost + totalIceMaint;
        
        // Нетен баланс (Колко си спестил общо)
        const netBalance = totalSpentICE - totalSpentEV;

        return {
            totalMiles,
            totalEvChargingCost,
            totalEvMaint,
            totalIceFuelCost,
            totalIceMaint,
            totalSpentEV,
            totalSpentICE,
            netBalance
        };
    }
};
