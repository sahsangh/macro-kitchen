export type Macros = { calories: number; protein: number; carbs: number; fat: number; fiber: number };
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type User = { id: string; name: string; username: string; goals: Macros };

export type Food = {
  _id: string;
  name: string;
  brand?: string;
  barcode?: string;
  source: 'usda' | 'off' | 'custom';
  per100g: Macros;
  servingSizeG?: number;
  servingLabel?: string;
};

export type Ingredient = { _id?: string; _key?: string; food?: string; name: string; grams: number; per100g: Macros };
export type Extra = { _id?: string; name: string; amount: string };

export type Recipe = {
  _id: string;
  name: string;
  ingredients: Ingredient[];
  extras: Extra[];
  servings: number;
  totalWeightG: number;
  totals: Macros;
  notes: string;
  updatedAt: string;
};

export type BatchEvent = { type: 'made' | 'eat' | 'discard' | 'restore' | 'adjust'; grams: number; at: string };

export type Batch = {
  _id: string;
  recipe?: string;
  name: string;
  totalWeightG: number;
  servings: number;
  totals: Macros;
  remainingG: number;
  status: 'active' | 'finished' | 'discarded';
  events: BatchEvent[];
  madeAt: string;
};

export type LogEntry = {
  _id: string;
  date: string;
  meal: Meal;
  name: string;
  grams?: number;
  macros: Macros;
  kind: 'food' | 'batch' | 'quick';
  food?: string;
  batch?: string;
};
