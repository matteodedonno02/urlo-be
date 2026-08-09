import { readFileSync } from 'fs';
import { join } from 'path';

export interface AppConfig {
  host: string;
  port: number;
  database?: {
    host: string;
    port: number;
  };
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

  return config;
};
