import { readFileSync } from 'fs';
import { join } from 'path';

export default () => {
  const env = process.env.NODE_ENV ?? 'dev';
  const filePath = join(process.cwd(), `config.${env}.json`);

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(readFileSync(filePath, 'utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    console.warn(`Could not load config file "${filePath}", using defaults.`);
  }

  return config;
};
