import mongoose from 'mongoose';

const SetSchema = new mongoose.Schema(
  {
    weightKg: { type: Number, min: 0 },
    reps: { type: Number, min: 0 },
    done: { type: Boolean, default: false },
  },
  { _id: false },
);

const EntrySchema = new mongoose.Schema(
  {
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['strength', 'cardio'], required: true },
    targetReps: { type: String },
    sets: [SetSchema], // strength
    durationMin: { type: Number, min: 0 }, // cardio
    distanceKm: { type: Number, min: 0 },
    calories: { type: Number, min: 0 }, // computed, or entered by the user
    caloriesManual: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * One training session. "active" while you're in the gym (autosaved),
 * "done" once finished. Calories burned feed the day's summary.
 */
const WorkoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // local YYYY-MM-DD
    name: { type: String, required: true, trim: true },
    routine: { type: mongoose.Schema.Types.ObjectId, ref: 'Routine' },
    status: { type: String, enum: ['active', 'done'], default: 'active' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    entries: [EntrySchema],
    notes: { type: String, default: '' },
    caloriesBurned: { type: Number, default: 0 },
  },
  { timestamps: true },
);

WorkoutSchema.index({ user: 1, date: -1 });
WorkoutSchema.index({ user: 1, status: 1 });
WorkoutSchema.index({ user: 1, 'entries.exercise': 1, startedAt: -1 });

export default mongoose.model('Workout', WorkoutSchema);
