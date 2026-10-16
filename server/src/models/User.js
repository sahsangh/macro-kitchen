import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    goals: {
      calories: { type: Number, default: 2200 },
      protein: { type: Number, default: 150 },
      carbs: { type: Number, default: 220 },
      fat: { type: Number, default: 70 },
      fiber: { type: Number, default: 30 },
    },
  },
  { timestamps: true },
);

UserSchema.methods.toPublic = function () {
  return { id: this._id, name: this.name, username: this.username, goals: this.goals };
};

export default mongoose.model('User', UserSchema);
