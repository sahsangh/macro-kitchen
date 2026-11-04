export type Macros = { calories: number; protein: number; carbs: number; fat: number; fiber: number };
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type Settings = { weightUnit: 'lb' | 'kg'; addExerciseCalories: boolean };
export type User = { id: string; name: string; username: string; goals: Macros; settings?: Settings };

export type Food = {
  _id: string;
  name: string;
  brand?: string;
  barcode?: string;
  source: 'usda' | 'off' | 'custom';
  per100g: Macros;
  servingSizeG?: number;
  servingLabel?: string;
  density?: number; // g per ml
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
  density?: number;
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

// ---------- Training ----------

export type ExerciseKind = 'strength' | 'cardio';

export type Exercise = {
  _id: string;
  name: string;
  kind: ExerciseKind;
  muscle?: string;
  equipment?: string;
  met?: number;
  kcalPerKgKm?: number;
  createdBy?: string;
};

export type WorkoutSet = { weightKg?: number; reps?: number; done: boolean };

export type WorkoutEntry = {
  exercise: string;
  name: string;
  kind: ExerciseKind;
  targetReps?: string;
  sets?: WorkoutSet[];
  durationMin?: number;
  distanceKm?: number;
  calories?: number;
  caloriesManual?: boolean;
};

export type Workout = {
  _id: string;
  date: string;
  name: string;
  routine?: string;
  status: 'active' | 'done';
  startedAt: string;
  endedAt?: string;
  entries: WorkoutEntry[];
  notes: string;
  caloriesBurned: number;
};

export type RoutineExercise = { exercise: string; name: string; kind: ExerciseKind; sets: number; reps: string };
export type Routine = { _id: string; name: string; exercises: RoutineExercise[]; lastUsedAt?: string };

export type BodyWeight = { _id: string; date: string; weightKg: number };

export type Previous = Record<string, { date: string; sets: WorkoutSet[]; durationMin?: number; distanceKm?: number }>;
