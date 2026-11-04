import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { ensureBuiltinExercises } from '../src/lib/exerciseLibrary.js';

let mongo, server, base, token;
const date = '2026-11-03';

async function api(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: res.status === 204 ? null : await res.json() };
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('workouts'));
  await ensureBuiltinExercises();
  await ensureBuiltinExercises(); // idempotent
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  token = (await api('POST', '/auth/register', { name: 'Lifter', username: 'lifter', password: 'secret1' })).data.token;
});
after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});

const find = async (q, kind) => (await api('GET', `/exercises?q=${encodeURIComponent(q)}&kind=${kind}`)).data.exercises[0];

test('settings, body weight, exercise library', async () => {
  const me = await api('PATCH', '/auth/me', { settings: { weightUnit: 'kg', addExerciseCalories: true } });
  assert.deepEqual(me.data.user.settings, { weightUnit: 'kg', addExerciseCalories: true });

  await api('PUT', '/weights/2026-11-01', { weightKg: 81 });
  await api('PUT', '/weights/2026-11-02', { weightKg: 80 });
  await api('PUT', '/weights/2026-11-02', { weightKg: 80 }); // upsert, not duplicate
  assert.equal((await api('PUT', '/weights/2026-11-02', { weightKg: 5 })).status, 400);
  assert.equal((await api('GET', '/weights?from=2026-10-01')).data.weights.length, 2);

  const all = (await api('GET', '/exercises')).data.exercises;
  assert.ok(all.length >= 70);
  const custom = (await api('POST', '/exercises', { name: 'Sled Push', kind: 'strength', muscle: 'legs' })).data.exercise;
  assert.ok((await api('GET', '/exercises?q=sled')).data.exercises.some((e) => e._id === custom._id));
});

test('routine → live workout → finish, with previous sets and PRs', async () => {
  const bench = await find('bench press', 'strength');
  const row = await find('barbell row', 'strength');
  const routine = (await api('POST', '/routines', {
    name: 'Push/Pull',
    exercises: [{ exercise: bench._id, sets: 3, reps: '5' }, { exercise: row._id, sets: 2 }],
  })).data.routine;
  assert.equal(routine.exercises[0].name, 'Bench Press');

  let w = (await api('POST', '/workouts', { routineId: routine._id, date })).data.workout;
  assert.equal(w.status, 'active');
  assert.equal(w.entries[0].sets.length, 3);
  const second = await api('POST', '/workouts', { date });
  assert.equal(second.status, 409);
  assert.equal(second.data.workoutId, w._id);
  assert.equal((await api('GET', '/workouts/active')).data.workout._id, w._id);

  // Autosave: two bench sets done, one not; row untouched.
  w.entries[0].sets = [
    { weightKg: 100, reps: 5, done: true },
    { weightKg: 100, reps: 4, done: true },
    { weightKg: 100, reps: 0, done: false },
  ];
  w = (await api('PUT', `/workouts/${w._id}`, { entries: w.entries })).data.workout;
  w = (await api('POST', `/workouts/${w._id}/finish`, {})).data.workout;
  assert.equal(w.status, 'done');
  assert.equal(w.entries.length, 1, 'untouched exercise dropped');
  assert.equal(w.entries[0].sets.length, 2, 'unchecked set dropped');
  // Logged in seconds → 2 sets × 3 min at MET 5 × 80 kg = 40 kcal
  assert.equal(w.caloriesBurned, 40);

  const prev = (await api('GET', `/workouts/previous?exercises=${bench._id},${row._id}`)).data.previous;
  assert.equal(prev[bench._id].sets[0].weightKg, 100);
  assert.equal(prev[row._id], undefined);

  const hist = (await api('GET', `/exercises/${bench._id}/history`)).data;
  assert.equal(hist.sessions.length, 1);
  assert.equal(Math.round(hist.bests.oneRepMax), 117); // 100 × (1 + 5/30)
  assert.equal(hist.bests.heaviest.weightKg, 100);

  assert.equal((await api('POST', '/workouts', { date })).status, 201, 'can start again after finishing');
  const empty = (await api('GET', '/workouts/active')).data.workout;
  assert.equal((await api('POST', `/workouts/${empty._id}/finish`, {})).status, 400);
  await api('DELETE', `/workouts/${empty._id}`);
});

test('cardio calories: distance-based, MET-based, manual override; day summary', async () => {
  const run = await find('running', 'cardio');
  const bike = await find('stationary bike', 'cardio');
  const logged = (await api('POST', '/workouts', {
    date,
    finish: true,
    entries: [
      { exercise: run._id, durationMin: 25, distanceKm: 5 }, // 80 kg × 5 km × 1.0 = 400
      { exercise: bike._id, durationMin: 30 }, // 7 MET × 80 kg × 0.5 h = 280
    ],
  })).data.workout;
  assert.equal(logged.status, 'done');
  assert.equal(logged.entries[0].calories, 400);
  assert.equal(logged.entries[1].calories, 280);
  assert.equal(logged.caloriesBurned, 680);

  const edited = (await api('PUT', `/workouts/${logged._id}`, {
    entries: [{ ...logged.entries[0], calories: 350, caloriesManual: true }, logged.entries[1]],
  })).data.workout;
  assert.equal(edited.caloriesBurned, 630);

  const typo = await api('POST', '/workouts', { date, finish: true, entries: [{ exercise: run._id, durationMin: 3030 }] });
  assert.equal(typo.status, 400);

  const day = (await api('GET', `/logs?date=${date}`)).data;
  assert.equal(day.exercise.burned, 40 + 630);
  assert.equal(day.exercise.workouts.length, 2);
});
