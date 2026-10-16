import express from 'express';
import cors from 'cors';
import { requireAuth } from './lib/auth.js';
import authRoutes from './routes/auth.js';
import foodRoutes from './routes/foods.js';
import recipeRoutes from './routes/recipes.js';
import batchRoutes from './routes/batches.js';
import logRoutes from './routes/logs.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/auth', authRoutes);
  app.use('/foods', requireAuth, foodRoutes);
  app.use('/recipes', requireAuth, recipeRoutes);
  app.use('/batches', requireAuth, batchRoutes);
  app.use('/logs', requireAuth, logRoutes);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Not found' });
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  });
  return app;
}
