import jwt from 'jsonwebtoken';
import { HttpError } from './http.js';

const secret = () => process.env.JWT_SECRET || 'dev-secret-change-me';

export const signToken = (userId) => jwt.sign({ sub: String(userId) }, secret(), { expiresIn: '90d' });

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Not signed in'));
  try {
    req.userId = jwt.verify(token, secret()).sub;
    next();
  } catch {
    next(new HttpError(401, 'Session expired, please sign in again'));
  }
}
