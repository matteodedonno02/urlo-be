# AGENTS.md

Guidance for AI coding agents working in this NestJS repository. Follow these conventions when creating, editing, or reviewing code.

## Project Structure

```text
src/
  main.ts
  app.module.ts
  core/          # app-wide infra: auth, redis, mail, logger (global setup)
  common/        # generic reusable pipes, decorators, types, interceptors
  config/        # @nestjs/config + typed env mapping
  database/      # migrations, seeds, ORM config
  models/        # shared interfaces/classes other than DTOs and entities
  modules/       # feature/domain modules (vertical slices)
  integrations/  # external/internal API clients (Stripe, AWS, etc.)
  events/        # domain event publishers/listeners
  commands/      # CLI jobs, cron tasks
test/            # e2e tests (*.e2e-spec.ts)
```

- Put business logic in `modules/`, one folder per domain (e.g. `modules/users`).
- Only `core`, `common`, `config`, `database` hold cross-cutting infrastructure — do not put domain logic there.
- Do not create a top-level `controllers/` or `services/` split across the repo; group by feature instead.
- Any interface or class that is not a DTO, entity, controller, service, or module goes in the generic `src/models/` folder — not per-module or per-subfolder `models/` folders.

## Feature Module Layout

Each module under `src/modules/<feature>/` should look like:

```text
<feature>.module.ts
<feature>.controller.ts
<feature>.service.ts
<feature>.service.spec.ts
dto/
  create-<feature>.dto.ts
  update-<feature>.dto.ts
entities/
  <feature>.entity.ts
repositories/   # optional, if using an explicit repository layer
```

Keep the module self-contained: adding, moving, or deleting a feature should mean touching one folder.

## Migration System

Schema changes go through the migration system under `migrations/` (applied automatically by `src/database/migrations/migrations.service.ts` on app bootstrap) — never execute migration files directly or one-off.

When a schema change is needed:

1. **Create a `.sql` migration file** in `migrations/` describing the change. Files are applied in alphabetical order on startup, so name them with a sortable prefix (e.g. `0001_xxx.sql`, `0002_yyy.sql`).
2. **Create the matching TypeORM entity model if not exists, if it exists update it** so the ORM model and the SQL schema stay in sync (the app uses `autoLoadEntities`; `synchronize` is not a substitute for a migration).
3. **Never alter an already-applied migration file** — its hash is recorded in `schema_migrations` and a mismatch throws at startup. Always ship a new `.sql` file instead.
4. Keep SQL parameterized/safe; DDL files are plain SQL, but never string-concatenate values into them.

The migration runner itself (`src/database/migrations/`) is infrastructure — don't add domain logic there.

## Naming Conventions

- Domain folders: singular (`user/`, `order/`). Reusable/utility folders: plural (`pipes/`, `utils/`).
- Services: `[name].service.ts`
- Modules: `[name].module.ts`
- DTOs: `[action]-[entity].dto.ts` (e.g. `create-user.dto.ts`)
- Guards/pipes/interceptors: `[name].guard.ts`, `[name].pipe.ts`, `[name].interceptor.ts`
- Unit tests: co-located, `[name].spec.ts`
- E2E tests: `test/*.e2e-spec.ts`

## Coding Rules

1. **Thin controllers.** Controllers only handle HTTP concerns (routing, status codes, request/response shape). No business logic.
2. **Business logic in services.** Services own application logic; use repositories or ORM services for persistence, per SRP.
3. **Never instantiate manually.** Always use Nest's DI container — inject via constructor.
4. **DTOs ≠ entities.** DTOs (in `dto/`) are API contracts validated with `class-validator`. Entities (in `entities/`) are ORM-mapped persistence models. Never return entities directly from controllers.
5. **Validate everything.** Route inputs go through `ValidationPipe` (global or per-route).
6. **No hardcoded config/secrets.** Use `@nestjs/config` and `.env`; add new keys to the typed config schema.
7. **Centralized error handling.** Use global exception filters; don't catch-and-swallow errors ad hoc in controllers.
8. **Parameterize all raw SQL.** Never string-concatenate queries.
9. **Prefer cursor-based pagination** for large/list endpoints over plain offset/limit.
10. **Keep `shared`/`libs` folders generic.** Domain-specific code does not belong there.

## Testing Requirements

- New services and non-trivial logic require unit tests using `@nestjs/testing`.
- New/changed endpoints require or update `supertest`-based e2e tests under `test/`.
- Run the existing test suite before proposing changes as complete; don't leave failing tests.

## Before Submitting a Change

- Scaffold new modules/controllers/services with the Nest CLI conventions rather than freehand files, to keep structure consistent.
- Remove unused code, imports, and dependencies introduced or found along the way.
- Confirm CORS/guard rules aren't loosened unintentionally.
- If touching a shared/global module, verify only what's needed is exported — avoid growing a catch-all shared module.

## When Unsure

If a task doesn't clearly fit an existing module, or spans multiple domains, prefer creating a new feature module over adding to `common`/`core`, and flag the ambiguity rather than guessing at ownership.