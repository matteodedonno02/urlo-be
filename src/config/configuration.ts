import { readFileSync } from 'fs';
import { join } from 'path';
import { AppConfig } from '../models/app-config';

const SEPARATOR = '__';

function normalizeSegment(segment: string): string {
  return segment.replace(/_/g, '').toLowerCase();
}

function coerce(current: unknown, raw: string): unknown {
  if (typeof current === 'number') {
    const num = Number(raw);
    return Number.isNaN(num) ? current : num;
  }
  if (typeof current === 'boolean') {
    return raw === 'true' || raw === '1';
  }
  if (typeof current === 'string') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function setValue(
  node: Record<string, unknown>,
  path: string[],
  raw: string,
): void {
  const key = Object.keys(node).find((k) => normalizeSegment(k) === path[0]);
  if (key === undefined) return;
  if (path.length === 1) {
    node[key] = coerce(node[key], raw);
    return;
  }
  const current = node[key];
  if (
    current !== null &&
    typeof current === 'object' &&
    !Array.isArray(current)
  ) {
    setValue(current as Record<string, unknown>, path.slice(1), raw);
  }
}

export function applyEnvOverrides(
  config: Partial<AppConfig>,
): Partial<AppConfig> {
  const result = structuredClone(config);
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    const path = name.split(SEPARATOR).map(normalizeSegment);
    if (path.length === 0 || path.some((segment) => segment === '')) continue;
    setValue(result, path, value);
  }
  return result;
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
