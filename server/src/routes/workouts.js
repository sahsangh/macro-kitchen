import { Router } from 'express';
import mongoose from 'mongoose';
import BodyWeight from '../models/BodyWeight.js';
import Exercise from '../models/Exercise.js';
import Routine from '../models/Routine.js';
import Workout from '../models/Workout.js';
import { ah, HttpError, localDate } from '../lib/http.js';
import { cardioCalories, DEFAULT_BODY_WEIGHT_KG, strengthCalories, strengthMinutes } from '../lib/calories.js';
import { round1 } from '../lib/macros.js';

const r = Router();

const nonNeg = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** Latest body weight on or before `date`, for calorie estimates. */
async function bodyWeightKg(userId, date) {
  const w = await BodyWeight.findOne({ user: userId, date: { $lte: date } }).sort({ date: -1 });
  return w?.weightKg ?? DEFAULT_BODY_WEIGHT_KG;
}

/** Validate client entries against the exercise library (name/kind come from the server). */
async function parseEntries(raw = [], userId) {
  const ids = raw.map((e) => e.exercise).filter((id) => mongoose.isValidObjectId(id));
  const found = await Exercise.find({ _id: { $in: ids }, $or: [{ createdBy: { $exists: false } }, { createdBy: userId }] });
  const byId = new Map(found.map((e) => [String(e._id), e]));
  return raw
    .filter((e) => byId.has(String(e.exercise)))
    .map((e) => {
      const ex = byId.get(String(e.exercise));
      const base = { exercise: ex._id, name: ex.name, kind: ex.kind, targetReps: e.targetReps };
      if (ex.kind === 'cardio') {
        if (nonNeg(e.durationMin) > 24 * 60) throw new HttpError(400, `${ex.name}: duration can't be more than 24 hours`);
        if (nonNeg(e.distanceKm) > 1000) throw new HttpError(400, `${ex.name}: distance looks too long`);
        const manual = !!e.caloriesManual && nonNeg(e.calories) !== undefined;
        return { ...base, durationMin: nonNeg(e.durationMin), distanceKm: nonNeg(e.distanceKm), calories: manual ? nonNeg(e.calories) : undefined, caloriesManual: manual };
      }
      return {
        ...base,
        sets: (e.sets || []).slice(0, 50).map((s) => ({ weightKg: nonNeg(s.weightKg), reps: nonNeg(s.reps), done: !!s.done })),
      };
    });
}

async function computeCalories(workout) {
  const kg = await bodyWeightKg(workout.user, workout.date);
  const library = new Map(
    (await Exercise.find({ _id: { $in: workout.entries.map((e) => e.exercise) } })).map((e) => [String(e._id), e]),
  );
  let total = 0;
  for (const e of workout.entries) {
    if (e.kind !== 'cardio') continue;
    if (!e.caloriesManual) e.calories = round1(cardioCalories(library.get(String(e.exercise)), e, kg));
    total += e.calories || 0;
  }
  total += strengthCalories(strengthMinutes(workout), kg);
  workout.caloriesBurned = Math.round(total);
}

const own = async (req) => {
  const w = await Workout.findOne({ _id: req.params.id, user: req.userId });
  if (!w) throw new HttpError(404, 'Workout not found');
  return w;
};

r.get('/', ah(async (req, res) => {
  const filter = { user: req.userId };
  if (req.query.date) filter.date = localDate(req.query.date);
  else if (req.query.from) filter.date = { $gte: localDate(req.query.from), $lte: localDate(req.query.to || req.query.from) };
  const workouts = await Workout.find(filter).sort({ startedAt: -1 }).limit(Number(req.query.limit) || 50);
  res.json({ workouts });
}));

r.get('/active', ah(async (req, res) => {
  res.json({ workout: await Workout.findOne({ user: req.userId, status: 'active' }) });
}));

