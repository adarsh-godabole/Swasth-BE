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

# 3. Start Postgres - pick one:
npm run db:start        # embedded Postgres, no Docker or sudo needed
docker compose up -d    # if you have Docker
#                       # or just point DATABASE_URL at your own instance

# 4. Create the schema (the initial migration is checked in)
npx prisma migrate deploy

# 5. Seed one gym, its owner and a front-desk admin
npm run db:seed

# 6. Run
npm run start:dev
```

API is served at `http://localhost:3000/api/v1`, Swagger at
`http://localhost:3000/api/docs`.

### Local database

`npm run db:start` runs a **real PostgreSQL server as a normal user process** —
no Docker, no sudo, no system install. The binary and data live in `.dev-db/`
(gitignored). It stays in the foreground; `npm run db:stop` stops it and
`npm run db:reset` wipes it clean.

Browse the data with `npm run prisma:studio` → <http://localhost:5555>.

### Logging in locally

With `OTP_DEV_MODE=true` the OTP is returned in the send response instead of
being sent by SMS, and `OTP_DEV_CODE=123456` fixes it to a known value. Seeded
logins, all at gym `swasth-koramangala`:

| Number          | Role at the gym       |
| --------------- | --------------------- |
| `+919999900001` | Swasth platform admin |
| `+919999900002` | Owner                 |
| `+919999900003` | Gym admin (front desk) |

Note the 60-second resend cooldown per number — asking for a second OTP too
quickly is rejected, and the first code stays valid.

## Deploying

`Dockerfile` builds an image that applies migrations on boot, so it drops
straight into Render, Railway, Fly.io or any container host. All it needs is
`DATABASE_URL` plus the JWT secrets from `.env.example`.

**[docs/deployment.md](docs/deployment.md) has step-by-step instructions** for a
free Neon + Render staging deployment. Nothing is deployed yet.

Note that `NODE_ENV=production` requires a real SMS provider in `SmsService` —
the app refuses to boot with dev OTPs in production, and would otherwise be
unable to send a login code. Deploy as `staging` until that is wired up.

## Multi-gym model

Swasth is not a self-serve SaaS, but it does hold **many gyms in one database**.
Gyms are onboarded one at a time by the Swasth team.

- **A gym is a row** (`gyms`). Onboarding gym #7 is an insert, not a deployment.
- **A person is global** (`users`), unique by phone number across the system.
- **`gym_users` joins the two** and carries the role, member code, status and
  gym-specific member details. The same phone can be a member at one gym and a
  trainer at another.

**Every request names its gym** with an `X-Gym-Code` header:

```
X-Gym-Code: swasth-koramangala
```

Each gym gets its own app build with its code baked in, so the member never
types it. Requests are scoped in three layers, and none of them trust the
request body:

1. `GymContextMiddleware` resolves the header to a gym and attaches it.
2. Access tokens are **minted for one gym** and carry its id. `GymGuard` rejects
   a token whose gym differs from the header — a token from gym A is inert
   against gym B.
3. Services take `gymId` from the caller's token, never from user input.

Roles (`MEMBER`, `TRAINER`, `GYM_ADMIN`, `OWNER`) are held **per gym**, and are
re-read from the database on every request, so revoking access takes effect at
once rather than when the token expires. `User.isPlatformAdmin` is separate and
belongs to the Swasth team — it only gates gym onboarding.

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

All auth routes require the `X-Gym-Code` header.

```
POST /api/v1/auth/otp/send      { phone }
POST /api/v1/auth/otp/verify    { phone, code, platform?, pushToken? }
        → { accessToken, refreshToken, expiresIn, isNewUser, user, gym }
POST /api/v1/auth/refresh       { refreshToken }  → new pair
POST /api/v1/auth/logout        { refreshToken }
POST /api/v1/auth/logout-all    (bearer)
```

Notes:

- Accounts are created on first successful OTP verification — there is no
  separate signup call. `isNewUser` tells the app whether to route into
  onboarding.
- Logging into a gym's app for the first time also **links the person to that
  gym** as a `MEMBER`. They hold no paid membership at that point — that is a
  separate record still to be built.
- `logout-all` ends sessions **at the current gym only**; sessions the same
  person holds at another gym are untouched.
- OTPs are stored argon2-hashed, expire in 5 minutes, allow 5 attempts, and are
  rate limited to one per 60s and 5 sends/minute per IP.
- Refresh tokens rotate on every use and are stored hashed. Presenting an
  already-rotated token revokes the entire session family — the standard
  response to a stolen token.
- With `OTP_DEV_MODE=true` the code is returned in the send response and logged
  instead of being sent by SMS. The env validation **rejects boot** if this is
  set with `NODE_ENV=staging|production`.

## Members (front desk)

Gym staff only (`GYM_ADMIN` / `OWNER`), scoped to the caller's own gym.

