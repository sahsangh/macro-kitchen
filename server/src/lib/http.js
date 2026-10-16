export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wrap an async route handler so thrown errors reach the error middleware. */
export const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

export function localDate(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  throw new HttpError(400, 'date must be YYYY-MM-DD');
}

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
export function meal(v) {
  return MEALS.includes(v) ? v : 'snack';
}
