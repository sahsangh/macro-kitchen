import Food from '../models/Food.js';
import SearchLog from '../models/SearchLog.js';

const UA = 'CalRecipeTracker/1.0 (personal nutrition app)';
const TIMEOUT_MS = 8000;

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const titleCase = (s) =>
  s && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s\-/(])(\w)/g, (_, pre, c) => pre + c.toUpperCase()) : s;

/** Barcode variants so UPC-A (12) and EAN-13 with a leading 0 match each other. */
export function barcodeVariants(code) {
  const digits = String(code).replace(/\D/g, '');
  const bare = digits.replace(/^0+/, '');
  const set = new Set([digits, bare]);
  for (const len of [8, 12, 13, 14]) if (bare.length <= len) set.add(bare.padStart(len, '0'));
  return [...set].filter(Boolean);
}

// ---------- USDA FoodData Central ----------

const USDA_IDS = { protein: 1003, fat: 1004, carbs: 1005, fiber: 1079, kcal: 1008, kcalAtwaterGeneral: 2047, kcalAtwaterSpecific: 2048 };

function fromUsda(f) {
  const byId = Object.fromEntries((f.foodNutrients || []).map((n) => [n.nutrientId, n.value]));
  const protein = num(byId[USDA_IDS.protein]);
  const carbs = num(byId[USDA_IDS.carbs]);
  const fat = num(byId[USDA_IDS.fat]);
  const fiber = num(byId[USDA_IDS.fiber]);
  const calories =
    num(byId[USDA_IDS.kcal]) ||
    num(byId[USDA_IDS.kcalAtwaterSpecific]) ||
    num(byId[USDA_IDS.kcalAtwaterGeneral]) ||
    protein * 4 + carbs * 4 + fat * 9;
  const gramServing = ['g', 'grm', 'ml'].includes(String(f.servingSizeUnit || '').toLowerCase());
  return {
    name: titleCase(f.description),
    brand: titleCase(f.brandName || f.brandOwner) || undefined,
    barcode: f.gtinUpc || undefined,
    source: 'usda',
    sourceId: String(f.fdcId),
    per100g: { calories, protein, carbs, fat, fiber },
    servingSizeG: gramServing && f.servingSize ? num(f.servingSize) : undefined,
    servingLabel: f.householdServingFullText ? titleCase(f.householdServingFullText) : undefined,
  };
}

async function usdaSearch(query, pageSize = 15, dataType = 'Foundation,SR Legacy,Branded') {
  const key = process.env.USDA_API_KEY || 'DEMO_KEY';
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(query)}&pageSize=${pageSize}` +
    `&dataType=${encodeURIComponent(dataType)}`;
  const data = await getJson(url);
  return (data.foods || []).map(fromUsda);
}

// ---------- Open Food Facts ----------

function fromOff(p) {
  const n = p.nutriments || {};
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  const fiber = num(n.fiber_100g);
  const kcal = num(n['energy-kcal_100g']) || (n.energy_100g ? num(n.energy_100g) / 4.184 : 0);
  const brand = Array.isArray(p.brands) ? p.brands[0] : String(p.brands || '').split(',')[0];
  return {
    name: p.product_name || p.product_name_en,
    brand: brand?.trim() || undefined,
    barcode: p.code,
    source: 'off',
    sourceId: String(p.code),
    per100g: { calories: kcal || protein * 4 + carbs * 4 + fat * 9, protein, carbs, fat, fiber },
    servingSizeG: num(p.serving_quantity) || undefined,
    servingLabel: p.serving_size || undefined,
  };
}

const hasNutrition = (f) => f.name && f.per100g.calories > 0;

const OFF_FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_quantity,serving_size';

async function offBarcode(code) {
  const data = await getJson(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`);
  if (data.status !== 1 || !data.product) return null;
  const food = fromOff({ ...data.product, code: data.product.code || code });
  return hasNutrition(food) ? food : null;
}

