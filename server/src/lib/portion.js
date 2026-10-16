import { HttpError } from './http.js';
import { positiveNumber } from './macros.js';

/**
 * Turn a portion given as grams, servings or a fraction (0–1 of the whole)
 * into grams. `whole` describes the thing being portioned.
 */
export function resolveGrams(body, { totalWeightG, servings, servingSizeG }) {
  const grams = positiveNumber(body.grams);
  if (grams) return grams;

  const nServings = positiveNumber(body.servings);
  if (nServings) {
    const perServing = servingSizeG || (totalWeightG && servings ? totalWeightG / servings : null);
    if (!perServing) throw new HttpError(400, 'This item has no serving size; enter grams instead');
    return nServings * perServing;
  }

  const fraction = positiveNumber(body.fraction);
  if (fraction) {
    if (!totalWeightG) throw new HttpError(400, 'This item has no total weight; enter grams instead');
    return fraction * totalWeightG;
  }

  throw new HttpError(400, 'Provide grams, servings or fraction');
}
