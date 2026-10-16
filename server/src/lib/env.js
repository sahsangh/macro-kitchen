import { existsSync, readFileSync } from 'node:fs';

/**
 * Minimal .env loader. (Node 21's process.loadEnvFile doesn't skip `#`
 * comment lines.) Real environment variables win over the file.
 */
export function loadEnv(path = new URL('../../.env', import.meta.url)) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