async function offSearch(query, pageSize = 10) {
  const data = await getJson(
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=${pageSize}&fields=${OFF_FIELDS}`,
  );
  return (data.hits || []).map(fromOff).filter(hasNutrition);
}

// ---------- Cache ----------

/** Upsert remote results into our Food collection and return the stored docs. */
async function cache(foods) {
  const valid = foods.filter(hasNutrition);
  if (!valid.length) return [];
  await Food.bulkWrite(
    valid.map((f) => ({
      updateOne: {
        filter: { source: f.source, sourceId: f.sourceId },
        update: { $set: { ...f, searchText: `${f.name} ${f.brand || ''}`.toLowerCase() } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  const stored = await Food.find({ $or: valid.map((f) => ({ source: f.source, sourceId: f.sourceId })) });
  const order = new Map(valid.map((f, i) => [`${f.source}:${f.sourceId}`, i]));
  return stored.sort((a, b) => order.get(`${a.source}:${a.sourceId}`) - order.get(`${b.source}:${b.sourceId}`));
}

const queryTerms = (q) => q.toLowerCase().split(/[\s,]+/).filter(Boolean).slice(0, 6);
const matchesAll = (f, terms) => {
  const text = `${f.name} ${f.brand || ''}`.toLowerCase();
  return terms.every((t) => text.includes(t));
};

/**
 * Your own foods first, then generic USDA foods (what you cook with), then
 * branded USDA, then Open Food Facts. Within a tier, names containing more of
 * the search words — and shorter, simpler names — win.
 */
function rank(foods, query) {
  const terms = queryTerms(query);
  const tier = (f) => (f.source === 'custom' ? 0 : f.source === 'usda' ? (f.brand ? 20 : 10) : 25);
  const score = (f) => {
    const name = f.name.toLowerCase();
    const missing = terms.filter((t) => !name.includes(t)).length;
    return tier(f) + missing * 3 + Math.min(name.length, 80) / 40;
  };
  return [...foods].sort((a, b) => score(a) - score(b));
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function visibleTo(userId) {
  return { $or: [{ source: { $ne: 'custom' } }, { createdBy: userId }] };
}

/**
 * Search our DB first. Only hit the public APIs when we don't have enough
 * local matches (or the user explicitly asks to search online).
 */
export async function searchFoods(query, userId, { online = false } = {}) {
  const terms = queryTerms(query);
  if (!terms.length) return { foods: [], fetchedOnline: false };

  const local = rank(
    await Food.find({
      $and: [visibleTo(userId), ...terms.map((t) => ({ searchText: { $regex: escapeRegex(t) } }))],
    }).limit(60),
    query,
  ).slice(0, 30);

  // Already fetched this exact query from every source, or our DB already has
  // plenty of matches from other searches → no need to call the APIs.
  const key = terms.join(' ');
  const prior = await SearchLog.findOne({ q: key });
  if (!online && (prior ? prior.complete : local.length >= 8)) return { foods: local, fetchedOnline: false };

  // Generic foods (USDA Foundation / SR Legacy) first — they're what you cook with.
  const sources = await Promise.allSettled([
    usdaSearch(query, 8, 'Foundation,SR Legacy'),
    usdaSearch(query, 12, 'Branded'),
    offSearch(query),
  ]);
  // Open Food Facts search is loose; keep only hits that contain every word.
  const remote = sources.flatMap((r, i) =>
    r.status !== 'fulfilled' ? [] : i === 2 ? r.value.filter((f) => matchesAll(f, terms)) : r.value,
  );
  for (const r of sources) if (r.status === 'rejected') console.warn('[nutrition] search failed:', r.reason?.message);

  const stored = await cache(remote);
  await SearchLog.updateOne(
    { q: key },
    { $set: { complete: sources.every((r) => r.status === 'fulfilled'), at: new Date() } },
    { upsert: true },
  );
  const seen = new Set(local.map((f) => String(f._id)));
  const merged = rank([...local, ...stored.filter((f) => !seen.has(String(f._id)))], query);
  return { foods: merged.slice(0, 40), fetchedOnline: true };
}

export async function lookupBarcode(code) {
  const variants = barcodeVariants(code);
  if (!variants.length) return null;

  const local = await Food.findOne({ barcode: { $in: variants } });
  if (local) return local;

  for (const v of variants.filter((c) => c.length >= 8)) {
    try {
      const off = await offBarcode(v);
      if (off) return (await cache([off]))[0];
    } catch (e) {
      console.warn('[nutrition] OFF barcode failed:', e.message);
      break;
    }
  }

  try {
    const bare = variants.find((c) => !c.startsWith('0')) || variants[0];
    const hits = await usdaSearch(bare, 5);
    const match = hits.find((f) => f.barcode && f.barcode.replace(/^0+/, '') === bare.replace(/^0+/, ''));
    if (match) return (await cache([{ ...match, barcode: variants[0] }]))[0];
  } catch (e) {
    console.warn('[nutrition] USDA barcode failed:', e.message);
  }
  return null;
}
