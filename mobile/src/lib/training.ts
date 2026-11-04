import { router } from 'expo-router';
import { Alert } from 'react-native';

import { ApiError, get, post } from './api';
import { today } from './date';
import type { Workout } from './types';

/** Start a workout (optionally from a routine) and open it. Resumes one already in progress. */
export async function startWorkout(routineId?: string) {
  try {
    const { workout } = await post<{ workout: Workout }>('/workouts', { date: today(), ...(routineId ? { routineId } : {}) });
    router.push({ pathname: '/workout/[id]', params: { id: workout._id } });
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 409) {
      Alert.alert('Workout in progress', 'Finish or discard your current workout first.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open it',
          onPress: async () => {
            const { workout } = await get<{ workout: Workout | null }>('/workouts/active');
            if (workout) router.push({ pathname: '/workout/[id]', params: { id: workout._id } });
          },
        },
      ]);
    } else Alert.alert('Couldn’t start workout', e.message);
  }
}

export const minutesBetween = (a: string, b?: string) => Math.max(0, Math.round(((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 60000));

export function workoutSummary(w: Workout) {
  const sets = w.entries.reduce((n, e) => n + (e.sets?.length ?? 0), 0);
  const cardioMin = w.entries.reduce((n, e) => n + (e.durationMin ?? 0), 0);
  const parts = [];
  if (sets) parts.push(`${sets} set${sets === 1 ? '' : 's'}`);
  if (cardioMin) parts.push(`${Math.round(cardioMin)} min cardio`);
  parts.push(`${w.caloriesBurned} kcal`);
  return parts.join(' · ');
}
