# Admin API

Admin-only endpoints for inspecting users and their short URLs. All endpoints live under the `/users` prefix and are **protected by both `AuthGuard` and `AdminGuard`** — they require a valid `Bearer` token from a user whose JWT payload `role` is `admin`. Non-admin authenticated users receive `403`.

## Conventions

- Request/response bodies are JSON.
- Errors use NestJS's standard shape: `{ "statusCode": <number>, "message": <string> }`.
- Passwords are never returned by the API; user responses strip `passwordHash`.
- Users are ordered by `createdAt` descending; short URLs are ordered by `createdAt` descending.

## Endpoints

### `GET /users`

Lists all users.

**Request**

```
Authorization: Bearer <admin_access_token>
```

**Returns** — `200 OK`, an array of `UserResponseDto` (password fields stripped):

```json
[
  {
    "id": "c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09",
    "email": "user@example.com",
    "role": "standard",
    "createdAt": "2026-08-10T10:00:00.000Z",
    "updatedAt": "2026-08-10T10:00:00.000Z"
  }
]
```

**Errors**

| Status | Condition                             |
| ------ | ------------------------------------- |
| `401`  | missing, malformed, or expired token  |
| `403`  | authenticated user is not an admin    |

### `GET /users/:id`

Returns a single user's info.

**Request**

```
Authorization: Bearer <admin_access_token>
```

**Returns** — `200 OK`, a `UserResponseDto`:

```json
{
  "id": "c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09",
  "email": "user@example.com",
  "role": "standard",
  "createdAt": "2026-08-10T10:00:00.000Z",
  "updatedAt": "2026-08-10T10:00:00.000Z"
}
```

**Errors**

| Status | Condition                             |
| ------ | ------------------------------------- |
| `401`  | missing, malformed, or expired token  |
| `403`  | authenticated user is not an admin    |
| `404`  | no user with the given id             |

### `GET /users/:id/short-urls`

Lists the short URLs owned by a user, most recent first.

**Request**

```
Authorization: Bearer <admin_access_token>
```

**Returns** — `200 OK`, an array of `ShortUrlResponseDto`:

```json
[
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
]
```

**Errors**

| Status | Condition                             |
| ------ | ------------------------------------- |
| `401`  | missing, malformed, or expired token  |
| `403`  | authenticated user is not an admin    |
| `404`  | no user with the given id             |

## Using the API

```bash
# Obtain an admin token (role must be "admin" in the JWT payload)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "supersecret123"}'
# => {"access_token":"..."}

# List all users
curl http://localhost:3000/users \
  -H "Authorization: Bearer <admin_access_token>"

# Get a single user
curl http://localhost:3000/users/c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09 \
  -H "Authorization: Bearer <admin_access_token>"

# List a user's short URLs
curl http://localhost:3000/users/c3f6a2b8-9d1e-4f0a-8b7c-5e4d3c2b1a09/short-urls \
  -H "Authorization: Bearer <admin_access_token>"
```
