import { applyEnvOverrides } from './configuration';
import { AppConfig } from '../models/app-config';

const originalEnv = process.env;

const base: Partial<AppConfig> = {
  host: '0.0.0.0',
  port: 3000,
  apiBaseUrl: 'http://default',
  cors: { whitelist: [] },
  jwt: { secret: 'secret', expiresIn: '10s', refreshExpiresIn: '1m' },
  database: {
    host: '127.0.0.1',
    port: 3306,
    name: 'urlo',
    alwaysRebuild: true,
  },
};

describe('applyEnvOverrides', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('matches camelCase config keys case- and underscore-insensitively', () => {
    process.env.API_BASE_URL = 'http://overridden';
    process.env.JWT__REFRESH_EXPIRES_IN = '7d';

    const result = applyEnvOverrides({ ...base });

    expect(result.apiBaseUrl).toBe('http://overridden');
    expect(result.jwt?.refreshExpiresIn).toBe('7d');
  });

  it('descends nesting levels with __', () => {
    process.env.DATABASE__HOST = 'mysql';

    const result = applyEnvOverrides({ ...base });

    expect(result.database?.host).toBe('mysql');
  });

  it('coerces values to the type of the overridden key', () => {
    process.env.PORT = '4000';
    process.env.DATABASE__PORT = '3307';
    process.env.DATABASE__ALWAYS_REBUILD = 'false';

    const result = applyEnvOverrides({ ...base });

    expect(result.port).toBe(4000);
    expect(result.database?.port).toBe(3307);
    expect(result.database?.alwaysRebuild).toBe(false);
  });

  it('parses JSON for array and object values', () => {
    process.env.CORS__WHITELIST = '["http://localhost:3001"]';

    const result = applyEnvOverrides({ ...base });

    expect(result.cors?.whitelist).toEqual(['http://localhost:3001']);
  });

  it('keeps the existing value when a number override is not numeric', () => {
    process.env.PORT = 'not-a-number';

    const result = applyEnvOverrides({ ...base });

    expect(result.port).toBe(3000);
  });

  it('does not add keys that do not exist in the config', () => {
    process.env.FOO__BAR = 'baz';
    process.env.MY_ENV = 'whatever';

    const result = applyEnvOverrides({ ...base });

    expect('foo' in result).toBe(false);
    expect('myEnv' in result).toBe(false);
  });

  it('does not mutate the original config object', () => {
    process.env.DATABASE__HOST = 'mysql';

    const snapshot = structuredClone(base);
    applyEnvOverrides({ ...base });

    expect(base).toEqual(snapshot);
  });
});
