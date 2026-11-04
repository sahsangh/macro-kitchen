import mongoose from 'mongoose';

const RoutineExerciseSchema = new mongoose.Schema(
  {
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['strength', 'cardio'], required: true },
    sets: { type: Number, default: 3, min: 1, max: 20 },
    reps: { type: String, default: '8-12' }, // target, e.g. "5" or "8-12"
  },
  { _id: false },
);

const RoutineSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    exercises: [RoutineExerciseSchema],
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

export default mongoose.model('Routine', RoutineSchema);
