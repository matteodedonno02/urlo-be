import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import { createConnection } from 'mysql2/promise';
import { MigrationsService } from './migrations.service';

jest.mock('fs');
jest.mock('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'root',
  name: 'urlo',
};

describe('MigrationsService', () => {
  let service: MigrationsService;
  let migConn: { query: jest.Mock; end: jest.Mock };
  let appConn: {
    query: jest.Mock;
    end: jest.Mock;
    beginTransaction: jest.Mock;
    commit: jest.Mock;
    rollback: jest.Mock;
  };
  let serverConn: { query: jest.Mock; end: jest.Mock };

  const makeModule = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'database' || key === 'migrationDatabase'
                ? dbConfig
                : undefined,
            ),
          },
        },
      ],
    }).compile();
    return module.get<MigrationsService>(MigrationsService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    migConn = {
      query: jest.fn().mockResolvedValue([[]]),
      end: jest.fn().mockResolvedValue(undefined),
    };
    appConn = {
      query: jest.fn().mockResolvedValue([[]]),
      end: jest.fn().mockResolvedValue(undefined),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    serverConn = {
      query: jest.fn().mockResolvedValue([[]]),
      end: jest.fn().mockResolvedValue(undefined),
    };
    (createConnection as jest.Mock).mockReset();
    (createConnection as jest.Mock)
      .mockReturnValueOnce(serverConn)
      .mockReturnValueOnce(serverConn)
      .mockReturnValueOnce(appConn)
      .mockReturnValueOnce(migConn);
  });

  it('creates both databases if they do not exist', async () => {
    (readdirSync as jest.Mock).mockReturnValue([]);
    service = await makeModule();

    await service.onApplicationBootstrap();

    expect(serverConn.query).toHaveBeenCalledTimes(2);
    expect(serverConn.query).toHaveBeenCalledWith(
      'CREATE DATABASE IF NOT EXISTS `urlo` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );
    expect(serverConn.end).toHaveBeenCalledTimes(2);
  });

  it('executes a new migration and registers it with the file hash', async () => {
    (readdirSync as jest.Mock).mockReturnValue(['001_create.sql']);
    (readFileSync as jest.Mock).mockReturnValue('CREATE TABLE t (id INT);');
    service = await makeModule();

    await service.onApplicationBootstrap();

    expect(appConn.beginTransaction).toHaveBeenCalled();
    expect(appConn.query).toHaveBeenCalledWith('CREATE TABLE t (id INT);');
    expect(appConn.commit).toHaveBeenCalled();
    expect(appConn.rollback).not.toHaveBeenCalled();
    expect(migConn.query).toHaveBeenCalledWith(
      'INSERT INTO schema_migrations (filename, hash) VALUES (?, ?)',
      ['001_create.sql', expect.any(String)],
    );
    expect(migConn.end).toHaveBeenCalled();
    expect(appConn.end).toHaveBeenCalled();
  });

  it('rolls back and runs the down SQL when a migration fails', async () => {
    (readdirSync as jest.Mock).mockReturnValue(['001_create.sql']);
    (readFileSync as jest.Mock).mockImplementation((path: string) =>
      path.includes('down') ? 'DROP TABLE t;' : 'CREATE TABLE t (id INT);',
    );
    appConn.query.mockRejectedValueOnce(new Error('boom'));
    service = await makeModule();

    await expect(service.onApplicationBootstrap()).rejects.toThrow('boom');

    expect(appConn.beginTransaction).toHaveBeenCalled();
    expect(appConn.rollback).toHaveBeenCalled();
    expect(appConn.query).toHaveBeenCalledWith('DROP TABLE t;');
    expect(migConn.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO'),
    );
  });

  it('does not run a down SQL when the migration fails without one', async () => {
    (readdirSync as jest.Mock).mockReturnValue(['001_create.sql']);
    (readFileSync as jest.Mock).mockImplementation((path: string) =>
      path.includes('down') ? '' : 'CREATE TABLE t (id INT);',
    );
    appConn.query.mockRejectedValueOnce(new Error('boom'));
    service = await makeModule();

    await expect(service.onApplicationBootstrap()).rejects.toThrow('boom');

    expect(appConn.rollback).toHaveBeenCalled();
    expect(appConn.query).not.toHaveBeenCalledWith('');
  });

  it('skips an already-executed migration when the hash matches', async () => {
    (readdirSync as jest.Mock).mockReturnValue(['001_create.sql']);
    (readFileSync as jest.Mock).mockReturnValue('CREATE TABLE t (id INT);');
    const hash = createHash('sha256')
      .update('CREATE TABLE t (id INT);')
      .digest('hex');
    migConn.query.mockImplementation((q: string) => {
      if (q.startsWith('SELECT hash')) return [[{ hash }]];
      return [[]];
    });
    service = await makeModule();

    await service.onApplicationBootstrap();

    expect(appConn.query).not.toHaveBeenCalled();
    expect(migConn.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO'),
    );
  });

  it('throws when the registered hash does not match the file hash', async () => {
    (readdirSync as jest.Mock).mockReturnValue(['001_create.sql']);
    (readFileSync as jest.Mock).mockReturnValue('CREATE TABLE t (id INT);');
    migConn.query.mockImplementation((q: string) => {
      if (q.startsWith('SELECT hash')) return [[{ hash: 'different' }]];
      return [[]];
    });
    service = await makeModule();

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      'hash mismatch',
    );
  });

  it('destroys all app tables and resets history when alwaysRebuild is enabled', async () => {
    (readdirSync as jest.Mock).mockReturnValue(['001_create.sql']);
    (readFileSync as jest.Mock).mockReturnValue('CREATE TABLE t (id INT);');
    appConn.query.mockResolvedValueOnce([[{ name: 'short_urls' }]]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'database.alwaysRebuild') {
                return true;
              }
              if (key === 'database') {
                return { ...dbConfig, alwaysRebuild: true };
              }
              if (key === 'migrationDatabase') {
                return dbConfig;
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();
    service = module.get<MigrationsService>(MigrationsService);

    await service.onApplicationBootstrap();

    expect(appConn.query).toHaveBeenCalledWith(
      'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      ['urlo'],
    );
    expect(appConn.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP TABLE IF EXISTS `short_urls`'),
    );
    expect(migConn.query).toHaveBeenCalledWith('DELETE FROM schema_migrations');
    expect(appConn.query).toHaveBeenCalledWith('CREATE TABLE t (id INT);');
  });

  it('skips migrations when migrationDatabase is not configured', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationsService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();
    service = module.get<MigrationsService>(MigrationsService);

    await service.onApplicationBootstrap();

    expect(createConnection).not.toHaveBeenCalled();
  });
});
