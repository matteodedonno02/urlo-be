# API

## Auth API

JWT authentication API. All endpoints live under the `/auth` prefix.

Authentication flow: `POST /auth/register` (optional) to create an account, then `POST /auth/login` to obtain a JWT. Send the token as a `Bearer` token in the `Authorization` header on protected endpoints.

## Conventions

- Request/response bodies are JSON.
- Unknown/invalid fields in the request body are rejected (`400`) by the global `ValidationPipe` (`whitelist: true`).
- Errors use NestJS's standard shape: `{ "statusCode": <number>, "message": <string> }`.
- Passwords are never returned by the API; they are stored as bcrypt hashes.

## Endpoints

### `POST /auth/register`

Creates a new user account.

**Request body** (`CreateUserDto`)

| Field    | Type   | Constraints                    | Required |
| -------- | ------ | ------------------------------ | -------- |
| `email`  | string | valid email, max 255 chars     | yes      |
| `password` | string | min 8 chars, max 255 chars | yes      |

**Returns** — `201 Created`, a `UserResponseDto` (password fields stripped):

```json
{
  "id": "c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09",
  "email": "user@example.com",
  "createdAt": "2026-08-10T10:00:00.000Z",
  "updatedAt": "2026-08-10T10:00:00.000Z"
}
```

**Errors**

| Status | Condition                          |
| ------ | ---------------------------------- |
| `400`  | invalid email or password          |
| `409`  | email already registered           |

### `POST /auth/login`

Authenticates a user and returns a JWT access token.

**Request body** (`LoginUserDto`)

| Field      | Type   | Constraints                 | Required |
| ---------- | ------ | --------------------------- | -------- |
| `email`    | string | valid email, max 255 chars  | yes      |
| `password` | string | non-empty, max 255 chars    | yes      |

**Returns** — `200 OK`:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

The token payload is:

```json
{
  "sub": "c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09",
  "email": "user@example.com"
}
```

The token is signed with `jwt.secret` (from config) and expires after `jwt.expiresIn` (default `1h`).

**Errors**

| Status | Condition                        |
| ------ | -------------------------------- |
| `400`  | invalid request body             |
| `401`  | unknown email or wrong password  |

### `GET /auth/profile`

Returns the identity of the authenticated user. Protected by `AuthGuard` — requires a valid `Bearer` token.

**Request**

```
Authorization: Bearer <access_token>
```

**Returns** — `200 OK`, the decoded JWT payload:

```json
{
  "sub": "c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09",
  "email": "user@example.com",
  "iat": 1723291200,
  "exp": 1723294800
}
```

**Errors**

| Status | Condition                              |
| ------ | -------------------------------------- |
| `401`  | missing, malformed, or expired token   |

## Using the API

```bash
# Register a user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "supersecret123"}'

# Log in
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "supersecret123"}'
# => {"access_token":"..."}

# Access a protected endpoint
curl http://localhost:3000/auth/profile \
  -H "Authorization: Bearer <access_token>"
```

## Protecting new endpoints

Apply `AuthGuard` to any handler that should require authentication:

```typescript
@UseGuards(AuthGuard)
@Get('profile')
getProfile(@Request() req: RequestWithUser) {
  return req.user;
}
```

## Short URL API

URL shortening endpoints under the `/short-urls` prefix. Since the last change, `POST /short-urls` is **protected by `AuthGuard`** — it requires a valid `Bearer` token and attributes the created link to the authenticated user (`req.user.sub`). Short URL responses now include the owning `userId`.

### `POST /short-urls`

Creates a short URL owned by the authenticated user. Protected by `AuthGuard`.

**Request**

```
Authorization: Bearer <access_token>
```

**Request body** (`CreateShortUrlDto`)

| Field        | Type   | Constraints                                   | Required |
| ------------ | ------ | --------------------------------------------- | -------- |
| `originalUrl`| string | valid URL (TLD not required), max 2048 chars | yes      |
| `expiresAt`  | string | ISO-8601 date string                          | no       |

**Returns** — `201 Created`, a `ShortUrlResponseDto`:

```json
{
  "id": "8e2c1a5d-4f0a-4b7c-9d1e-3f0a2b1c4d5e",
  "userId": "c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09",
  "shortCode": "ab12Cd",
  "originalUrl": "https://example.com/path",
  "visitCount": 0,
  "expiresAt": null,
  "createdAt": "2026-08-10T10:00:00.000Z",
  "updatedAt": "2026-08-10T10:00:00.000Z"
}
```

The `shortCode` is auto-generated (6 chars from `[a-zA-Z0-9_-]`) and unique.

**Errors**

| Status | Condition                              |
| ------ | -------------------------------------- |
| `400`  | invalid body (bad URL, unknown fields) |
| `401`  | missing, malformed, or expired token   |
| `409`  | shortCode collision                    |

### `GET /short-urls`

Lists all short URLs, most recent first. Public (no auth).

**Returns** — `200 OK`, an array of `ShortUrlResponseDto`.

### `GET /short-urls/:shortCode`

Resolves a short code to its original URL and increments its `visitCount`.

**Returns** — `302 Found`, redirecting to `originalUrl`. `404` if the code is unknown or the link has expired.

### `PATCH /short-urls/:id`

Updates a short URL.

**Request body** (`UpdateShortUrlDto`) — all fields optional:

| Field        | Type   | Constraints                                                |
| ------------ | ------ | ---------------------------------------------------------- |
| `originalUrl`| string | valid URL, max 2048 chars                                  |
| `shortCode`  | string | 3–16 chars of `[a-zA-Z0-9_-]`                              |
| `expiresAt`  | string | ISO-8601 date string, or `null` to clear                   |

**Returns** — `200 OK`, the updated `ShortUrlResponseDto`.

**Errors**: `400` invalid body, `404` unknown id, `409` shortCode already in use.

### `DELETE /short-urls/:id`

Deletes a short URL.

**Returns** — `204 No Content`. `404` if the id is unknown.
