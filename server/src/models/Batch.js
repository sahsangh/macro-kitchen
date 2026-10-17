import mongoose from 'mongoose';
import { MacroSchema } from './shared.js';

/**
 * An "active food": a real quantity of something you made (or bought) that
 * you eat down over several days. Portions are tracked in grams; servings
 * and percentages are converted from totalWeightG / servings.
 */
const EventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['made', 'eat', 'discard', 'restore', 'adjust'], required: true },
    grams: { type: Number, required: true },
    log: { type: mongoose.Schema.Types.ObjectId, ref: 'LogEntry' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const BatchSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
    name: { type: String, required: true },
    totalWeightG: { type: Number, required: true, min: 1 },
    servings: { type: Number, required: true, min: 0.01 },
    totals: { type: MacroSchema, required: true }, // macros of the whole batch
    remainingG: { type: Number, required: true, min: 0 },
    density: { type: Number, default: 1 }, // g per ml, for portions entered in ml
    status: { type: String, enum: ['active', 'finished', 'discarded'], default: 'active', index: true },
    events: [EventSchema],
    madeAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.model('Batch', BatchSchema);
