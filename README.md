<p align="center">
  <img src="logo.png" alt="urlo logo" width="120" />
</p>

# urlo-be

## Description

Backend for urlo, built with [NestJS](https://nestjs.com/) and TypeScript.

**Current status: initial feature set live.** The application boots with:

- **Config** — typed, environment-aware configuration loaded from `config.<env>.json` files (see `config.example.json`).
- **Database** — MySQL via TypeORM (`@nestjs/typeorm`), auto-loading entities with `synchronize` off by default. Databases are auto-created on startup if missing.
- **Migrations** — a lightweight SQL migration runner. `.sql` files placed in `migrations/` are applied in alphabetical order on startup, tracked in a `schema_migrations` table (in a separate `migrationDatabase`) with hash verification. Rollback `down/` scripts are executed on failure.
- **Health check** — `GET /` returns `{ "healthy": true }`.
- **Auth** — JWT-based authentication (`@nestjs/jwt`) with `register`, `login`, and `profile` endpoints. Passwords hashed with `bcryptjs`.
- **Roles** — `standard` / `admin` roles, enforced by `AuthGuard` (any authenticated user) and `AdminGuard` (admin only). An admin user is seeded on bootstrap from config, flagged to change password on first login.
- **Short URLs** — create, list, update, and delete short links; public resolution redirects to the original URL and tracks visit counts.

## Feature modules

| Module | Description |
| ------ | ----------- |
| `core/health` | Health check endpoint |
| `modules/auth` | Register, login, JWT profile, guards |
| `modules/user` | User entity and lookup service |
| `modules/short-url` | Short link CRUD + public resolution |
| `modules/admin` | Admin APIs + admin bootstrap seed |

## API overview

- `GET /` — health check
- `POST /auth/register`, `POST /auth/login`, `GET /auth/profile` (protected)
- `POST /short-urls`, `GET /short-urls` (admin), `GET /short-urls/my`, `PATCH /short-urls/:id`, `DELETE /short-urls/:id`
- `GET /:shortCode` — public redirect to the original URL
- `GET /users`, `GET /users/:id`, `GET /users/:id/short-urls`, `PATCH /password` (admin)

## Project structure

```text
src/
  main.ts               # bootstrap, CORS, global validation pipe
  app.module.ts         # root module
  config/               # typed config loader (config.<env>.json)
  models/               # shared interfaces/enums (config, roles, JWT payload)
  core/health/          # health check endpoint
  database/             # TypeORM setup + migrations runner
  modules/
    auth/               # JWT auth, guards
    user/               # users
    short-url/          # short links
    admin/              # admin APIs + seed
migrations/             # SQL migration files (+ down/ rollbacks)
test/                   # e2e tests (*.e2e-spec.ts)
config.example.json     # example config to copy into config.<env>.json
logo.png                # project logo
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
