import { useAuth } from './auth';

export const KG_PER_LB = 0.45359237;
export const KM_PER_MI = 1.609344;

const trim = (n: number, digits = 1) => String(Math.round(n * 10 ** digits) / 10 ** digits);

/**
 * Everything is stored in kg / km; this converts to and from whatever the
 * user picked (lb + miles, or kg + km).
 */
export function useUnits() {
  const { user } = useAuth();
  const unit = user?.settings?.weightUnit ?? 'lb';
  const imperial = unit === 'lb';
  return {
    unit,
    dist: imperial ? 'mi' : 'km',
    toDisplay: (kg: number) => (imperial ? kg / KG_PER_LB : kg),
    toKg: (v: number) => (imperial ? v * KG_PER_LB : v),
    kmToDisplay: (km: number) => (imperial ? km / KM_PER_MI : km),
    displayToKm: (v: number) => (imperial ? v * KM_PER_MI : v),
    /** "135" (no unit) for inputs and compact set displays */
    w: (kg: number | undefined) => (kg === undefined || kg === null ? '' : trim(imperial ? kg / KG_PER_LB : kg)),
    /** "135 lb" */
    wU: (kg: number | undefined) => (kg === undefined || kg === null ? '–' : `${trim(imperial ? kg / KG_PER_LB : kg)} ${unit}`),
    dU: (km: number | undefined) => (km ? `${trim(imperial ? km / KM_PER_MI : km, 2)} ${imperial ? 'mi' : 'km'}` : ''),
  };
}
