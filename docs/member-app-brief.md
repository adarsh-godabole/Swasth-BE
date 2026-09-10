# Swasth Member App — build brief

Feed this whole file to a fresh Claude Code session started in the member app
folder. It assumes no knowledge of the backend.

---

## 1. What you are building

The **member-facing mobile app** for a single gym, on Android and iOS. It talks
to an existing, deployed REST API. **You are not building the backend and cannot
change it** — if something seems missing, say so rather than inventing an
endpoint. Several things genuinely are missing; section 8 lists them.

### Decided already — don't re-litigate

| Decision      | Choice                                             |
| ------------- | -------------------------------------------------- |
| Framework     | **Expo** (managed workflow), TypeScript             |
| Navigation    | Expo Router                                         |
| Server state  | TanStack Query                                      |
| Token storage | `expo-secure-store` — **not** AsyncStorage          |
| Auth          | Phone + OTP. No passwords, no social login          |
| Repo          | Standalone (separate from the backend and the portal) |
| Payments      | **None in the app.** Members pay cash at the desk   |

Nothing exists yet. Scaffold from scratch.

### Be honest about the scope

Today a member can: **log in, complete onboarding, see their membership status,
check in for the day, see their streak and visit history, browse the price list,
and edit their profile.** That's it.

They cannot book a class, see a workout, track body progress, or buy anything —
none of that exists in the backend yet. Build a genuinely good version of the
small thing, and leave obvious room for the rest. Do not stub out fake screens
for features that have no data behind them.

---

## 2. Backend

| Environment | Base URL                                  |
| ----------- | ----------------------------------------- |
| Deployed    | `https://swasth-be.onrender.com/api/v1`   |
| Swagger     | `https://swasth-be.onrender.com/api/docs` |

> **The backend sleeps.** It is on a free tier: after 15 minutes idle, the next
> request takes **30–60 seconds**. This is the single biggest UX hazard for a
> mobile app, where a spinner that long reads as "broken". Do not set short
> timeouts. Show a "waking up the gym's server…" message after ~5 seconds, and
> consider firing a cheap `GET /gyms/current` on app launch to warm it while the
> user is still reading the welcome screen.

### Two headers on every request

```
X-Gym-Code: swasth-koramangala      <- required on essentially everything
Authorization: Bearer <accessToken> <- required except on the login endpoints
```

The backend serves **many gyms from one database**. Each gym gets **its own app
build** with its code baked in — the member never types or picks a gym. Put it
in `app.config.ts` as `extra.gymCode` (or `EXPO_PUBLIC_GYM_CODE`) so building
for a second gym is a config change, not a code change. Never hardcode it in a
screen.

A token is minted for one gym; the server rejects a mismatch with `403`.

### Response envelope

Success: `{ "success": true, "data": { ... } }`

