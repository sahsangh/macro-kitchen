import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Food from '../src/models/Food.js';
import SearchLog from '../src/models/SearchLog.js';
import { barcodeVariants, lookupBarcode, searchFoods } from '../src/services/nutrition.js';

let mongo;
const realFetch = globalThis.fetch;
const user = new mongoose.Types.ObjectId();
let calls = [];
let usdaDown = false;

const usdaFood = (fdcId, description, kcal, brandOwner) => ({
  fdcId,
  description,
  brandOwner,
  foodNutrients: [
    { nutrientId: 1008, value: kcal },
    { nutrientId: 1003, value: 10 },
    { nutrientId: 1079, value: 2.5 },
  ],
});

function fakeFetch(url) {
  calls.push(url);
  const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });
  if (url.includes('api.nal.usda.gov')) {
    if (usdaDown) return json({}, 429);
    if (url.includes('Branded')) return json({ foods: [usdaFood(2, 'EGG WHOLE RAW LARGE', 140, 'Eggland')] });
    return json({ foods: [usdaFood(1, 'Egg, whole, raw, fresh', 143)] });
  }
  if (url.includes('search.openfoodfacts.org')) {
    return json({
      hits: [
        { code: '111', product_name: 'Foie gras au poivre', brands: ['Augusta'], nutriments: { 'energy-kcal_100g': 595 } },
        { code: '222', product_name: 'Whole raw egg pack', brands: ['Farm'], nutriments: { 'energy-kcal_100g': 145 } },
      ],
    });
  }
  if (url.includes('world.openfoodfacts.org/api/v2/product/0012345678905')) {
    return json({ status: 1, product: { code: '0012345678905', product_name: 'Test Bar', brands: 'Acme', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 20, fiber_100g: 7 }, serving_quantity: 50 } });
  }
  if (url.includes('openfoodfacts')) return json({ status: 0 });
  return json({ foods: [] });
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('nutrition'));
  globalThis.fetch = fakeFetch;
});
after(async () => {
  globalThis.fetch = realFetch;
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  calls = [];
  usdaDown = false;
  await Food.deleteMany({});
  await SearchLog.deleteMany({});
});

test('generic USDA first, irrelevant Open Food Facts hits dropped, results cached', async () => {
  const r = await searchFoods('egg whole raw', user);
  assert.equal(r.fetchedOnline, true);
  assert.deepEqual(r.foods.map((f) => f.name), ['Egg, whole, raw, fresh', 'Egg Whole Raw Large', 'Whole raw egg pack']);
  assert.equal(await Food.countDocuments(), 3);
  assert.equal(r.foods[0].per100g.fiber, 2.5);

  calls = [];
  const again = await searchFoods('egg whole raw', user);
  assert.equal(again.fetchedOnline, false);
  assert.equal(calls.length, 0, 'second search is served from our DB');
  assert.equal(again.foods[0].name, 'Egg, whole, raw, fresh');
});

test('a rate-limited source is retried on the next search', async () => {
  usdaDown = true;
  const r = await searchFoods('egg whole raw', user);
  assert.deepEqual(r.foods.map((f) => f.source), ['off']);
  assert.equal((await SearchLog.findOne({ q: 'egg whole raw' })).complete, false);

  usdaDown = false;
  calls = [];
  const retry = await searchFoods('egg whole raw', user);
  assert.ok(calls.length > 0, 'calls APIs again');
  assert.equal(retry.foods[0].source, 'usda');
  assert.equal((await SearchLog.findOne({ q: 'egg whole raw' })).complete, true);
});

test('barcode: UPC-A scan matches EAN-13 product and is cached', async () => {
  assert.ok(barcodeVariants('012345678905').includes('0012345678905'));
  const food = await lookupBarcode('012345678905');
  assert.equal(food.name, 'Test Bar');
  assert.equal(food.servingSizeG, 50);
  assert.equal(food.per100g.fiber, 7);
  calls = [];
  const cached = await lookupBarcode('0012345678905');
  assert.equal(String(cached._id), String(food._id));
  assert.equal(calls.length, 0);
});
