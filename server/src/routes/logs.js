import { Router } from 'express';
import mongoose from 'mongoose';
import Batch from '../models/Batch.js';
import Food from '../models/Food.js';
import LogEntry from '../models/LogEntry.js';
import { ah, HttpError, localDate, meal } from '../lib/http.js';
import { addMacros, round1, roundMacros, scalePer100, zeroMacros } from '../lib/macros.js';
import { resolveGrams } from '../lib/portion.js';

const r = Router();

r.get('/', ah(async (req, res) => {
  const date = localDate(req.query.date);
  const entries = await LogEntry.find({ user: req.userId, date }).sort({ createdAt: 1 });
  const totals = roundMacros(entries.reduce((acc, e) => addMacros(acc, e.macros), zeroMacros()));
  res.json({ date, entries, totals });
}));

/** Daily totals for a date range (inclusive), for the history chart. */
r.get('/history', ah(async (req, res) => {
  const from = localDate(req.query.from);
  const to = localDate(req.query.to);
  const days = await LogEntry.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(req.userId), date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$date',
        calories: { $sum: '$macros.calories' },
        protein: { $sum: '$macros.protein' },
        carbs: { $sum: '$macros.carbs' },
        fat: { $sum: '$macros.fat' },
        fiber: { $sum: '$macros.fiber' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  res.json({ days: days.map(({ _id, ...m }) => ({ date: _id, ...roundMacros(m) })) });
}));

r.post('/', ah(async (req, res) => {
  const base = { user: req.userId, date: localDate(req.body.date), meal: meal(req.body.meal) };

  if (req.body.kind === 'food') {
    const food = await Food.findById(req.body.foodId);
    if (!food) throw new HttpError(404, 'Food not found');
    const grams = round1(resolveGrams(req.body, { servingSizeG: food.servingSizeG }));
    const entry = await LogEntry.create({
      ...base,
      kind: 'food',
      food: food._id,
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      grams,
      macros: roundMacros(scalePer100(food.per100g, grams)),
    });
    return res.status(201).json({ entry });
  }

  if (req.body.kind === 'quick') {
    const entry = await LogEntry.create({
      ...base,
      kind: 'quick',
      name: String(req.body.name || '').trim() || 'Quick add',
      macros: roundMacros(req.body.macros || {}),
    });
    return res.status(201).json({ entry });
  }

  throw new HttpError(400, 'kind must be food or quick (use /batches/:id/eat for active foods)');
}));

r.patch('/:id', ah(async (req, res) => {
  const entry = await LogEntry.findOne({ _id: req.params.id, user: req.userId });
  if (!entry) throw new HttpError(404, 'Entry not found');
  if (req.body.meal) entry.meal = meal(req.body.meal);
  if (req.body.date) entry.date = localDate(req.body.date);
  await entry.save();
  res.json({ entry });
}));

/** Removing a portion eaten from an active food puts it back. */
r.delete('/:id', ah(async (req, res) => {
  const entry = await LogEntry.findOne({ _id: req.params.id, user: req.userId });
  if (!entry) throw new HttpError(404, 'Entry not found');
  let batch = null;
  if (entry.kind === 'batch' && entry.batch && entry.grams) {
    batch = await Batch.findOneAndUpdate(
      { _id: entry.batch, user: req.userId, status: { $in: ['active', 'finished'] } },
      {
        $inc: { remainingG: entry.grams },
        $set: { status: 'active' },
        $push: { events: { type: 'restore', grams: entry.grams, log: entry._id } },
      },
      { new: true },
    );
  }
  await entry.deleteOne();
  res.json({ ok: true, batch });
}));

export default r;
