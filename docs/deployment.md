# Deploying Swasth for free

Target: a live staging API you can hit from the React Native app, at no cost and
with no credit card.

| Piece    | Service | Free tier                                            |
| -------- | ------- | ---------------------------------------------------- |
| Database | Neon    | 0.5 GB Postgres, sleeps when idle, no card required   |
| API      | Render  | 750 hrs/month, sleeps after 15 min idle, no card      |

> **The catch, up front:** on Render's free tier the service sleeps after 15
> minutes of no traffic, and the next request takes 30–60 seconds to wake it.
> Fine for development and demos, not for real members. Neon sleeps too, adding
> a second or two to the first query.

This deploys as **staging**, not production — which means OTPs come back in the
API response instead of by SMS, and Swagger stays available. You cannot run
`NODE_ENV=production` until a real SMS provider is wired into `SmsService`; the
app refuses to boot with dev OTPs in production, and would otherwise have no way
to send a login code.

---

## Step 1 — Create the database (Neon)

1. Go to <https://neon.tech> and sign up (GitHub login is quickest).
2. Create a project — name it `swasth`, pick the region closest to you
   (Singapore or Mumbai for India).
3. On the dashboard, copy the **connection string**. It looks like:

   ```
   postgresql://swasth_owner:XXXX@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/swasth?sslmode=require
   ```

   **Important:** if the host contains `-pooler`, switch the toggle to the
   **direct / unpooled** connection instead. Prisma migrations do not work
   reliably through the connection pooler.

Keep that string handy — you need it twice.

## Step 2 — Create the schema and seed it

Creates the tables in Neon and puts one gym, its owner and a front-desk admin in
them. Run these from the project folder. Stop at the first command whose output
doesn't match.

### 2.1 Save the connection string

Create a file called `.env.neon` in the project root with one line:

```
DATABASE_URL="postgresql://swasth_owner:XXXX@ep-something-123456.ap-southeast-1.aws.neon.tech/swasth?sslmode=require"
```

Keep the quotes — Neon passwords often contain characters the shell would
otherwise mangle. `.env.neon` is gitignored, so it will never be committed, and
using a file keeps the password out of your shell history.

Two things to check in that string:

- it ends with `?sslmode=require` — Neon rejects unencrypted connections;
- the host does **not** contain `-pooler`. If it does, go back to the Neon
  dashboard and copy the direct/unpooled string instead. Migrations are not
  reliable through the connection pooler.

### 2.2 Check the connection before changing anything

```bash
npm run neon:status
```

Expected — it reaches Neon and reports that nothing has been applied yet:

```
Using .env.neon -> postgresql://swasth_owner:****@ep-...neon.tech/swasth?sslmode=require
Datasource "db": PostgreSQL database "swasth" ...
1 migration found in prisma/migrations
Following migrations have not yet been applied:
20260814000000_init
```

The first line echoes where it is pointing, with the password masked — confirm
it says `neon.tech` and not `localhost`. If instead you see:

| Error                            | Cause                                            |
| -------------------------------- | ------------------------------------------------ |
| `P1001: Can't reach database`    | Wrong host, or the string was pasted incomplete   |
| `P1000: Authentication failed`   | Wrong password — recopy it from Neon              |
| `Cannot read ".env.neon"`        | File is missing or not in the project root        |

### 2.3 Create the tables

```bash
npm run neon:migrate
```

Expected:

```
Applying migration `20260814000000_init`
All migrations have been successfully applied.
```

### 2.4 Seed the gym

```bash
npm run neon:seed
```

Expected:

```
Seeded gym "swasth-koramangala"
  Platform admin : +919999900001
  Owner          : +919999900002
  Gym admin      : +919999900003
```

Safe to run twice — it upserts, so it won't create duplicates.

### 2.5 Look at what you just created

```bash
npm run neon:studio
```

Opens Prisma Studio on <http://localhost:5555>, now pointed at Neon rather than
your local database. `gyms` should hold 1 row and `gym_users` 3. Ctrl+C to stop.

> Your local `.env` and local database are untouched by all of this — every
> `neon:*` script reads `.env.neon` instead, and that value overrides `.env`.

> The deployed app also runs `prisma migrate deploy` on every boot, so 2.3 would
> happen anyway. Doing it now means you find connection problems here, where the
> error is readable, rather than in a Render build log.