Error:

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Incorrect OTP. 4 attempt(s) remaining.",
  "errors": ["optional per-field validation messages"],
  "path": "/api/v1/auth/otp/verify",
  "timestamp": "2026-08-14T06:31:18.389Z"
}
```

Unwrap `data` in the API client so screens never see the envelope. **Show
`message` to the user as-is** — the backend's messages are written for humans and
are usually better than anything generic you'd substitute.

---

## 3. Auth

### Flow

1. `POST /auth/otp/send` → `{ phone }`
2. `POST /auth/otp/verify` → `{ phone, code, platform, appVersion }` → tokens
3. Store tokens. Attach the access token to every request.
4. On `401`, refresh once via `POST /auth/refresh`, then retry.

**Token storage on mobile:** keep the **refresh token in `expo-secure-store`**
(Keychain / Keystore). The access token can live in memory and be re-derived by
refreshing on cold start — it only lasts 15 minutes anyway. Never put either in
AsyncStorage; it is unencrypted.

Refresh tokens last **30 days and rotate on every use** — always store both
tokens from the refresh response. Reusing a rotated token makes the backend kill
the entire session as suspected theft, so **queue concurrent 401s behind a single
refresh**. On mobile this matters more than on web: several screens refetch at
once when the app returns from background.

### `POST /auth/otp/send`

Headers: `X-Gym-Code`. No auth. Body `{ "phone": "9876543210" }` — local Indian
format or E.164 both work.

```json
{ "phone": "+91XXXXXX3210", "expiresAt": "…", "devCode": "123456" }
```

`devCode` is present only while the backend runs in staging. Use it to log in
during development; never show it in a production build.

> **60-second resend cooldown per number.** Asking again too soon returns a
> `400` and the *original* code stays valid. Your resend button must be disabled
> with a visible countdown. This has repeatedly tripped us up in testing.

OTP expires in **5 minutes**, allows **5 wrong attempts**.

### `POST /auth/otp/verify`

Headers: `X-Gym-Code`. No auth.

```json
{
  "phone": "9876543210",
  "code": "123456",
  "platform": "ANDROID",
  "appVersion": "1.0.0",
  "pushToken": "optional FCM/APNs token"
}
```

Send `platform` (`ANDROID` | `IOS`) — it registers the device, which is what
push notifications will hang off later. `pushToken` is optional; wire it once you
add notifications.

Response:

```json
{
  "accessToken": "…", "refreshToken": "…", "expiresIn": 900,
  "isNewUser": false,
  "user": {
    "id": "…", "phone": "+919876543210", "fullName": "Rohit Sharma",
    "role": "MEMBER", "memberCode": "SWK-0001", "onboarded": false
  },
  "gym": { "id": "…", "code": "swasth-koramangala", "name": "Swasth Fitness, Koramangala" }
}
```

**Route on `onboarded`, not `isNewUser`.** Someone the front desk registered
months ago is not a new user, but has never completed in-app onboarding.
`isNewUser` only tells you whether the account was created just now.

**If `role` is not `MEMBER`** (a trainer or admin logged in), the app still
works — they simply have no membership. Don't crash; just don't show them a
membership card.

### Other auth routes

- `POST /auth/refresh` — `{ refreshToken }` → new pair. No gym header needed.
- `POST /auth/logout` — `{ refreshToken }` → `204`. Clear local tokens
  regardless of the response.

### Test login

Gym `swasth-koramangala`, OTP `123456`:

| Phone        | Who                                                    |
| ------------ | ------------------------------------------------------ |
| `9876543210` | Rohit Sharma — a real member with an active membership |
| `9845012345` | Priya Nair — membership expiring today                 |

Any unused number logs in as a brand-new visitor with no membership — useful for
testing the empty state.

---

## 4. What a member can call

This is the **complete** list. Everything else returns `403`.

```
GET    /gyms/current                 gym profile (no auth needed)
GET    /users/me                     profile + membership
PATCH  /users/me                     edit profile
POST   /users/me/onboarding/complete mark onboarding done
DELETE /users/me                     delete account
GET    /plans                        the price list
POST   /check-ins                    check in for today
GET    /check-ins/me/summary         streak and counts
GET    /check-ins/me                 visit history
POST   /auth/*                       as above
```

### `GET /users/me` — the most important call

```json
{
  "id": "…",
  "phone": "+919876543210",
  "fullName": "Rohit Sharma",
  "email": null,
  "emailVerified": false,
  "gender": "MALE",
  "dateOfBirth": "1995-04-17T00:00:00.000Z",
  "heightCm": 175.5,
  "weightKg": 82.4,
  "avatarUrl": null,
  "city": null,

  "membership": {
    "gymId": "…",
    "role": "MEMBER",
    "status": "ACTIVE",
    "memberCode": "SWK-0001",
    "goal": "WEIGHT_LOSS",
    "activityLevel": "BEGINNER",
    "medicalNotes": "Left knee surgery 2023",
    "emergencyContactName": "Sunita Sharma",
    "emergencyContactPhone": "+919812345678",
    "onboarded": true,
    "joinedAt": "…",
    "lastVisitAt": null
  },

  "subscription": {
    "status": "ACTIVE",
    "subscriptionId": "…",
    "planName": "3 Months",
    "startDate": "2026-08-14T00:00:00.000Z",
    "endDate": "2026-11-13T00:00:00.000Z",
    "daysRemaining": 91,
    "balance": 0,
    "coveredUntil": "2026-12-13T00:00:00.000Z",
    "hasRenewalQueued": true
  }
}
```

> **The two words mean different things, and the naming is admittedly
> confusing.** `membership` is their *relationship with the gym* — member code,
> role, goal, emergency contact. `subscription` is the *plan they have paid for*.
> A person can have a `membership` and no `subscription`: that's someone who
> installed the app but never bought anything.

**`subscription` is `null` for anyone who has never bought a plan.** That is a
completely normal state, not an error, and it is what every brand-new app signup
looks like. Design that home screen deliberately — it should explain how to join
and point them at the price list and the gym's phone number, because **they
cannot buy in the app.**

`subscription.status` values and what the home screen should say:

| Status      | Meaning                              | Suggested treatment                      |
| ----------- | ------------------------------------ | ---------------------------------------- |
| `null`      | Never bought a plan                  | "Visit the gym to join" + price list      |
| `ACTIVE`    | Paid up and running                  | Plan name, big days-remaining number      |
| `UPCOMING`  | Paid, starts in the future           | "Starts on 15 Sep"                        |
| `EXPIRED`   | Lapsed                               | Prominent "renew at the desk" prompt      |
| `CANCELLED` | Cancelled by the gym                 | Same as expired, softer wording           |

Two subtleties:

- `daysRemaining` is **0 on the last valid day** (say "expires today") and goes
  **negative** once past. Don't render "-3 days left".
- When `hasRenewalQueued` is true, `endDate` is the current term's end but
  `coveredUntil` is the real answer to "how long am I covered". Show
  `coveredUntil` and mention the renewal, or the member will think they're
  about to expire when they've already paid.
- `balance` greater than 0 means they still owe the gym money. Worth surfacing
  quietly — "₹2,000 due at the desk" — not as an error.

### `PATCH /users/me` — profile and onboarding answers

All fields optional. Person-level: `fullName`, `email`, `gender`, `dateOfBirth`
(`YYYY-MM-DD`), `heightCm`, `weightKg`, `city`, `avatarUrl`. Gym-level:
`goal`, `activityLevel`, `medicalNotes`, `emergencyContactName`,
`emergencyContactPhone`.

**PATCH semantics:**

| You send         | Result                                |
| ---------------- | ------------------------------------- |
| field omitted    | left alone                             |
| `"field": null`  | **cleared**                            |
| `"field": ""`    | `400` on validated fields — use `null` |

`gender: null` resets to `UNDISCLOSED` (it is never null in responses).

Validation: `fullName` 2–120, `email` a valid address, `heightCm` 50–280,
`weightKg` 20–500, `medicalNotes` ≤1000, `city` ≤100. Mirror these in the form
or the API will reject it. **Unknown fields are rejected with a `400`** — send
only what is listed.

### `POST /users/me/onboarding/complete`

No body. Call it once the member finishes the onboarding questions; it flips
`membership.onboarded` to true so you know not to show onboarding again. It is
idempotent.

### `GET /plans` — the price list

Members see only active, public plans, cheapest sort order first.

```json
[
  { "id": "…", "name": "Day Pass", "description": null,
    "durationValue": 1, "durationUnit": "DAY", "durationLabel": "1 day",
    "price": 300, "isActive": true, "isPublic": true, "sortOrder": 0,
    "archivedAt": null }
]
```

`durationLabel` is pre-formatted ("3 months") — use it rather than composing
your own. `price` is in **rupees** as a number. **There is no way to buy from the
app** — this is a price list. Pair it with a call button to the gym.

### Check-in — the daily action

Added 2026-08-14. **No QR code and no scanner.** The member taps a **Check in**
button, the app asks *"Are you sure you're at the gym?"*, and on confirm you call
this. **The confirmation is entirely client-side** — there is nothing to send and
no flag to set. Do not skip it; it is the only thing standing between a
mis-tap and a false attendance record.

```
POST /check-ins                check myself in for today
GET  /check-ins/me/summary     streak and counts (home screen)
GET  /check-ins/me?limit=30    my visit history
```

`POST /check-ins` takes **no body**:

```json
{
  "id": "…",
  "memberId": "…",
  "date": "2026-08-14T00:00:00.000Z",
  "checkedInAt": "2026-08-14T17:10:31.643Z",
  "source": "APP",
  "alreadyCheckedIn": false
}
```

**One check-in per day, and tapping twice is not an error.** The second call
returns the first check-in with `alreadyCheckedIn: true` and a `200`. Treat that
as success — show "Already checked in at 5:10 pm", not an error. A double tap on
a slow connection is far likelier than a genuine second visit.

**Check-in requires an active membership.** Two distinct `403`s, and the wording
differs on purpose:

| Situation                  | Message                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| Never bought a plan        | "You need an active membership to check in. Please visit the gym to join." |
| Membership lapsed          | "Your membership has expired. Please renew at the gym."             |

Show the message as-is. Better still, use `subscription` from `GET /users/me` to
**hide or disable the button** when there's no active membership, so the member
never taps into a refusal.

### `GET /check-ins/me/summary`

```json
{
  "checkedInToday": true,
  "checkedInAt": "2026-08-14T17:10:31.643Z",
  "currentStreak": 3,
  "longestStreak": 3,
  "visitsThisMonth": 5,
  "totalVisits": 5,
  "lastVisitAt": "2026-08-14T17:10:31.643Z"
}
```

Drive the button's state from `checkedInToday`. Note that **`currentStreak`
survives not having come in yet today** — someone who visited yesterday still
shows their streak this morning; it only breaks after a full day is missed.
Don't recompute streaks client-side, you'll disagree with the server.

**Days are the gym's local days, not the device's and not UTC.** A 5am visit in
India falls on the previous UTC date, so the server computes the day in the
gym's timezone. Render `date` as a plain date; don't convert it to the device
timezone or you will show visits shifting a day.

### Workouts — what they trained

A workout hangs off a check-in, so it inherits the same day rules: one per
member per gym-local day, and you cannot log a workout for a day the member
never came in.

```
PUT  /workouts/me/today            log what I'm training today
GET  /workouts/me?limit=30         my workout history
GET  /workouts/me/summary?days=30  which areas, how often
```

`PUT /workouts/me/today` takes the **complete selection**, not a delta:

```json
{ "muscleGroups": ["CHEST", "BICEPS"], "finished": false }
```

```json
{
  "id": "…",
  "memberId": "…",
  "checkInId": "…",
  "date": "2026-09-10T00:00:00.000Z",
  "muscleGroups": ["CHEST", "BICEPS"],
  "startedAt": "2026-09-10T10:27:17.590Z",
  "endedAt": null,
  "durationMinutes": null,
  "updatedAt": "2026-09-10T10:27:17.618Z"
}
```

**It is a `PUT` because the app saves on every tap of the body map.** Calling it
repeatedly converges rather than accumulating. `muscleGroups` replaces whatever
was stored — un-tapping a muscle is a shorter array, clearing everything is `[]`.
Duplicates are ignored. There is no `DELETE`.

**`finished` is three-state.** `true` stamps the end of the session, `false`
reopens it, and **omitting it leaves the stamp alone** — which is what makes it
safe to keep editing muscles after finishing without restarting the clock. The
end time is the server's, so don't send one.

**`startedAt` mirrors the check-in**, which is what the session timer should
count from. Derive the clock from it rather than from a locally stored "started
now", and the timer survives the app being closed or the phone rebooting.

**No check-out still.** A session the member never finished has `endedAt: null`
and `durationMinutes: null`. Show "not finished" rather than inventing a length.

**`409` if there's no check-in today** — "Check in first, then log what you're
training." The app shouldn't be able to reach this, since the screen is only
reachable after checking in, but handle it rather than crashing.

### `GET /workouts/me/summary`

```json
{
  "days": 30,
  "from": "2026-08-12T00:00:00.000Z",
  "to": "2026-09-10T00:00:00.000Z",
  "sessionsLogged": 12,
  "minutesTrained": 640,
  "muscleGroups": [
    { "muscleGroup": "CHEST", "days": 5 },
    { "muscleGroup": "LATS", "days": 4 }
  ]
}
```

Busiest first, and **areas never trained in the window are simply absent** —
that gap is the useful part, so a screen that lists all fifteen with zeroes
reads better than one that only shows what was hit.

### `GET /gyms/current`

No auth, so it works on the login screen. Returns `name`, `phone`, address
parts, `city`, `logoUrl`, `timezone`, `currency`. Use it for branding on the
welcome screen, and for a "Call the gym" / "Directions" action.

### `DELETE /users/me`

Soft-deletes the account across all gyms and returns `204`. **Both app stores
require an in-app account deletion path**, so build it into Profile with a clear
confirmation.

---

## 5. Nullability

Almost everything is nullable. `fullName` especially — members registered at the
desk have one, but anyone who signed up in the app has **`null`** until they
complete onboarding.

Non-null guarantees: `id`, `phone`, `gender`, `membership.role`,
`membership.status`, `membership.memberCode` (only for desk-registered members —
**null for app signups**), `membership.onboarded`, `membership.joinedAt`.

Everything else — `fullName`, `email`, `dateOfBirth`, `heightCm`, `weightKg`,
`city`, `avatarUrl`, `goal`, `activityLevel`, `medicalNotes`, both emergency
contact fields, `lastVisitAt`, and the whole `subscription` object — can be null.
Render fallbacks; never show "undefined" or crash a screen.

---

## 6. Enums

```ts
type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';
type FitnessGoal = 'WEIGHT_LOSS' | 'MUSCLE_GAIN' | 'GENERAL_FITNESS' | 'ENDURANCE' | 'REHAB';
type ActivityLevel = 'BEGINNER' | 'OCCASIONAL' | 'REGULAR';
type GymRole = 'MEMBER' | 'TRAINER' | 'GYM_ADMIN' | 'OWNER';
type DurationUnit = 'DAY' | 'MONTH';
type SubscriptionStatus = 'ACTIVE' | 'UPCOMING' | 'EXPIRED' | 'CANCELLED';
type DevicePlatform = 'ANDROID' | 'IOS';

type MuscleGroup =
  | 'CHEST' | 'SHOULDERS' | 'BICEPS' | 'TRICEPS' | 'FOREARMS' | 'ABS'
  | 'TRAPS' | 'LATS' | 'LOWER_BACK' | 'GLUTES' | 'QUADS' | 'HAMSTRINGS'
  | 'CALVES' | 'CARDIO' | 'FULL_BODY';
```

Show friendly labels ("Lose weight", not `WEIGHT_LOSS`) but send the exact
strings.

---

## 7. What to build

In this order; each step should run on a real device before the next.

### 1. Scaffold
Expo + TypeScript + Expo Router + TanStack Query + `expo-secure-store`. Gym code
in `app.config.ts`. A typed API client that attaches both headers, unwraps the
envelope, throws errors carrying `message`/`statusCode`/`errors`, and handles
single-flight refresh on 401.

### 2. Auth
Welcome screen (gym name and logo from `GET /gyms/current`), phone entry, OTP
entry with **auto-advancing boxes and a resend countdown**, secure token
storage, and silent restore on cold start so a returning member never sees the
login screen. Route on `membership.onboarded`.

### 3. Onboarding
The questions from `PATCH /users/me`: name, gender, date of birth, height,
weight, goal, activity level, medical notes, emergency contact. Skippable, a few
per screen rather than one long form. Finish with
`POST /users/me/onboarding/complete`.

### 4. Home
The membership card is the whole screen: plan name, days remaining as the hero
number, expiry date, and the renewal note when `hasRenewalQueued`. Handle all
five states from the table above — **the `null` state deserves as much care as
the happy path**, since every new signup starts there. Add the gym's phone
number and address.

### 5. Check-in
The **Check in** button belongs on Home, directly under the membership card. Tap
→ "Are you sure you're at the gym?" → confirm → success state showing the time,
the streak, and the button now disabled for the day. Hide the button entirely
when there is no active membership. A small streak/visits strip and a simple
visit history complete it.

### 6. Plans
The price list, with a "call the gym to join" action. Make it clear this is
information, not a checkout.

### 7. Profile
View and edit everything, member code shown prominently (the desk asks for it),
logout, and account deletion.

### Quality bar
- Works on a slow, sleeping backend: real loading states, retry, offline notice.
- Every screen has loading, empty and error states.
- Test on a real Android device, not just the simulator.
- Never show a raw enum, a null, or a stack trace to a member.

---

## 8. What does not exist — do not invent it

The backend has **no endpoints** for any of this. If a screen needs it, stop and
say so:

1. ~~**Check-in / attendance.**~~ **Built** — see section 4. Button-and-confirm,
   no QR. `lastVisitAt` is now populated. Still missing: check-*out*, so there is
   no notion of who is currently inside, only who came today.
2. **Classes, schedules, bookings.** None.
3. ~~**Workout tracking.**~~ **Built** — see section 4. A member can record which
   muscle groups they trained on a visit and read back their history and a
   30-day tally. Still none of: **trainers**, prescribed **workout plans**,
   per-exercise sets/reps/weights, or **body measurements**.
4. **Buying a plan in the app.** Deliberately absent — members pay cash at the
   desk. There is no payment gateway and none is planned for now.
5. **Membership history.** A member can see their *current* membership via
   `GET /users/me`, but there is **no endpoint for their past memberships or
   payment receipts** — `/members/:id/subscriptions` is staff-only and returns
   `403` for a member. If you want a billing history screen, ask for
   `GET /users/me/subscriptions` to be added rather than working around it.
6. **Push notifications.** The device is registered at login, but nothing sends
   anything yet.
7. **Freeze / pause membership.** Not built.

Also note: **the 60-second OTP cooldown** and **30–60 second cold starts** are
the two things most likely to make a working app feel broken.

---

## 9. Working agreement

- **Verify on a real device.** Run it against the deployed backend with the test
  logins above. Don't call a screen done without seeing it with real data.
- **Don't mock the API.** It's live; use it.
- **If an endpoint you need doesn't exist, stop and say so.** Don't invent one
  and don't fake the data — the backend is a separate repo, changed
  deliberately.
- Keep API types in one place, mirroring sections 4–6 exactly.
