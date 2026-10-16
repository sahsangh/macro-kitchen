export const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];

export const zeroMacros = () => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

export const round1 = (n) => Math.round(n * 10) / 10;

export function roundMacros(m) {
  const out = {};
  for (const k of MACRO_KEYS) out[k] = round1(m[k] || 0);
  return out;
}

/** Macros for `grams` of something whose macros are given per 100 g. */
export function scalePer100(per100g, grams) {
  const out = {};
  for (const k of MACRO_KEYS) out[k] = ((per100g?.[k] || 0) * grams) / 100;
  return out;
}

/** Macros for `grams` of a whole whose total macros/weight are known. */
export function scaleTotal(totals, totalWeightG, grams) {
  const f = totalWeightG > 0 ? grams / totalWeightG : 0;
  const out = {};
  for (const k of MACRO_KEYS) out[k] = (totals?.[k] || 0) * f;
  return out;
}

export function addMacros(a, b) {
  const out = {};
  for (const k of MACRO_KEYS) out[k] = (a?.[k] || 0) + (b?.[k] || 0);
  return out;
}

/** Recipe totals from its ingredient list (no-macro extras are ignored). */
export function recipeTotals(ingredients) {
  return ingredients.reduce(
    (acc, ing) => addMacros(acc, scalePer100(ing.per100g, ing.grams || 0)),
    zeroMacros(),
  );
}

export function positiveNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