/** Most recent completed sets for each exercise id, for "last time" hints. */
r.get('/previous', ah(async (req, res) => {
  const ids = String(req.query.exercises || '').split(',').filter((id) => mongoose.isValidObjectId(id));
  const previous = {};
  await Promise.all(
    ids.map(async (id) => {
      const w = await Workout.findOne({ user: req.userId, status: 'done', 'entries.exercise': id }).sort({ startedAt: -1 });
      const entry = w?.entries.find((e) => String(e.exercise) === id);
      if (entry) previous[id] = { date: w.date, sets: entry.sets.filter((s) => s.done), durationMin: entry.durationMin, distanceKm: entry.distanceKm };
    }),
  );
  res.json({ previous });
}));

r.get('/:id', ah(async (req, res) => res.json({ workout: await own(req) })));

/**
 * Start a workout (empty or from a routine), or log a finished one in one go
 * with `finish: true` (e.g. a run you did earlier).
 */
r.post('/', ah(async (req, res) => {
  const date = localDate(req.body.date);
  const finish = !!req.body.finish;
  if (!finish) {
    const active = await Workout.findOne({ user: req.userId, status: 'active' });
    if (active) return res.status(409).json({ error: 'You already have a workout in progress', workoutId: active._id });
  }

  let name = String(req.body.name || '').trim();
  let entries = await parseEntries(req.body.entries, req.userId);
  let routine;
  if (req.body.routineId) {
    routine = await Routine.findOne({ _id: req.body.routineId, user: req.userId });
    if (!routine) throw new HttpError(404, 'Routine not found');
    name ||= routine.name;
    entries = routine.exercises.map((x) => ({
      exercise: x.exercise,
      name: x.name,
      kind: x.kind,
      targetReps: x.reps,
      ...(x.kind === 'strength' ? { sets: Array.from({ length: x.sets }, () => ({ done: false })) } : {}),
    }));
    routine.lastUsedAt = new Date();
    await routine.save();
  }
  if (!name) name = entries.length === 1 ? entries[0].name : 'Workout';

  const now = new Date();
  const workout = new Workout({
    user: req.userId,
    date,
    name,
    routine: routine?._id,
    entries,
    notes: String(req.body.notes || ''),
    status: finish ? 'done' : 'active',
    startedAt: now,
    endedAt: finish ? now : undefined,
  });
  await computeCalories(workout);
  await workout.save();
  res.status(201).json({ workout });
}));

/** Autosave while training, or edit a finished workout. */
r.put('/:id', ah(async (req, res) => {
  const workout = await own(req);
  if (req.body.name?.trim()) workout.name = req.body.name.trim();
  if (req.body.date) workout.date = localDate(req.body.date);
  if (req.body.notes !== undefined) workout.notes = String(req.body.notes);
  if (req.body.entries) workout.entries = await parseEntries(req.body.entries, req.userId);
  await computeCalories(workout);
  await workout.save();
  res.json({ workout });
}));

r.post('/:id/finish', ah(async (req, res) => {
  const workout = await own(req);
  if (req.body.entries) workout.entries = await parseEntries(req.body.entries, req.userId);
  // Keep only what was actually done.
  workout.entries = workout.entries
    .map((e) => e.toObject())
    .map((e) => (e.kind === 'strength' ? { ...e, sets: e.sets.filter((s) => s.done) } : e))
    .filter((e) => (e.kind === 'strength' ? e.sets.length > 0 : (e.durationMin || 0) > 0 || (e.distanceKm || 0) > 0 || (e.calories || 0) > 0));
  if (!workout.entries.length) throw new HttpError(400, 'Complete at least one set before finishing (or discard the workout)');
  workout.status = 'done';
  workout.endedAt = new Date();
  await computeCalories(workout);
  await workout.save();
  res.json({ workout });
}));

r.delete('/:id', ah(async (req, res) => {
  await (await own(req)).deleteOne();
  res.status(204).end();
}));

export default r;
