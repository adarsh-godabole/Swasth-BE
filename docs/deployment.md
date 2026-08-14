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

From the project folder on your machine, run the migration and seed **against
Neon** by putting the connection string in front of the command:

```bash
DATABASE_URL="<paste-neon-string>" npx prisma migrate deploy
DATABASE_URL="<paste-neon-string>" npm run db:seed
```

You should see the migration applied, then the three seeded logins. Your local
`.env` is untouched — this only affects these two commands.

> The deployed app also runs `prisma migrate deploy` on every boot, so this step
> is really just so you can seed the gym. Migrations would apply either way.

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

Prisma Studio works against Neon the same way it works locally:

```bash
DATABASE_URL="<paste-neon-string>" npx prisma studio
```

Neon's own dashboard also has a SQL editor and a table browser.

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
