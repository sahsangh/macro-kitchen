/**
 * Calories-burned estimates. These are rough by nature (±20–30 %), which is
 * why adding them back to the food budget is a user setting.
 */
export const DEFAULT_BODY_WEIGHT_KG = 70;
const STRENGTH_MET = 5.0; // vigorous resistance training
const MIN_PER_SET = 3; // one working set + rest, for workouts logged after the fact

export function cardioCalories(exercise, { durationMin, distanceKm }, kg) {
  if (exercise?.kcalPerKgKm && distanceKm > 0) return kg * distanceKm * exercise.kcalPerKgKm;
  if (exercise?.met && durationMin > 0) return (exercise.met * kg * durationMin) / 60;
  return 0;
}

/**
 * Minutes of lifting in a workout: the clock time minus any cardio, unless
 * that's implausibly short (logged afterwards), in which case ~3 min per set.
 */
export function strengthMinutes(workout) {
  const doneSets = workout.entries
    .filter((e) => e.kind === 'strength')
    .reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  if (!doneSets) return 0;
  const end = workout.endedAt ?? new Date();
  const elapsed = (end - new Date(workout.startedAt)) / 60000;
  const cardio = workout.entries.reduce((n, e) => n + (e.kind === 'cardio' ? e.durationMin || 0 : 0), 0);
  const clock = Math.min(Math.max(elapsed - cardio, 0), 180);
  return clock >= 5 ? clock : doneSets * MIN_PER_SET;
}

export const strengthCalories = (minutes, kg) => (STRENGTH_MET * kg * minutes) / 60;

/** Estimated 1-rep max (Epley). */
export const oneRepMax = (weightKg, reps) => (reps > 0 ? weightKg * (1 + reps / 30) : 0);
