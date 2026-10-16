import { Router } from 'express';
import mongoose from 'mongoose';
import Food from '../models/Food.js';
import LogEntry from '../models/LogEntry.js';
import { ah, HttpError } from '../lib/http.js';
import { MACRO_KEYS } from '../lib/macros.js';
import { lookupBarcode, searchFoods } from '../services/nutrition.js';

const r = Router();

r.get('/search', ah(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ foods: [], fetchedOnline: false });
  res.json(await searchFoods(q, req.userId, { online: req.query.online === '1' }));
}));

r.get('/barcode/:code', ah(async (req, res) => {
  const food = await lookupBarcode(req.params.code);
  if (!food) throw new HttpError(404, 'No nutrition info found for this barcode. You can add it as a custom food.');
  res.json({ food });
}));

/** Foods this user logged most recently, for one-tap re-logging. */
r.get('/recent', ah(async (req, res) => {
  const rows = await LogEntry.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(req.userId), kind: 'food', food: { $ne: null } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$food', last: { $first: '$createdAt' } } },
    { $sort: { last: -1 } },
    { $limit: 15 },
  ]);
  const foods = await Food.find({ _id: { $in: rows.map((x) => x._id) } });
  const byId = new Map(foods.map((f) => [String(f._id), f]));
  res.json({ foods: rows.map((x) => byId.get(String(x._id))).filter(Boolean) });
}));

r.get('/:id', ah(async (req, res) => {
  const food = await Food.findById(req.params.id);
  if (!food || (food.source === 'custom' && String(food.createdBy) !== req.userId)) throw new HttpError(404, 'Food not found');
  res.json({ food });
}));

/** Custom food. Macros may be entered per serving or per 100 g. */
r.post('/', ah(async (req, res) => {
  const { name, brand, barcode, servingSizeG, servingLabel } = req.body;
  if (!String(name || '').trim()) throw new HttpError(400, 'Name is required');
  const basisG = Number(req.body.basisG) || 100;
  const m = req.body.macros || {};
  const per100g = {};
  for (const k of MACRO_KEYS) per100g[k] = ((Number(m[k]) || 0) * 100) / basisG;

  const food = await Food.create({
    name: String(name).trim(),
    brand: brand?.trim() || undefined,
    barcode: barcode ? String(barcode).replace(/\D/g, '') : undefined,
    source: 'custom',
    per100g,
    servingSizeG: Number(servingSizeG) || undefined,
    servingLabel: servingLabel || undefined,
    createdBy: req.userId,
  });
  res.status(201).json({ food });
}));

export default r;
