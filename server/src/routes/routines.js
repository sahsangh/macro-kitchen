import { Router } from 'express';
import Exercise from '../models/Exercise.js';
import Routine from '../models/Routine.js';
import { ah, HttpError } from '../lib/http.js';

const r = Router();

async function parse(body, userId) {
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'Routine name is required');
  const ids = (body.exercises || []).map((x) => x.exercise);
  const found = await Exercise.find({ _id: { $in: ids }, $or: [{ createdBy: { $exists: false } }, { createdBy: userId }] });
  const byId = new Map(found.map((e) => [String(e._id), e]));
  const exercises = (body.exercises || [])
    .filter((x) => byId.has(String(x.exercise)))
    .map((x) => {
      const ex = byId.get(String(x.exercise));
      return { exercise: ex._id, name: ex.name, kind: ex.kind, sets: Math.min(Math.max(Number(x.sets) || 3, 1), 20), reps: String(x.reps || '8-12') };
    });
  return { name, exercises };
}

const own = async (req) => {
  const routine = await Routine.findOne({ _id: req.params.id, user: req.userId });
  if (!routine) throw new HttpError(404, 'Routine not found');
  return routine;
};

r.get('/', ah(async (req, res) => {
  res.json({ routines: await Routine.find({ user: req.userId }).sort({ lastUsedAt: -1, updatedAt: -1 }) });
}));
r.get('/:id', ah(async (req, res) => res.json({ routine: await own(req) })));
r.post('/', ah(async (req, res) => {
  res.status(201).json({ routine: await Routine.create({ ...(await parse(req.body, req.userId)), user: req.userId }) });
}));
r.put('/:id', ah(async (req, res) => {
  const routine = await own(req);
  routine.set(await parse(req.body, req.userId));
  await routine.save();
  res.json({ routine });
}));
r.delete('/:id', ah(async (req, res) => {
  await (await own(req)).deleteOne();
  res.status(204).end();
}));

export default r;
