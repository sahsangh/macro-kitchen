import { router, useLocalSearchParams } from 'expo-router';

import type { Meal } from './types';

/**
 * The add-food flow (search → scan → food detail → custom food) is reused for
 * three jobs. These params ride along through every screen in the flow.
 *  - log:        log a portion to the diary on `date` / `meal`
 *  - ingredient: add to the recipe being edited
 *  - track:      start tracking a package in the pantry
 */
export type FlowMode = 'log' | 'ingredient' | 'track';
export type FlowParams = { mode?: FlowMode; date?: string; meal?: Meal };

export function useFlowParams() {
  const p = useLocalSearchParams<{ mode?: string; date?: string; meal?: string }>();
  return {
    mode: (p.mode as FlowMode) || 'log',
    date: p.date,
    meal: p.meal as Meal | undefined,
  };
}

/** Strip undefined so expo-router doesn't put "undefined" in the URL. */
export function flowParams(p: FlowParams): Record<string, string> {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v)) as Record<string, string>;
}

/** Close everything stacked on top of the tabs and show `tab`. */
export function backToTab(tab: '/' | '/pantry' | '/recipes') {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(tab);
}
