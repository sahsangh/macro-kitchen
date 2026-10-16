import mongoose from 'mongoose';

/**
 * Remembers which search queries we've already pulled from the public APIs.
 * `complete` is false if any source failed (e.g. rate limited), so the next
 * search for that query tries again instead of trusting partial results.
 */
const SearchLogSchema = new mongoose.Schema({
  q: { type: String, required: true, unique: true },
  complete: { type: Boolean, default: false },
  at: { type: Date, default: Date.now },
});

export default mongoose.model('SearchLog', SearchLogSchema);
