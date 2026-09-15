# Observability

Four signals, one Grafana Cloud stack:

| Signal | Source | How it gets there |
| --- | --- | --- |
| API metrics | OpenTelemetry auto-instrumentation | Pushed over OTLP |
| API traces | OpenTelemetry auto-instrumentation | Pushed over OTLP |
| API logs | Every `Logger` call in the app | Pushed over OTLP |
| Gym business data | Neon Postgres | Grafana queries it directly |
| Admin portal errors | Grafana Faro | Pushed to the Faro collector |

Everything that lives in this repo is already wired. What follows is the
Grafana Cloud side, which needs an account and cannot be committed.

## Why push, not scrape

The API runs on Render. Nothing outside can reach into it on a schedule, so a
Prometheus scrape of `/metrics` is not an option without exposing an endpoint
to the internet and paying for private networking. Grafana Cloud's OTLP gateway
takes all three signals on one endpoint with one token, so that is what the app
uses. There is no `/metrics` endpoint and nothing to scrape.

## 1. Create the stack

1. Sign up at <https://grafana.com> — the free tier covers 10k metric series,
   50GB of logs and 50GB of traces. A single gym will not come close.
2. In the portal, open your stack and find the **OpenTelemetry** tile.
3. Click **Configure**. It gives you two values:
   - an endpoint: `https://otlp-gateway-<REGION>.grafana.net/otlp`
   - an authorization header: `Authorization=Basic%20<base64 of instanceID:token>`

## 2. Point the API at it

Set these on the Render service (and in `.env` locally if you want telemetry
while developing):

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-<REGION>.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<token>
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_SERVICE_NAME=swasth-api
```

Leave `OTEL_EXPORTER_OTLP_ENDPOINT` unset and the whole subsystem is inert —
no exporters, no timers, no behaviour change. That is deliberate, and it is
covered by a test (`src/telemetry/telemetry.spec.ts`): a missing credential
must never be the reason a deploy fails.

The first time you wire this up, set `OTEL_DIAG_LOG=true`. A wrong token
otherwise fails silently and you are left staring at empty dashboards with no
indication why.

**Percent-encoding matters.** The header value must keep `Basic%20`, not
`Basic `. A literal space breaks the header parser and every export 401s.

## 3. Connect Postgres for the business dashboard

The gym metrics are read straight from the database rather than emitted as
telemetry — attendance and revenue are already rows, and turning them into
counters would be a lossy copy of something Grafana can query directly.

In Grafana: **Connections → Add new connection → PostgreSQL**, then point it at
the Neon database.

- Use a **read-only** role. Create one rather than reusing the app's
  credentials — this is a dashboard, it never needs to write.
- Neon requires TLS: set SSL mode to `require`.

```sql
CREATE ROLE grafana_ro WITH LOGIN PASSWORD '<generate one>';
GRANT CONNECT ON DATABASE <db> TO grafana_ro;
GRANT USAGE ON SCHEMA public TO grafana_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_ro;
```

## 4. Set up frontend monitoring for the admin portal

In Grafana: **Frontend Observability → Create app**. Name it `swasth-admin`.
It returns a collector URL with the app key already embedded.

Set it **at build time**, not at runtime:

```sh
VITE_FARO_URL=https://faro-collector-<REGION>.grafana.net/collect/<APP_KEY> \
VITE_APP_VERSION=$(git rev-parse --short HEAD) \
npm run build
```

This is the one place the frontend differs from the API. Vite substitutes
`import.meta.env.*` at compile time, so setting `VITE_FARO_URL` on the host
after the fact does nothing — the value has to be present when the bundle is
built. Whatever runs `npm run build` (CI, Vercel, Netlify) is where it belongs.

The upside of that substitution: with the variable unset the entire Faro branch
is dead code and gets eliminated. Measured on this repo:

| Build | `index.js` |
| --- | --- |
| Without `VITE_FARO_URL` | 421 kB |
| With `VITE_FARO_URL` | 530 kB |

So an unconfigured build carries no Faro at all, not merely a disabled copy —
and a configured one costs about 109 kB uncompressed. Worth knowing before you
turn it on for a desk running over gym wifi.

Sessions are anonymous on purpose. The staff phone number is the login
identifier and appears throughout this app; none of it should reach a third
party. If you later need to tie an error to a person, attach the gym user id,
never the phone.

## 5. Import the dashboards

`dashboards/` holds two starting points. In Grafana: **Dashboards → New →
Import → Upload JSON**, then pick the datasource when prompted.

- **`api-health.json`** — request rate, error rate, p95 latency by route, and
  Render cold starts. Reads the OTLP metrics.
- **`gym-business.json`** — check-ins per day, active memberships, revenue and
  outstanding balances. Reads Postgres.

These are hand-written and have not been round-tripped through a live Grafana,
so treat them as a first draft: import, fix whatever the UI complains about,
then export the corrected JSON back over the file.

## 6. Alerts worth having

Grafana's free tier includes alerting. The three that earn their keep here:

| Alert | Condition | Why |
| --- | --- | --- |
| API down | no successful health check for 5 min | Render free tier sleeps and occasionally fails to wake |
| Error spike | 5xx rate above 1% over 10 min | Catches a bad deploy before a member reports it |
| Database unreachable | Postgres datasource query fails | Neon has its own outages and connection limits |

Deliberately not alerting on business metrics. "Check-ins dropped" on a Sunday
is a quiet Sunday, not an incident, and an alert that cries wolf gets muted.

## What is not wired up

**Member app (React Native) crash reporting.** Grafana's React Native Faro SDK
is an experimental port, and Grafana's stated position is that React Native is
not officially supported. Shipping it into the app members actually use is a
judgement call rather than an obvious win — see the note in the admin portal's
`telemetry.ts` for the same decision on the web side, where the SDK *is*
supported and is therefore enabled.