```
POST   /api/v1/members              register a walk-in
GET    /api/v1/members              search + paginate (?search=&status=&page=&limit=)
GET    /api/v1/members/:id
PATCH  /api/v1/members/:id
POST   /api/v1/members/:id/deactivate   { status: LEFT | SUSPENDED, reason? }
POST   /api/v1/members/:id/reactivate
```

Behaviour worth knowing:

- **The member doesn't need the app.** Registering a walk-in creates the person
  against their phone number; when they later log in on that number, the record
  is already waiting. `hasAppAccount` tells the desk whether they've ever
  logged in.
- **Member codes** are `<prefix><counter>` per gym, e.g. `SWK-0007`. The counter
  is incremented and read in a single statement, so two desks registering at
  once cannot collide.
- **An existing person is reused, not duplicated.** If the number already exists
  (they're a member of another gym, or installed the app first), we link them to
  this gym and only fill in profile fields that were blank — one gym cannot
  overwrite details another gym holds.
- **Rejoining keeps history.** Registering someone who previously left restores
  their original record and member code instead of minting a new one.
- **Deactivating revokes their sessions at this gym immediately**, and only at
  this gym.

## Plans and memberships

`GET /plans` is visible to members (active, public plans only); everything else
is staff-only.

```
GET/POST/PATCH  /api/v1/plans[/:id]          what the gym sells
POST            /api/v1/plans/:id/archive    take off sale, keep history
POST            /api/v1/members/:id/subscriptions   sell a plan
GET             /api/v1/members/:id/subscriptions   membership history
GET             /api/v1/subscriptions/expiring?days=7
POST            /api/v1/subscriptions/:id/payment   record more cash
POST            /api/v1/subscriptions/:id/cancel
```

Design points worth knowing:

- **Status is computed, never stored.** `ACTIVE / UPCOMING / EXPIRED /
  CANCELLED` are derived from `startDate`, `endDate` and `cancelledAt` on every
  read, so nothing goes stale and there is no nightly job to flip expired rows.
- **Calendar months, not 30-day blocks.** A 3-month plan starting 15 Jan runs to
  14 Apr, so the renewal starts 15 Apr with no gap and no overlap. Month-end
  dates are clamped — 31 Jan + 1 month is 28 Feb.
- **Renewals stack.** Selling to someone whose membership is still running
  defaults the start date to the day after it ends. An explicitly overlapping
  sale is refused with a `409` naming the date to use instead.
- **Plan edits never rewrite history.** Name, price and duration are copied onto
  the subscription at the point of sale. Plans archive rather than delete.
- **Cash only, by design.** There is no payment gateway. The desk records
  `amountPaid` against the amount due; anything short is `PARTIAL` with a
  balance, topped up later via the payment route.
- Members carry a `membership` summary on every member response, and
  `GET /users/me` carries the same as `subscription` for the app home screen.
  `coveredUntil` accounts for a queued renewal.

## Check-ins

```
POST /api/v1/check-ins                    member checks themselves in
GET  /api/v1/check-ins/me/summary         streak and visit counts
GET  /api/v1/check-ins/me                 own history
GET  /api/v1/check-ins?date=YYYY-MM-DD    the day's register    (staff)
POST /api/v1/members/:id/check-ins        desk records a visit  (staff)
GET  /api/v1/members/:id/check-ins        a member's history    (staff)
```

- **No QR and no scanner.** The member taps a button and the app asks for
  confirmation; the confirmation is client-side only, so the record is
  self-reported by design.
- **A day is the unit of attendance**, enforced by a unique index on
  `(gymUserId, localDate)`. A repeat check-in returns the first one with
  `alreadyCheckedIn: true` rather than erroring — a double tap on a slow
  connection is likelier than a real second visit. Concurrent taps are caught by
  the unique constraint and resolved to the same row.
- **Days are the gym's local days, not UTC.** India is UTC+5:30, so a 5am visit
  falls on the previous UTC date; using UTC would quietly break streaks for
  early risers. `gymLocalDate()` derives the day from the gym's `timezone`.
- **An active membership is required**, with different messages for "never
  joined" and "expired".
- Streaks are computed, not stored. A streak survives not having visited yet
  today, and breaks only once a whole day is missed.

## Gyms (Swasth team)

```
GET  /api/v1/gyms/current   public profile for the app's gym (no login needed)
POST /api/v1/gyms           onboard a gym + its owner   (platform admin)
GET  /api/v1/gyms           list all gyms               (platform admin)
```

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
    gyms/          gym onboarding + X-Gym-Code resolution
    auth/          OTP issue/verify, token issue/rotate, JWT strategy
    users/         my profile, onboarding, account deletion
    members/       front-desk member administration
    notifications/ SMS boundary (push to follow)
    health/        liveness + DB check
  prisma/          PrismaService (global module)
prisma/
  schema.prisma    data model
  migrations/      checked-in SQL migrations
  seed.ts          baseline data (one gym, owner, admin)
```

New features land as a module under `src/modules/` with their models appended
to `schema.prisma`.