## Step 3 — Push the code to GitHub

The remote already exists (`adarsh-godabole/Swasth-BE`). Commit what's in the
working tree and push:

```bash
git add -A
git commit -m "feat: multi-gym tenancy, member registration, deployment setup"
git push origin main
```

## Step 4 — Deploy the API (Render)

1. Go to <https://render.com> and sign up with GitHub.
2. **New → Web Service**, and connect the `Swasth-BE` repository.
3. Settings:

   | Field          | Value                    |
   | -------------- | ------------------------ |
   | Name           | `swasth-api`             |
   | Language       | **Docker**               |
   | Branch         | `main`                   |
   | Region         | Singapore                |
   | Instance type  | **Free**                 |

   Leave build and start commands empty — the `Dockerfile` handles both, and it
   applies migrations on boot.

4. Add these **environment variables** (Advanced → Add Environment Variable):

   | Key                  | Value                                          |
   | -------------------- | ---------------------------------------------- |
   | `NODE_ENV`           | `staging`                                      |
   | `DATABASE_URL`       | your Neon connection string                    |
   | `JWT_ACCESS_SECRET`  | generate below                                 |
   | `JWT_REFRESH_SECRET` | generate below — **must differ from the above** |
   | `OTP_DEV_MODE`       | `true`                                         |
   | `OTP_DEV_CODE`       | `123456`                                       |
   | `CORS_ORIGINS`       | `*`                                            |

   Generate the two secrets with:

   ```bash
   openssl rand -base64 48
   ```

   Do **not** set `PORT` — Render injects its own and the app reads it.

5. **Create Web Service.** The first build takes 5–10 minutes. When it finishes
   you get a URL like `https://swasth-api.onrender.com`.

## Step 5 — Check it works

Replace the URL with yours. The first call may take a minute while the service
wakes up.

```bash
API=https://swasth-api.onrender.com/api/v1
GYM="X-Gym-Code: swasth-koramangala"

# 1. Is it alive, and is the database connected?
curl -s $API/health

# 2. The gym profile the app shows before login
curl -s -H "$GYM" $API/gyms/current

# 3. Log in as the seeded front-desk admin
curl -s -X POST $API/auth/otp/send -H 'Content-Type: application/json' \
  -H "$GYM" -d '{"phone":"9999900003"}'

curl -s -X POST $API/auth/otp/verify -H 'Content-Type: application/json' \
  -H "$GYM" -d '{"phone":"9999900003","code":"123456"}'
```

`/health` should report `"database":"up"`. The verify call returns an
`accessToken` — put it in an `Authorization: Bearer <token>` header to register
members.

Swagger is live at `https://swasth-api.onrender.com/api/docs`.

## Step 6 — Point the app at it

The React Native app needs two things on every request:

```
Base URL:   https://swasth-api.onrender.com/api/v1
Header:     X-Gym-Code: swasth-koramangala
```

---

## Viewing the deployed data

```bash
npm run neon:studio
```

Neon's own dashboard also has a SQL editor and a table browser.

## The neon:* scripts

Each one runs an ordinary Prisma command with `.env.neon` loaded on top of the
environment, so it hits the hosted database instead of your local one:

| Command                | What it does                             |
| ---------------------- | ----------------------------------------- |
| `npm run neon:status`  | Connection check + which migrations remain |
| `npm run neon:migrate` | Applies pending migrations                 |
| `npm run neon:seed`    | Seeds the gym, owner and admin             |
| `npm run neon:studio`  | Browses the hosted data                    |

## Redeploying

Push to `main` and Render rebuilds automatically. Any new migration in
`prisma/migrations/` is applied when the new container boots.

## When this stops being enough

Three things to change before real members use it:

1. **Wire up an SMS provider** (MSG91 or Twilio) in `SmsService`, then switch
   `NODE_ENV` to `production` and remove `OTP_DEV_MODE` / `OTP_DEV_CODE`. Until
   then anyone who knows a registered phone number can log in with `123456`.
2. **Move off the free tier** so the API stops sleeping — Render's paid instance
   is around $7/month.
3. **Lock down `CORS_ORIGINS`** to the actual app origins instead of `*`.
