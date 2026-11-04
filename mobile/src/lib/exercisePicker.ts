import { router } from 'expo-router';

import type { Exercise, ExerciseKind } from './types';

/**
 * The exercise picker is a modal screen; whoever opens it registers a
 * callback here and the picker hands the chosen exercises back.
 */
let handler: ((picked: Exercise[]) => void) | null = null;

export const exercisePicker = {
  open(onPick: (picked: Exercise[]) => void, opts: { kind?: ExerciseKind; single?: boolean } = {}) {
    handler = onPick;
    router.push({ pathname: '/exercise-picker', params: { ...(opts.kind ? { kind: opts.kind } : {}), ...(opts.single ? { single: '1' } : {}) } });
  },
  deliver(picked: Exercise[]) {
    handler?.(picked);
    handler = null;
  },
};
