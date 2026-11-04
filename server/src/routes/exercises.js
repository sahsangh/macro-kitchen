import { Router } from 'express';
import Exercise from '../models/Exercise.js';
import Workout from '../models/Workout.js';
import { ah, HttpError } from '../lib/http.js';
import { oneRepMax } from '../lib/calories.js';
import { positiveNumber } from '../lib/macros.js';

const r = Router();

const visible = (userId) => ({ $or: [{ createdBy: { $exists: false } }, { createdBy: userId }] });
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

r.get('/', ah(async (req, res) => {
  const filter = { $and: [visible(req.userId)] };
  if (['strength', 'cardio'].includes(req.query.kind)) filter.$and.push({ kind: req.query.kind });
  const q = String(req.query.q || '').trim();
  if (q) filter.$and.push(...q.split(/\s+/).map((t) => ({ name: { $regex: escapeRegex(t), $options: 'i' } })));
  const exercises = await Exercise.find(filter).sort({ name: 1 }).limit(300);
  res.json({ exercises });
}));

r.post('/', ah(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw new HttpError(400, 'Name is required');
  const kind = req.body.kind === 'cardio' ? 'cardio' : 'strength';
  const exercise = await Exercise.create({
    name,
    kind,
    muscle: kind === 'cardio' ? 'cardio' : String(req.body.muscle || 'other'),
    equipment: req.body.equipment || undefined,
    met: kind === 'cardio' ? positiveNumber(req.body.met) || 6 : undefined,
    createdBy: req.userId,
  });
  res.status(201).json({ exercise });
}));

/** Past sessions for one exercise, newest first, plus personal bests. */
r.get('/:id/history', ah(async (req, res) => {
  const exercise = await Exercise.findOne({ _id: req.params.id, ...visible(req.userId) });
  if (!exercise) throw new HttpError(404, 'Exercise not found');
  const workouts = await Workout.find({ user: req.userId, status: 'done', 'entries.exercise': exercise._id })
    .sort({ startedAt: -1 })
    .limit(100);

  const sessions = workouts.map((w) => {
    const entry = w.entries.find((e) => String(e.exercise) === String(exercise._id));
    const sets = entry.sets.filter((s) => s.done);
    return {
      workoutId: w._id,
      date: w.date,
      sets,
      durationMin: entry.durationMin,
      distanceKm: entry.distanceKm,
      calories: entry.calories,
      bestOneRepMax: Math.max(0, ...sets.map((s) => oneRepMax(s.weightKg || 0, s.reps || 0))),
      volumeKg: sets.reduce((n, s) => n + (s.weightKg || 0) * (s.reps || 0), 0),
    };
  });
  const allSets = sessions.flatMap((s) => s.sets);
  const heaviest = allSets.reduce((best, s) => ((s.weightKg || 0) > (best?.weightKg || 0) ? s : best), null);
  res.json({
    exercise,
    sessions,
    bests: {
      heaviest,
      oneRepMax: Math.max(0, ...sessions.map((s) => s.bestOneRepMax)),
      mostReps: Math.max(0, ...allSets.map((s) => s.reps || 0)),
    },
  });
}));

export default r;
