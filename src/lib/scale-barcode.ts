// Weigh-by-label barcode parsing.
//
// A legal-for-trade retail scale weighs produce and prints an EAN-13 label that
// embeds (a) the product's PLU and (b) either the total PRICE or the WEIGHT.
// The cashier scans that label at the till (the scanner is a keyboard-wedge HID
// device — it "types" the 13 digits and presses Enter). This module turns those
// 13 digits into a { plu, pricePence | weightKg } result.
//
// ── IMPORTANT: the exact field layout is scale-configurable ───────────────────
// Different scales lay the 13 digits out differently (1- vs 2-digit in-store
// prefix, an optional internal price-check digit, price-embedded vs
// weight-embedded). The layout is therefore a config object, not hardcoded.
// DEFAULT below is the common "type-2, price-embedded" EAN-13:
//     [20-29]  PPPPP  VVVVV  C
//       2-digit  5-digit  5-digit  EAN-13
//       prefix   PLU      price    check
//       (pos0-1) (pos2-6) (pos7-11) (pos12)   price in pence.
// David's actual scale format MUST be confirmed against this preset (or a new
// preset added) before go-live — see also the weight-embedded alternative.

export interface ScaleBarcodeFormat {
  /** Leading flag digits marking an in-store weighed/priced label. */
  prefixes: string[]
  /** 0-based start index and length of the PLU/item field. */
  pluStart: number
  pluLength: number
  /** 0-based start index and length of the embedded value field. */
  valueStart: number
  valueLength: number
  /** PRICE (minor units, i.e. pence) or WEIGHT. */
  valueType: 'price' | 'weight'
  /** Weight only: divisor to convert the integer field to kg (grams→kg = 1000). */
  weightDivisor?: number
}

export interface ScaleBarcode {
  plu: number
  /** Set when valueType === 'price'. Total line price in pence. */
  pricePence?: number
  /** Set when valueType === 'weight'. */
  weightKg?: number
}

/** Default: type-2 price-embedded EAN-13 (prefix 20–29, PLU[5], price[5] in pence). */
export const SCALE_FORMAT_PRICE_EAN13: ScaleBarcodeFormat = {
  prefixes: ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29'],
  pluStart: 2, pluLength: 5,
  valueStart: 7, valueLength: 5,
  valueType: 'price',
}

/** Alternative: weight-embedded EAN-13 (lets the till price from retail_price). */
export const SCALE_FORMAT_WEIGHT_EAN13: ScaleBarcodeFormat = {
  prefixes: ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29'],
  pluStart: 2, pluLength: 5,
  valueStart: 7, valueLength: 5,
  valueType: 'weight',
  weightDivisor: 1000, // field is grams
}

/** Validate an EAN-13 (or EAN-8) check digit. */
export function isValidEan(code: string): boolean {
  if (!/^\d{8}$|^\d{13}$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  // From the right: weights alternate 3,1,3,1… (EAN check-digit rule).
  let sum = 0
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += digits[i] * w
  }
  return (10 - (sum % 10)) % 10 === check
}

/**
 * Parse a scanned barcode as a scale weigh-by-label code.
 * Returns null if it isn't a valid in-store scale label for the given format
 * (wrong length, wrong prefix, or bad check digit) — callers should then fall
 * back to treating it as an ordinary product barcode.
 */
export function parseScaleBarcode(
  raw: string,
  fmt: ScaleBarcodeFormat = SCALE_FORMAT_PRICE_EAN13,
): ScaleBarcode | null {
  const code = raw.trim()
  if (!/^\d{13}$/.test(code)) return null
  if (!fmt.prefixes.some(p => code.startsWith(p))) return null
  if (!isValidEan(code)) return null

  const plu = parseInt(code.slice(fmt.pluStart, fmt.pluStart + fmt.pluLength), 10)
  const value = parseInt(code.slice(fmt.valueStart, fmt.valueStart + fmt.valueLength), 10)

  if (fmt.valueType === 'weight') {
    return { plu, weightKg: value / (fmt.weightDivisor ?? 1000) }
  }
  return { plu, pricePence: value }
}

/**
 * Compute the EAN-13 check digit for 12 leading digits — used by tests and to
 * synthesise labels for QA (not needed at the till, where the scale supplies it).
 */
export function ean13CheckDigit(twelve: string): number {
  const digits = twelve.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 12; i++) sum += digits[i] * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}
