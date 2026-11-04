import mongoose from 'mongoose';

const BodyWeightSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // local YYYY-MM-DD, one entry per day
    weightKg: { type: Number, required: true, min: 20, max: 400 },
  },
  { timestamps: true },
);

BodyWeightSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model('BodyWeight', BodyWeightSchema);
