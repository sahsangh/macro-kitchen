/**
 * One portion, several ways. Given the whole (total weight + number of
 * servings) and a density, convert between grams, ml, servings and percent.
 */
export type PortionMode = 'g' | 'ml' | 'servings' | 'pct';

export type Whole = { totalWeightG?: number; servings?: number; servingSizeG?: number; density?: number };

export function servingSize(w: Whole) {
  if (w.servingSizeG) return w.servingSizeG;
  if (w.totalWeightG && w.servings) return w.totalWeightG / w.servings;
  return undefined;
}

export function toGrams(value: number, mode: PortionMode, w: Whole): number | undefined {
  if (!(value > 0)) return undefined;
  if (mode === 'g') return value;
  if (mode === 'ml') return value * (w.density || 1);
  if (mode === 'servings') {
    const s = servingSize(w);
    return s ? value * s : undefined;
  }
  return w.totalWeightG ? (value / 100) * w.totalWeightG : undefined;
}

export function fromGrams(grams: number, mode: PortionMode, w: Whole): number | undefined {
  if (mode === 'g') return grams;
  if (mode === 'ml') return grams / (w.density || 1);
  if (mode === 'servings') {
    const s = servingSize(w);
    return s ? grams / s : undefined;
  }
  return w.totalWeightG ? (grams / w.totalWeightG) * 100 : undefined;
}

/** Parse "1/3", "1.5", "2 1/2" etc. */
export function parseAmount(text: string): number {
  const t = text.trim().replace(',', '.');
  if (!t) return NaN;
  const mixed = t.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(t);
}
