import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { ah, HttpError } from '../lib/http.js';
import { requireAuth, signToken } from '../lib/auth.js';
import { MACRO_KEYS, positiveNumber } from '../lib/macros.js';

const r = Router();

r.post('/register', ah(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name) throw new HttpError(400, 'Name is required');
  if (!/^[a-z0-9_.]{3,30}$/.test(username)) throw new HttpError(400, 'Username must be 3–30 letters, numbers, _ or .');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (await User.exists({ username })) throw new HttpError(409, 'That username is taken');

  const user = await User.create({ name, username, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: signToken(user._id), user: user.toPublic() });
}));

r.post('/login', ah(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) {
    throw new HttpError(401, 'Wrong username or password');
  }
  res.json({ token: signToken(user._id), user: user.toPublic() });
}));

r.get('/me', requireAuth, ah(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Account not found');
  res.json({ user: user.toPublic() });
}));

r.patch('/me', requireAuth, ah(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Account not found');
  if (req.body.name?.trim()) user.name = req.body.name.trim();
  for (const k of MACRO_KEYS) {
    const v = positiveNumber(req.body.goals?.[k]);
    if (v) user.goals[k] = Math.round(v);
  }
  await user.save();
  res.json({ user: user.toPublic() });
}));

export default r;
