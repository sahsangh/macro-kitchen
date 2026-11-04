import Exercise from '../models/Exercise.js';

// [name, muscle, equipment]
const STRENGTH = [
  ['Bench Press', 'chest', 'barbell'],
  ['Incline Bench Press', 'chest', 'barbell'],
  ['Dumbbell Bench Press', 'chest', 'dumbbell'],
  ['Incline Dumbbell Press', 'chest', 'dumbbell'],
  ['Machine Chest Press', 'chest', 'machine'],
  ['Chest Fly', 'chest', 'machine'],
  ['Cable Crossover', 'chest', 'cable'],
  ['Push-up', 'chest', 'bodyweight'],
  ['Dip', 'chest', 'bodyweight'],
  ['Deadlift', 'back', 'barbell'],
  ['Pull-up', 'back', 'bodyweight'],
  ['Chin-up', 'back', 'bodyweight'],
  ['Lat Pulldown', 'back', 'cable'],
  ['Barbell Row', 'back', 'barbell'],
  ['Dumbbell Row', 'back', 'dumbbell'],
  ['Seated Cable Row', 'back', 'cable'],
  ['T-Bar Row', 'back', 'barbell'],
  ['Machine Row', 'back', 'machine'],
  ['Face Pull', 'shoulders', 'cable'],
  ['Squat', 'legs', 'barbell'],
  ['Front Squat', 'legs', 'barbell'],
  ['Hack Squat', 'legs', 'machine'],
  ['Leg Press', 'legs', 'machine'],
  ['Goblet Squat', 'legs', 'dumbbell'],
  ['Romanian Deadlift', 'legs', 'barbell'],
  ['Bulgarian Split Squat', 'legs', 'dumbbell'],
  ['Walking Lunge', 'legs', 'dumbbell'],
  ['Leg Extension', 'legs', 'machine'],
  ['Leg Curl', 'legs', 'machine'],
  ['Hip Thrust', 'legs', 'barbell'],
  ['Calf Raise', 'legs', 'machine'],
  ['Overhead Press', 'shoulders', 'barbell'],
  ['Dumbbell Shoulder Press', 'shoulders', 'dumbbell'],
  ['Arnold Press', 'shoulders', 'dumbbell'],
  ['Lateral Raise', 'shoulders', 'dumbbell'],
  ['Cable Lateral Raise', 'shoulders', 'cable'],
  ['Rear Delt Fly', 'shoulders', 'dumbbell'],
  ['Shrug', 'shoulders', 'dumbbell'],
  ['Barbell Curl', 'arms', 'barbell'],
  ['Dumbbell Curl', 'arms', 'dumbbell'],
  ['Hammer Curl', 'arms', 'dumbbell'],
  ['Preacher Curl', 'arms', 'machine'],
  ['Cable Curl', 'arms', 'cable'],
  ['Tricep Pushdown', 'arms', 'cable'],
  ['Overhead Tricep Extension', 'arms', 'cable'],
  ['Skull Crusher', 'arms', 'barbell'],
  ['Close-Grip Bench Press', 'arms', 'barbell'],
  ['Crunch', 'core', 'bodyweight'],
  ['Cable Crunch', 'core', 'cable'],
  ['Hanging Leg Raise', 'core', 'bodyweight'],
  ['Ab Wheel Rollout', 'core', 'bodyweight'],
  ['Russian Twist', 'core', 'bodyweight'],
];

// [name, MET, kcal per kg per km (when distance makes sense)]
// METs from the Compendium of Physical Activities (rounded).
const CARDIO = [
  ['Running', 9.8, 1.0],
  ['Treadmill Run', 9.8, 1.0],
  ['Walking', 3.5, 0.53],
  ['Incline Treadmill Walk', 6.0],
  ['Hiking', 6.0],
  ['Cycling', 7.5],
  ['Stationary Bike', 7.0],
  ['Elliptical', 5.0],
  ['Rowing Machine', 7.0],
  ['Stair Climber', 9.0],
  ['Swimming', 7.0],
  ['Jump Rope', 11.0],
  ['HIIT', 8.0],
  ['Boxing (bag)', 5.5],
  ['Basketball', 6.5],
  ['Soccer', 7.0],
  ['Tennis', 7.3],
  ['Dancing', 5.0],
  ['Yoga', 2.5],
  ['Pilates', 3.0],
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Insert/refresh the built-in exercises. Safe to run on every start. */
export async function ensureBuiltinExercises() {
  const ops = [
    ...STRENGTH.map(([name, muscle, equipment]) => ({ builtinKey: slug(name), name, kind: 'strength', muscle, equipment })),
    ...CARDIO.map(([name, met, kcalPerKgKm]) => ({ builtinKey: slug(name), name, kind: 'cardio', muscle: 'cardio', met, kcalPerKgKm })),
  ].map((doc) => ({ updateOne: { filter: { builtinKey: doc.builtinKey }, update: { $set: doc }, upsert: true } }));
  await Exercise.bulkWrite(ops, { ordered: false });
}
