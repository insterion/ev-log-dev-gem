const Calc = {
    compare: function(kwh, pricePerKwh, evEfficiency, iceMpg, fuelPricePerLiter) {
        const rangeMiles = kwh * evEfficiency;
        const costEV = kwh * pricePerKwh;
        const gallons = rangeMiles / iceMpg;
        const liters = gallons * 4.54609;
        const costICE = liters * fuelPricePerLiter;
        return { rangeMiles, costEV, costICE, savings: costICE - costEV, isCheaper: costEV < costICE };
    },
    calculateTCO: function(logs, costs, settings) {
        let totalKwh = 0; let totalEvChargingCost = 0;
        logs.forEach(l => {
            totalKwh += parseFloat(l.kwh);
            let cost = (l.total !== undefined) ? l.total : (l.kwh * l.price);
            totalEvChargingCost += parseFloat(cost);
        });
        let totalEvMaint = 0; let totalIceMaint = 0;
        costs.forEach(c => {
            const target = c.target || 'ev'; const amt = parseFloat(c.amount);
            if(target === 'ev') totalEvMaint += amt; else totalIceMaint += amt;
        });
        const totalMiles = totalKwh * settings.evEff;
        const liters = (totalMiles / settings.iceMpg) * 4.54609;
        const totalIceFuelCost = liters * settings.fuelPrice;
        const totalSpentEV = totalEvChargingCost + totalEvMaint;
        const totalSpentICE = totalIceFuelCost + totalIceMaint;
        return { totalMiles, totalEvChargingCost, totalEvMaint, totalIceFuelCost, totalIceMaint, totalSpentEV, totalSpentICE, netBalance: totalSpentICE - totalSpentEV };
    }
};
