import { readFileSync } from 'fs';
import { join } from 'path';
import { AppConfig } from '../models/app-config';

export default (): Partial<AppConfig> => {
  const env = process.env.NODE_ENV ?? 'dev';
  const filePath = join(process.cwd(), `config.${env}.json`);

  let config: Partial<AppConfig> = {};
  try {
    config = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<AppConfig>;
  } catch {
    console.warn(`Could not load config file "${filePath}", using defaults.`);
  }

  return config;
};
