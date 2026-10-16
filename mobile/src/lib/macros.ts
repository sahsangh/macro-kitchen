import type { Ingredient, Macros } from './types';

export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
export const KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;

export const scale = (m: Macros, factor: number): Macros =>
  Object.fromEntries(KEYS.map((k) => [k, (m?.[k] || 0) * factor])) as Macros;

export const add = (a: Macros, b: Macros): Macros =>
  Object.fromEntries(KEYS.map((k) => [k, (a?.[k] || 0) + (b?.[k] || 0)])) as Macros;

export const per100 = (m: Macros, grams: number) => scale(m, grams / 100);

export const ingredientsTotal = (ings: Ingredient[]) =>
  ings.reduce((acc, i) => add(acc, per100(i.per100g, i.grams || 0)), ZERO);

/** Format a number for display: integers for big values, 1 decimal for small. */
export function fmt(n: number | undefined, digits = 0) {
  if (n === undefined || !Number.isFinite(n)) return '–';
  if (digits === 0) return Math.round(n).toLocaleString();
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return String(r);
}

export const fmtG = (g: number) => (g >= 1000 ? `${fmt(g / 1000, 2)} kg` : `${fmt(g, g < 10 ? 1 : 0)} g`);
