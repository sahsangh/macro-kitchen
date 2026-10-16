import mongoose from 'mongoose';
import { MacroSchema } from './shared.js';

const LogEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // user's local YYYY-MM-DD
    meal: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], default: 'snack' },
    name: { type: String, required: true },
    grams: { type: Number },
    macros: { type: MacroSchema, required: true },
    kind: { type: String, enum: ['food', 'batch', 'quick'], required: true },
    food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  },
  { timestamps: true },
);

LogEntrySchema.index({ user: 1, date: 1 });

export default mongoose.model('LogEntry', LogEntrySchema);
