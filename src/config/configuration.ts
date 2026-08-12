import { readFileSync } from 'fs';
import { join } from 'path';
import { AppConfig } from '../models/app-config';

const SEPARATOR = '__';

function coerce(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function applyEnvOverrides(config: Partial<AppConfig>): Partial<AppConfig> {
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;

    const path = key
      .split(SEPARATOR)
      .map((part) => part.toLowerCase())
      .filter((part) => part.length > 0);

    if (path.length === 0) continue;

    const root = config as Record<string, unknown>;
    if (path.length === 1 && !(path[0] in root)) continue;
    let target: Record<string, unknown> = config as Record<string, unknown>;

    for (let i = 0; i < path.length - 1; i++) {
      const part = path[i];
      let next = target[part];
      if (next === undefined || typeof next !== 'object' || Array.isArray(next)) {
        next = {};
        target[part] = next;
      }
      target = next as Record<string, unknown>;
    }

    const last = path[path.length - 1];
    target[last] = coerce(value);
  }

  return config;
}

export default (): Partial<AppConfig> => {
  const env = process.env.NODE_ENV ?? 'dev';
  const filePath = join(process.cwd(), `config.${env}.json`);

  let config: Partial<AppConfig> = {};
  try {
    config = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<AppConfig>;
  } catch {
    console.warn(`Could not load config file "${filePath}", using defaults.`);
  }

  return applyEnvOverrides(config);
};
