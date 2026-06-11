// David's wholesale pricing guideline (see memory: spec-wholesale-pricing).
// "Basic guideline, ~95% of the time" — the order screen pre-fills these as a
// SUGGESTION and leaves the price editable for the manual exceptions (shortage
// → smaller add-on; very cheap → sometimes a bit more).

// Cost-plus markup added to the per-BOX cost, all in pence.
export function wholesaleMarkupPence(boxCostPence: number): number {
  if (boxCostPence < 750)   return 250  // under £7.50  → +£2.50
  if (boxCostPence <= 1200) return 300  // £7.50–£12    → +£3.00
  if (boxCostPence <= 1550) return 350  // £12–£15.50   → +£3.50
  if (boxCostPence <= 2000) return 400  // £15.50–£20   → +£4.00
  return 500                            // over £20     → +£5.00
}

// Fixed wholesale prices that BEAT the formula (per box/bag/sack), in pence.
export const WHOLESALE_FIXED: Record<string, number> = {
  'Avocado':       1910, // a box of avocados is always £19.10
  'Garlic Peeled':  600, // a bag of peeled garlic is always £6
  'Potato Sack':   1300, // a 25kg potato sack is always £13
}

// Suggested wholesale price for one line. Loose items use shop retail price;
// boxes use a fixed override if any, else cost + markup tier.
export function suggestedWholesalePrice(opts: {
  name:             string
  unitType:         'box' | 'retail_unit'
  retailPence:      number
  boxCostPence:     number | null
  typicalBoxCount?: number
}): number {
  // Loose items → charged at shop retail price
  if (opts.unitType === 'retail_unit') return opts.retailPence
  // Fixed overrides (box form)
  if (WHOLESALE_FIXED[opts.name] != null) return WHOLESALE_FIXED[opts.name]
  // Box → cost + markup tier
  if (opts.boxCostPence && opts.boxCostPence > 0) {
    return opts.boxCostPence + wholesaleMarkupPence(opts.boxCostPence)
  }
  // No known box cost → fall back to retail × box count
  return opts.retailPence * (opts.typicalBoxCount || 1)
}
