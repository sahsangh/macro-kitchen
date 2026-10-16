import { Router } from 'express';
import Batch from '../models/Batch.js';
import Food from '../models/Food.js';
import LogEntry from '../models/LogEntry.js';
import { ah, HttpError, localDate, meal } from '../lib/http.js';
import { positiveNumber, round1, roundMacros, scalePer100, scaleTotal } from '../lib/macros.js';
import { resolveGrams } from '../lib/portion.js';

const r = Router();

// Anything under half a gram left counts as finished.
const EMPTY_EPSILON_G = 0.5;

const own = async (req, extra = {}) => {
  const batch = await Batch.findOne({ _id: req.params.id, user: req.userId, ...extra });
  if (!batch) throw new HttpError(404, 'Item not found');
  return batch;
};

r.get('/', ah(async (req, res) => {
  const status = ['active', 'finished', 'discarded'].includes(req.query.status) ? req.query.status : 'active';
  const batches = await Batch.find({ user: req.userId, status })
    .sort(status === 'active' ? { madeAt: -1 } : { updatedAt: -1 })
    .limit(status === 'active' ? 200 : 50);
  res.json({ batches });
}));

r.get('/:id', ah(async (req, res) => res.json({ batch: await own(req) })));

/** Start tracking something that isn't a saved recipe (e.g. a tub of yogurt, a store-bought rotisserie chicken). */
r.post('/', ah(async (req, res) => {
  let { name } = req.body;
  const totalWeightG = positiveNumber(req.body.totalWeightG);
  if (!totalWeightG) throw new HttpError(400, 'Total weight is required');
  let totals;
  if (req.body.foodId) {
    const food = await Food.findById(req.body.foodId);
    if (!food) throw new HttpError(404, 'Food not found');
    name ||= food.name;
    totals = roundMacros(scalePer100(food.per100g, totalWeightG));
  } else {
    totals = roundMacros(req.body.totals || {});
  }
  if (!String(name || '').trim()) throw new HttpError(400, 'Name is required');
  const batch = await Batch.create({
    user: req.userId,
    name: name.trim(),
    totalWeightG,
    servings: positiveNumber(req.body.servings) || 1,
    totals,
    remainingG: totalWeightG,
    events: [{ type: 'made', grams: totalWeightG }],
  });
  res.status(201).json({ batch });
}));

/** Eat a portion: logs it for the day and removes it from what's left. */
r.post('/:id/eat', ah(async (req, res) => {
  const batch = await own(req, { status: 'active' });
  const date = localDate(req.body.date);
  let grams = round1(resolveGrams(req.body, batch));
  if (grams > batch.remainingG + EMPTY_EPSILON_G) {
    throw new HttpError(400, `Only ${round1(batch.remainingG)} g left`);
  }
  grams = Math.min(grams, batch.remainingG);

  const entry = await LogEntry.create({
    user: req.userId,
    date,
    meal: meal(req.body.meal),
    name: batch.name,
    grams,
    macros: roundMacros(scaleTotal(batch.totals, batch.totalWeightG, grams)),
    kind: 'batch',
    batch: batch._id,
  });

  // Conditional update so two quick taps can't take more than what's left.
  const updated = await Batch.findOneAndUpdate(
    { _id: batch._id, status: 'active', remainingG: { $gte: grams } },
    { $inc: { remainingG: -grams }, $push: { events: { type: 'eat', grams, log: entry._id } } },
    { new: true },
  );
  if (!updated) {
    await entry.deleteOne();
    throw new HttpError(409, 'That item changed — refresh and try again');
  }
  if (updated.remainingG < EMPTY_EPSILON_G) {
    updated.remainingG = 0;
    updated.status = 'finished';
    await updated.save();
  }
  res.status(201).json({ batch: updated, entry });
}));

/** Throw out some or all of what's left. */
r.post('/:id/discard', ah(async (req, res) => {
  const batch = await own(req, { status: 'active' });
  const grams = req.body.all ? batch.remainingG : Math.min(resolveGrams(req.body, batch), batch.remainingG);
  batch.remainingG = round1(batch.remainingG - grams);
  batch.events.push({ type: 'discard', grams: round1(grams) });
  if (batch.remainingG < EMPTY_EPSILON_G) {
    batch.remainingG = 0;
    batch.status = 'discarded';
  }
  await batch.save();
  res.json({ batch });
}));

/** Correct what's left after weighing it, or rename. */
r.patch('/:id', ah(async (req, res) => {
  const batch = await own(req);
  if (req.body.name?.trim()) batch.name = req.body.name.trim();
  if (req.body.remainingG !== undefined) {
    const v = Number(req.body.remainingG);
    if (!(v >= 0)) throw new HttpError(400, 'Remaining must be 0 or more');
    batch.events.push({ type: 'adjust', grams: round1(v - batch.remainingG) });
    batch.remainingG = round1(v);
    batch.status = v < EMPTY_EPSILON_G ? 'finished' : 'active';
  }
  await batch.save();
  res.json({ batch });
}));

r.delete('/:id', ah(async (req, res) => {
  const batch = await own(req);
  await batch.deleteOne();
  // Keep the diary intact; just unlink entries from the deleted item.
  await LogEntry.updateMany({ batch: batch._id }, { $unset: { batch: 1 } });
  res.status(204).end();
}));

export default r;
