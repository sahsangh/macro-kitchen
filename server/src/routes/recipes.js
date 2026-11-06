import { Router } from 'express';
import Recipe from '../models/Recipe.js';
import Batch from '../models/Batch.js';
import { ah, HttpError } from '../lib/http.js';
import { MACRO_KEYS, positiveNumber, recipeTotals, roundMacros } from '../lib/macros.js';

const r = Router();

function parseRecipe(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'Recipe name is required');

  const ingredients = (body.ingredients || []).map((ing) => {
    const grams = Number(ing.grams);
    if (!ing.name || !(grams >= 0)) throw new HttpError(400, 'Each ingredient needs a name and grams');
    return { food: ing.food || undefined, name: ing.name, grams, per100g: ing.per100g || {} };
  });
  const extras = (body.extras || [])
    .filter((x) => String(x.name || '').trim())
    .map((x) => ({ name: x.name.trim(), amount: String(x.amount || '').trim() }));

  const rawWeight = ingredients.reduce((s, i) => s + i.grams, 0);
  const totalWeightG = positiveNumber(body.totalWeightG) || rawWeight;
  if (!(totalWeightG > 0)) throw new HttpError(400, 'Add ingredients or enter the total weight');

  return {
    name,
    ingredients,
    extras,
    servings: positiveNumber(body.servings) || 1,
    totalWeightG,
    totals: roundMacros(recipeTotals(ingredients)),
    notes: String(body.notes || ''),
  };
}

const cleanFolder = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);

/** Reuse an existing folder's spelling, so "dinner" joins "Dinner". */
async function matchFolder(userId, value, exclude) {
  const folder = cleanFolder(value);
  if (!folder) return '';
  const existing = await Recipe.distinct('folder', { user: userId });
  return existing.find((f) => f !== exclude && f.toLowerCase() === folder.toLowerCase()) ?? folder;
}

/** Older app builds don't send a folder; leave it unchanged for them. */
const withFolder = async (req) => {
  const data = parseRecipe(req.body);
  if (req.body.folder !== undefined) data.folder = await matchFolder(req.userId, req.body.folder);
  return data;
};

const own = async (req) => {
  const recipe = await Recipe.findOne({ _id: req.params.id, user: req.userId });
  if (!recipe) throw new HttpError(404, 'Recipe not found');
  return recipe;
};

r.get('/', ah(async (req, res) => {
  res.json({ recipes: await Recipe.find({ user: req.userId }).sort({ updatedAt: -1 }) });
}));

r.get('/:id', ah(async (req, res) => res.json({ recipe: await own(req) })));

/** Rename a folder, merge it into another, or (with an empty `to`) remove it. Recipes are kept. */
r.post('/folders/rename', ah(async (req, res) => {
  const from = cleanFolder(req.body.from);
  if (!from) throw new HttpError(400, 'Which folder?');
  const folder = await matchFolder(req.userId, req.body.to, from);
  await Recipe.updateMany({ user: req.userId, folder: from }, { $set: { folder } }, { timestamps: false }); // keep the recipes' order
  res.json({ folder });
}));

r.post('/', ah(async (req, res) => {
  const recipe = await Recipe.create({ ...(await withFolder(req)), user: req.userId });
  res.status(201).json({ recipe });
}));

r.put('/:id', ah(async (req, res) => {
  const recipe = await own(req);
  recipe.set(await withFolder(req));
  await recipe.save();
  res.json({ recipe });
}));

r.delete('/:id', ah(async (req, res) => {
  await (await own(req)).deleteOne();
  res.status(204).end();
}));

/**
 * "I cooked this": creates an active batch. The cooked weight can differ from
 * the recipe's saved weight (water loss etc.) — macros stay the same, so
 * per-gram macros are recomputed from the actual weight.
 */
r.post('/:id/cook', ah(async (req, res) => {
  const recipe = await own(req);
  const multiplier = positiveNumber(req.body.multiplier) || 1;
  const totalWeightG = positiveNumber(req.body.totalWeightG) || recipe.totalWeightG * multiplier;
  const servings = positiveNumber(req.body.servings) || recipe.servings * multiplier;
  const totals = roundMacros(Object.fromEntries(
    MACRO_KEYS.map((k) => [k, recipe.totals[k] * multiplier]),
  ));
  const batch = await Batch.create({
    user: req.userId,
    recipe: recipe._id,
    name: recipe.name,
    totalWeightG,
    servings,
    totals,
    remainingG: totalWeightG,
    events: [{ type: 'made', grams: totalWeightG }],
  });
  res.status(201).json({ batch });
}));

export default r;
