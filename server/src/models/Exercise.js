import mongoose from 'mongoose';

/**
 * Exercise library. Built-in exercises have no `createdBy`; custom ones are
 * private to their creator. Calories for cardio come from `kcalPerKgKm`
 * when a distance is logged, otherwise from `met` × body weight × time.
 */
const ExerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['strength', 'cardio'], required: true },
    muscle: { type: String }, // chest, back, legs, shoulders, arms, core, full body
    equipment: { type: String }, // barbell, dumbbell, machine, cable, bodyweight…
    met: { type: Number },
    kcalPerKgKm: { type: Number },
    builtinKey: { type: String, unique: true, sparse: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true },
);

export default mongoose.model('Exercise', ExerciseSchema);
