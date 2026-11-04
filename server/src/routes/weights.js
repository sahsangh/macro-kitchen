import { Router } from 'express';
import BodyWeight from '../models/BodyWeight.js';
import { ah, HttpError, localDate } from '../lib/http.js';

const r = Router();

r.get('/', ah(async (req, res) => {
  const filter = { user: req.userId };
  if (req.query.from) filter.date = { $gte: localDate(req.query.from), ...(req.query.to ? { $lte: localDate(req.query.to) } : {}) };
  res.json({ weights: await BodyWeight.find(filter).sort({ date: 1 }).limit(2000) });
}));

r.put('/:date', ah(async (req, res) => {
  const date = localDate(req.params.date);
  const weightKg = Number(req.body.weightKg);
  if (!(weightKg >= 20 && weightKg <= 400)) throw new HttpError(400, 'Enter a realistic body weight');
  const weight = await BodyWeight.findOneAndUpdate(
    { user: req.userId, date },
    { $set: { weightKg } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.json({ weight });
}));

r.delete('/:date', ah(async (req, res) => {
  await BodyWeight.deleteOne({ user: req.userId, date: localDate(req.params.date) });
  res.status(204).end();
}));

export default r;
