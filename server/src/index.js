import mongoose from 'mongoose';
import { createApp } from './app.js';
import { loadEnv } from './lib/env.js';

loadEnv();

const { MONGODB_URI, PORT = 4000 } = process.env;

async function main() {
  let uri = MONGODB_URI;
  if (!uri || uri === 'memory') {
    // Throwaway in-memory DB for trying things out; data is lost on restart.
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    uri = (await MongoMemoryServer.create()).getUri('calrecipe');
    console.warn('⚠️  MONGODB_URI not set — using an in-memory database (data will NOT persist).');
  }
  if (!process.env.JWT_SECRET) console.warn('⚠️  JWT_SECRET not set — using an insecure dev secret.');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
  createApp().listen(PORT, '0.0.0.0', () => console.log(`API listening on http://0.0.0.0:${PORT}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
