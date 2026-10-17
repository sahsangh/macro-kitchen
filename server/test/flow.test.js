import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';

let mongo, server, base, token;
const date = '2026-10-08';

async function api(method, path, body, auth = true) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('test'));
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});

test('auth', async () => {
  const reg = await api('POST', '/auth/register', { name: 'Sam', username: 'Sam_1', password: 'secret1' });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.username, 'sam_1');
  assert.equal((await api('POST', '/auth/register', { name: 'X', username: 'sam_1', password: 'secret1' })).status, 409);
  assert.equal((await api('POST', '/auth/login', { username: 'sam_1', password: 'nope' })).status, 401);
  const login = await api('POST', '/auth/login', { username: 'SAM_1', password: 'secret1' });
  assert.equal(login.status, 200);
  token = login.data.token;
  assert.equal((await api('GET', '/recipes', null, false)).status, 401);
  const me = await api('PATCH', '/auth/me', { goals: { protein: 180, fiber: 35 } });
  assert.equal(me.data.user.goals.protein, 180);
  assert.equal(me.data.user.goals.fiber, 35);
});

test('recipe → batch → eat by grams/servings/fraction → discard', async () => {
  const rice = (await api('POST', '/foods', { name: 'Rice', macros: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 } })).data.food;
  const chicken = (await api('POST', '/foods', { name: 'Chicken', macros: { calories: 165, protein: 31, carbs: 0, fat: 3.6 }, servingSizeG: 120 })).data.food;

  const search = await api('GET', '/foods/search?q=chick');
  assert.ok(search.data.foods.some((f) => f._id === chicken._id));

  const recipe = (await api('POST', '/recipes', {
    name: 'Chicken & Rice',
    servings: 5,
    totalWeightG: 500,
    ingredients: [
      { food: rice._id, name: rice.name, grams: 300, per100g: rice.per100g },
      { food: chicken._id, name: chicken.name, grams: 200, per100g: chicken.per100g },
    ],
    extras: [{ name: 'Cumin', amount: '1 tsp' }, { name: '' }],
  })).data.recipe;
  assert.equal(recipe.totals.calories, 720); // 390 + 330
  assert.equal(recipe.totals.fiber, 1.2); // 300 g rice × 0.4/100
  assert.equal(recipe.extras.length, 1);

  const batch = (await api('POST', `/recipes/${recipe._id}/cook`, { totalWeightG: 450 })).data.batch;
  assert.equal(batch.remainingG, 450);
  assert.equal(batch.servings, 5);

  // 1 serving = 90 g of a 450 g batch = 1/5 of 720 kcal
  let r = await api('POST', `/batches/${batch._id}/eat`, { servings: 1, date, meal: 'lunch' });
  assert.equal(r.status, 201);
  assert.equal(r.data.entry.grams, 90);
  assert.equal(r.data.entry.macros.calories, 144);
  assert.equal(r.data.entry.macros.fiber, 0.2);
  assert.equal(r.data.batch.remainingG, 360);

  r = await api('POST', `/batches/${batch._id}/eat`, { fraction: 1 / 3, date });
  assert.equal(r.data.entry.grams, 150);
  assert.equal(r.data.batch.remainingG, 210);

  r = await api('POST', `/batches/${batch._id}/eat`, { grams: 10, date });
  assert.equal(r.data.batch.remainingG, 200);
  assert.equal((await api('POST', `/batches/${batch._id}/eat`, { grams: 500, date })).status, 400);

  // Deleting a diary entry puts the food back
  await api('DELETE', `/logs/${r.data.entry._id}`);
  assert.equal((await api('GET', `/batches/${batch._id}`)).data.batch.remainingG, 210);

  const day = (await api('GET', `/logs?date=${date}`)).data;
  assert.equal(day.entries.length, 2);
  assert.equal(day.totals.calories, 384); // 144 + 240

  r = await api('POST', `/batches/${batch._id}/discard`, { grams: 10 });
  assert.equal(r.data.batch.remainingG, 200);
  assert.equal(r.data.batch.status, 'active');
  r = await api('POST', `/batches/${batch._id}/discard`, { all: true });
  assert.equal(r.data.batch.status, 'discarded');
  assert.equal((await api('GET', '/batches')).data.batches.length, 0);
  assert.equal((await api('GET', '/batches?status=discarded')).data.batches.length, 1);
});

test('eating the rest finishes the batch; food log by servings', async () => {
  const b = (await api('POST', '/batches', { name: 'Yogurt tub', totalWeightG: 500, servings: 2, totals: { calories: 300, protein: 50 } })).data.batch;
  const r = await api('POST', `/batches/${b._id}/eat`, { fraction: 1, date });
  assert.equal(r.data.batch.status, 'finished');
  // undo reactivates
  await api('DELETE', `/logs/${r.data.entry._id}`);
  assert.equal((await api('GET', `/batches/${b._id}`)).data.batch.status, 'active');

  const egg = (await api('POST', '/foods', { name: 'Egg', basisG: 50, servingSizeG: 50, macros: { calories: 72, protein: 6.3, fat: 4.8 } })).data.food;
  assert.equal(egg.per100g.calories, 144);
  const e = await api('POST', '/logs', { kind: 'food', foodId: egg._id, servings: 2, date, meal: 'breakfast' });
  assert.equal(e.data.entry.macros.calories, 144);
  // Liquids: nutrition per 100 ml, serving in ml, density guessed from the name.
  const oil = (await api('POST', '/foods', { name: 'Olive oil', basis: 100, basisUnit: 'ml', servingSize: 15, servingUnit: 'ml', macros: { calories: 828, fat: 92 } })).data.food;
  assert.equal(oil.density, 0.92);
  assert.equal(Math.round(oil.per100g.calories), 900); // 828 kcal per 92 g
  assert.equal(oil.servingSizeG, 13.8);
  assert.equal(oil.servingLabel, '15 ml');
  assert.equal((await api('POST', '/foods', { name: 'Oat drink', macros: { calories: 45 } })).data.food.density, 1);

  const recent = await api('GET', '/foods/recent');
  assert.equal(recent.data.foods[0]._id, egg._id);
});

test('users cannot see each other\'s data', async () => {
  const mine = token;
  token = (await api('POST', '/auth/register', { name: 'Other', username: 'other', password: 'secret1' })).data.token;
  assert.equal((await api('GET', '/recipes')).data.recipes.length, 0);
  assert.equal((await api('GET', '/foods/search?q=chick')).data.foods.filter((f) => f.source === 'custom').length, 0);
  token = mine;
});
