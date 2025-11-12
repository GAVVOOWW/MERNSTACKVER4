// priceCalculator.js
// Utility functions for calculating custom table prices.
// All dimensions are assumed to be in feet.

/**
 * Calculate the number of 3"x3" leg planks required based on the table width.
 * @param {number} width - Width of the table in feet.
 * @returns {number}
 */
export function calculateLegPlanks(width) {
    if (width === 6.0) return 3;
    if (width <= 5.0) return 2;
    return 2; // Fallback
}

/**
 * Calculate the number of 2"x12" planks required for the tabletop.
 * @param {number} length - Length of the table in feet.
 * @param {number} width - Width of the table in feet.
 * @returns {number}
 */
export function calculateTabletopPlanks(length, width) {
    const stripsNeeded = Math.ceil(width / 1.0); // Each plank is 1 ft wide
    const sectionsPerPlank = length <= 5.0 ? 2 : 1;
    return Math.ceil(stripsNeeded / sectionsPerPlank);
}

/**
 * Calculate the number of 3"x3" planks required for the frame.
 * @param {number} length - Length of the table in feet.
 * @param {number} width - Width of the table in feet.
 * @returns {number}
 */
export function calculateFramePlanks(length, width) {
    let numFramePlanks = 0;
    numFramePlanks += length <= 5.0 ? 1 : 2; // Length pieces
    numFramePlanks += width <= 5.0 ? 1 : 2;  // Width pieces
    return numFramePlanks;
}

/**
 * Calculates the total selling price for a custom table and returns a detailed breakdown.
 * @param {{length: number, width: number, height: number}} dimensions - Table dimensions in feet.
 * @param {number} laborDays - Estimated number of labor days.
 * @param {{labor_cost_per_day: number, plank_3x3_cost: number, plank_2x12_cost: number, profit_margin: number, overhead_cost: number}} costs - Various cost parameters.
 * @returns {{finalSellingPrice: number, breakdown: object, volume: number}}
 */
export function calculateCustomPrice(dimensions, laborDays, costs) {
    const { length, width, height } = dimensions;
    const {
        labor_cost_per_day,
        plank_3x3_cost,
        plank_2x12_cost,
        profit_margin,
        overhead_cost,
    } = costs;

    // Calculate plank counts
    const numLegPlanks = calculateLegPlanks(width);
    const numTabletopPlanks = calculateTabletopPlanks(length, width);
    const numFramePlanks = calculateFramePlanks(length, width);

    // Calculate individual costs
    const totalLaborCost = laborDays * labor_cost_per_day;
    const totalLegPlanksCost = numLegPlanks * plank_3x3_cost;
    const totalFramePlanksCost = numFramePlanks * plank_3x3_cost;
    const totalTabletopPlanksCost = numTabletopPlanks * plank_2x12_cost;

    // Aggregate costs
    const totalMaterialCost = totalLegPlanksCost + totalTabletopPlanksCost;
    const subtotal = totalLaborCost + totalMaterialCost + overhead_cost;
    const profitAmount = subtotal * profit_margin;
    const finalSellingPrice = subtotal + profitAmount;
    const tableVolume = length * height * width;

    return {
        finalSellingPrice,
        breakdown: {
            totalLaborCost,
            totalMaterialCost,
            overhead_cost,
            subtotal,
            profitAmount,
            planks: {
                legs: numLegPlanks,
                tabletop: numTabletopPlanks,
                frame: numFramePlanks,
            },
        },
        volume: tableVolume,
    };
} 