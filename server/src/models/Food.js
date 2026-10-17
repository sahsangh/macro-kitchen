import mongoose from 'mongoose';
import { MacroSchema } from './shared.js';
import { guessDensity } from '../lib/density.js';

/**
 * Shared nutrition cache. Every food pulled from USDA / Open Food Facts lands
 * here so later searches and scans are served from our own DB. Custom foods
 * are private to the user who created them.
 */
const FoodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },
    barcode: { type: String, index: true, sparse: true },
    source: { type: String, enum: ['usda', 'off', 'custom'], required: true },
    sourceId: { type: String },
    per100g: { type: MacroSchema, required: true },
    servingSizeG: { type: Number },
    density: { type: Number }, // g per ml; guessed from the name when not set
    servingLabel: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    searchText: { type: String, index: true },
  },
  { timestamps: true },
);

FoodSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.density ??= guessDensity(ret.name);
    return ret;
  },
});

FoodSchema.index({ source: 1, sourceId: 1 }, { unique: true, partialFilterExpression: { sourceId: { $type: 'string' } } });

FoodSchema.pre('save', function () {
  this.searchText = `${this.name} ${this.brand || ''}`.toLowerCase();
});

export default mongoose.model('Food', FoodSchema);
