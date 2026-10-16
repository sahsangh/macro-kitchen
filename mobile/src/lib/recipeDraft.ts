import { useSyncExternalStore } from 'react';

import type { Extra, Ingredient, Recipe } from './types';

/**
 * The recipe being edited lives here (not in component state) so the food
 * search / scanner screens can drop picked ingredients straight into it.
 */
export type Draft = {
  id?: string;
  name: string;
  servings: string;
  totalWeightG: string; // '' = use sum of ingredients
  ingredients: Ingredient[];
  extras: Extra[];
  notes: string;
};

let seq = 0;
const withKey = (i: Ingredient): Ingredient => ({ ...i, _key: i._key ?? `k${++seq}` });

const empty = (): Draft => ({ name: '', servings: '1', totalWeightG: '', ingredients: [], extras: [], notes: '' });

let draft: Draft = empty();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const recipeDraft = {
  get: () => draft,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  set(patch: Partial<Draft>) {
    draft = { ...draft, ...patch };
    emit();
  },
  reset(from?: Recipe) {
    draft = from
      ? {
          id: from._id,
          name: from.name,
          servings: String(from.servings),
          totalWeightG: String(from.totalWeightG),
          ingredients: from.ingredients.map(withKey),
          extras: from.extras.map((x) => ({ ...x })),
          notes: from.notes,
        }
      : empty();
    emit();
  },
  addIngredient(ing: Ingredient) {
    draft = { ...draft, ingredients: [...draft.ingredients, withKey(ing)] };
    emit();
  },
};

export const useRecipeDraft = () => useSyncExternalStore(recipeDraft.subscribe, recipeDraft.get, recipeDraft.get);
