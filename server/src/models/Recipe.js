import mongoose from 'mongoose';
import { MacroSchema } from './shared.js';

const IngredientSchema = new mongoose.Schema({
  food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
  name: { type: String, required: true },
  grams: { type: Number, required: true, min: 0 },
  // Snapshot so the recipe never changes if the cached food is edited.
  per100g: { type: MacroSchema, required: true },
});

const ExtraSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: String, default: '' },
});

const RecipeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    ingredients: [IngredientSchema],
    extras: [ExtraSchema], // spices etc. with no macros
    servings: { type: Number, required: true, min: 0.01 },
    totalWeightG: { type: Number, required: true, min: 1 }, // finished (cooked) weight
    totals: { type: MacroSchema, required: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.model('Recipe', RecipeSchema);
