# Swasth — Backend

Backend API for the Swasth gym & fitness application. The mobile client is a
React Native app (Android + iOS).

## Stack

| Concern     | Choice                                    |
| ----------- | ----------------------------------------- |
| Runtime     | Node.js 20+ (developed on 25)             |
| Framework   | NestJS 11 + TypeScript                    |
| Database    | PostgreSQL 16                             |
| ORM         | Prisma 6                                  |
| Auth        | Phone OTP → JWT access + rotating refresh |
| Docs        | Swagger (`/api/docs`, non-production)     |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Generate two different secrets and paste them into .env:
openssl rand -base64 48

# 3. Start Postgres (or point DATABASE_URL at your own instance)
docker compose up -d

# 4. Create the schema
npx prisma migrate dev --name init

# 5. (Optional) seed an admin + test member
npm run db:seed

# 6. Run
npm run start:dev
```

API is served at `http://localhost:3000/api/v1`, Swagger at
`http://localhost:3000/api/docs`.

## Conventions

**Response envelope.** Every success returns
`{ "success": true, "data": ... }`; every error returns
`{ "success": false, "statusCode", "message", "errors?", "path", "timestamp" }`.
The React Native client can therefore branch on one field.

**Versioning.** URI versioning is on with a default of `v1`, so routes live
under `/api/v1/...`. Breaking changes get `@Version('2')` on the handler rather
than a new path.

**Auth is on by default.** `JwtAuthGuard` is registered globally; a route opts
out with `@Public()`. Role restrictions use `@Roles(Role.GYM_ADMIN)`.

**Validation.** Global `ValidationPipe` with `whitelist` and
`forbidNonWhitelisted` — an unexpected body field is a 400, not silently
ignored.

## Auth flow

```
POST /api/v1/auth/otp/send      { phone }
POST /api/v1/auth/otp/verify    { phone, code, platform?, pushToken? }
        → { accessToken, refreshToken, expiresIn, isNewUser, user }
POST /api/v1/auth/refresh       { refreshToken }  → new pair
POST /api/v1/auth/logout        { refreshToken }
POST /api/v1/auth/logout-all    (bearer)
```

Notes:

- Accounts are created on first successful OTP verification — there is no
  separate signup call. `isNewUser` tells the app whether to route into
  onboarding.
- OTPs are stored argon2-hashed, expire in 5 minutes, allow 5 attempts, and are
  rate limited to one per 60s and 5 sends/minute per IP.
- Refresh tokens rotate on every use and are stored hashed. Presenting an
  already-rotated token revokes the entire session family — the standard
  response to a stolen token.
- With `OTP_DEV_MODE=true` the code is returned in the send response and logged
  instead of being sent by SMS. The env validation **rejects boot** if this is
  set with `NODE_ENV=staging|production`.

## SMS

[`SmsService`](src/modules/notifications/sms.service.ts) is the single delivery
boundary and currently logs instead of sending. Wire MSG91 / Twilio / SNS into
its `send` method; no caller changes. It throws in production rather than
silently dropping a login OTP.

## Scripts

| Command                  | Purpose                          |
| ------------------------ | -------------------------------- |
| `npm run start:dev`      | Watch mode                       |
| `npm run build`          | Compile to `dist/`               |
| `npm test`               | Unit tests                       |
| `npm run lint`           | ESLint + Prettier, autofix       |
| `npm run prisma:migrate` | Create/apply a dev migration     |
| `npm run prisma:studio`  | Browse the database              |
| `npm run db:seed`        | Seed baseline users              |

## Layout

```
src/
  common/          guards, filters, interceptors, decorators, utils
  config/          typed config + Joi env validation
  modules/
    auth/          OTP issue/verify, token issue/rotate, JWT strategy
    users/         profile, onboarding, account deletion
    notifications/ SMS boundary (push to follow)
    health/        liveness + DB check
  prisma/          PrismaService (global module)
prisma/
  schema.prisma    data model
  seed.ts          baseline data
```

New features land as a module under `src/modules/` with their models appended
to `schema.prisma`.
