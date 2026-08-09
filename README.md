# urlo-be

## Description

Backend for urlo, built with [NestJS](https://nestjs.com/) and TypeScript.

Current status: initial scaffolding. The application boots with:

- **Config** — typed, environment-aware configuration loaded from `config.<env>.json` files (see `config.example.json`).
- **Database** — MySQL via TypeORM (`@nestjs/typeorm`), auto-loading entities with `synchronize` off by default.
- **Migrations** — a lightweight SQL migration runner. `.sql` files placed in `migrations/` are applied in alphabetical order on startup, tracked in a `schema_migrations` table (in a separate `migrationDatabase`) with hash verification.
- **Health check** — `GET /` returns `{ "healthy": true }`.

No feature modules exist yet; the repository is a base to build domain modules on.

## Project structure

```text
src/
  main.ts               # bootstrap, reads host/port from config
  app.module.ts         # root module
  config/               # typed config loader (config.<env>.json)
  core/health/          # health check endpoint
  database/             # TypeORM setup + migrations runner
migrations/             # SQL migration files
config.example.json     # example config to copy into config.<env>.json
```

## Project setup

```bash
$ npm install
```

Copy the example config and adjust it to your environment:

```bash
$ cp config.example.json config.dev.json
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Lint and format

```bash
$ npm run lint
$ npm run format
```
