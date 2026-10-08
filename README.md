# Padosi 🏘️ — Hyperlocal Resource Sharing

> *Borrow from neighbours, not a store.*

Padosi is a full-stack platform where neighbours lend and borrow items (tools, camping gear, party equipment, appliances) instead of everyone buying their own. It is designed to feel trustworthy, fast, and pleasant to use.

![Python](https://img.shields.io/badge/python-3.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688)
![React](https://img.shields.io/badge/React-18-61dafb)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Table of contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Getting started](#getting-started)
5. [Environment variables](#environment-variables)
6. [Make commands](#make-commands)
7. [Core concepts](#core-concepts)
8. [Design system](#design-system)
9. [Data and privacy](#data-and-privacy)
10. [Testing](#testing)
11. [Code quality and CI/CD](#code-quality-and-cicd)
12. [Deployment](#deployment)
13. [Troubleshooting](#troubleshooting)
14. [Scope](#scope)
15. [Contributing](#contributing)

---

## Features

- Phone OTP authentication via Supabase
- Item listings with photo upload and price suggestion
- Map-based discovery with distance, category and date filters
- Full booking state machine (requested → closed / disputed)
- Concurrent booking conflict prevention (distributed Redis lock)
- Condition-verification photos at pickup and return
- Trust score from on-time returns, no-shows and disputes
- Real-time booking status updates over WebSockets
- Push (FCM) and email (Resend) notifications
- Installable PWA with an offline-queued borrow request flow
- Dark-mode-first custom design system

---

## Architecture

```
padosi/
├── backend/                   FastAPI + Python 3.12
│   ├── app/
│   │   ├── api/v1/routers/    HTTP route handlers (thin, no business logic)
│   │   ├── services/          Business logic layer
│   │   ├── repositories/      Data-access layer (SQLAlchemy async)
│   │   ├── models/            SQLAlchemy ORM models
│   │   ├── schemas/           Pydantic v2 request/response schemas
│   │   ├── core/              Config, security, Redis/Redlock, exceptions, logging
│   │   ├── worker/            Celery tasks (trust score, notifications, deposits)
│   │   └── websockets/        Real-time connection manager
│   ├── alembic/               Versioned DB migrations
│   └── tests/                 Unit + concurrency integration tests
├── frontend/                  React 18 + Vite + TypeScript
│   └── src/
│       ├── components/        UI primitives, map, items, booking, trust
│       ├── pages/             Discover, Listings, Bookings, Profile, Auth
│       ├── hooks/             WebSocket, geolocation, items queries
│       ├── stores/            Zustand (auth, map state, offline queue)
│       ├── api/               Typed API client with offline queuing
│       └── types/             Domain type definitions
├── scripts/                   Dev seed data and Supabase bucket setup
├── docker-compose.yml         Local dev stack (API + Worker + Redis)
├── Makefile                   Developer convenience commands
├── render.yaml                Render.com deployment manifest
├── vercel.json                Vercel frontend deployment config
├── .pre-commit-config.yaml    Pre-commit hooks
└── .github/workflows/ci.yml   GitHub Actions CI/CD
```

The backend is layered: **router → service → repository → model**. Routers only parse requests and shape responses; all rules live in services.

---

## Tech stack

### Backend

| Concern | Choice | Notes |
|---|---|---|
| Framework | FastAPI | Async-native, automatic OpenAPI docs |
| Validation | Pydantic v2 + pydantic-settings | All config from env, no hardcoded secrets |
| ORM | SQLAlchemy 2.0 (async) | Fully async query pipeline |
| Migrations | Alembic | Versioned from day 0 |
| Database | Supabase (managed PostgreSQL) | PostGIS for geo search, pgvector reserved for future semantic search |
| Auth | Supabase phone OTP | No hand-rolled credential logic |
| File storage | Supabase Storage | Listing and condition photos |
| Cache / lock | Upstash Redis | Distributed lock for booking concurrency, Celery broker |
| Background jobs | Celery | Trust score, notifications, deposit processing |
| Notifications | FCM (push) + Resend (email) | Free tiers |
| Payments | Razorpay (test mode) | Sandbox only during development |
| Real-time | Native FastAPI WebSockets | Pushed booking status updates |

### Frontend

| Concern | Choice | Notes |
|---|---|---|
| Framework | React 18 + Vite + TypeScript | Strict mode |
| Styling | Tailwind CSS (custom design system) | Warm terracotta + soil palette |
| Animation | Framer Motion | Item cards, bottom sheets, confirmations |
| Map | MapLibre GL | Open source; clustering and markers |
| Server state | TanStack Query v5 | Caching, background refresh, optimistic updates |
| Client state | Zustand | Auth, map filters, offline queue |
| PWA | vite-plugin-pwa + Workbox | Service worker, offline queue, installable |

### Tooling

ruff, black, mypy (strict), pytest, ESLint, TypeScript, pre-commit, GitHub Actions, Docker Compose.

---

## Getting started

### Prerequisites

- Docker Desktop
- Node.js ≥ 22
- Python 3.12
- A free [Supabase](https://supabase.com) project (with PostGIS enabled)
- Optional for full functionality: Upstash Redis, Razorpay test keys, Firebase project, Resend account

### 1. Clone and configure

```bash
git clone <your-repo-url> padosi
cd padosi
make env          # copies .env.example to .env if it doesn't exist
```

Open `.env` and fill in your Supabase credentials (see [Environment variables](#environment-variables)). Redis can stay as `redis://redis:6379` for local Docker; `docker-compose.yml` overrides it automatically.

### 2. Enable PostGIS in Supabase

In the Supabase SQL editor:

```sql
create extension if not exists postgis;
```

### 3. Start the backend stack

```bash
make up           # or: docker compose up --build
```

This starts:

| Service | URL / port | Notes |
|---|---|---|
| API | http://localhost:8000 | Hot reload enabled; Swagger UI at `/docs` |
| Celery worker | n/a | Concurrency 2, connected to local Redis |
| Redis | localhost:6379 | Local stand-in for Upstash |

The database is cloud-hosted on Supabase, so no local Postgres container is needed.

### 4. Run migrations

```bash
make migrate      # cd backend && alembic upgrade head
```

### 5. Create storage buckets and seed data (optional)

```bash
make setup-supabase   # creates `item-photos` and `condition-photos` buckets
make seed             # 3 users, 8 items
```

### 6. Start the frontend

```bash
make install      # npm install
make frontend     # http://localhost:5173
```

---

## Environment variables

Copy `.env.example` to `.env`. **Never commit `.env`.** It is already in `.gitignore`.

| Variable | Used by | Description |
|---|---|---|
| `APP_ENV` | API, worker | `development` or `production` |
| `APP_SECRET_KEY` | API | Long random string. Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ALLOWED_ORIGINS` | API | CORS origins. Must match the format your settings class parses (comma-separated in `.env.example`) |
| `SUPABASE_URL` | API, worker | Project URL |
| `SUPABASE_ANON_KEY` | API, worker | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | API, worker | **Backend only.** Bypasses RLS; never expose to the frontend |
| `SUPABASE_JWT_SECRET` | API | Used to verify Supabase-issued JWTs |
| `DATABASE_URL` | API, worker | `postgresql+asyncpg://...` (async driver) |
| `DATABASE_SYNC_URL` | Alembic | `postgresql+psycopg2://...` (sync driver for migrations) |
| `REDIS_URL` | API | Redis for locks and cache |
| `CELERY_BROKER_URL` | API, worker | Redis DB 0 |
| `CELERY_RESULT_BACKEND` | API, worker | Redis DB 1 |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | API, worker | Test-mode keys |
| `FCM_CREDENTIALS_PATH` | Worker | Path to Firebase service-account JSON |
| `RESEND_API_KEY` / `EMAIL_FROM` | Worker | Transactional email |
| `DEFAULT_SEARCH_RADIUS_KM` / `MAX_SEARCH_RADIUS_KM` | API | Discovery limits (5 / 50) |
| `TRUST_WEIGHT_ON_TIME_RETURN` / `_NO_SHOW_PENALTY` / `_DISPUTE_PENALTY` | Worker | Trust score weights (0.5 / 0.3 / 0.2) |
| `DEPOSIT_HOLD_HOURS` | Worker | Hours after return before deposit auto-release (72) |
| `BOOKING_REQUEST_EXPIRY_HOURS` | Worker | Window for owner to approve (24) |

Frontend (Vite; the `VITE_` prefix exposes these to the browser, so **never put secrets here**):

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend URL (`http://localhost:8000` locally) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_MAPLIBRE_STYLE` | Map style URL (MapLibre demo tiles or MapTiler) |
| `VITE_RAZORPAY_KEY_ID` | Razorpay **test** key ID |

---

## Make commands

Run `make help` for the full list. The most useful ones:

| Command | What it does |
|---|---|
| `make up` / `make up-detach` / `make down` | Start (foreground / background) and stop the Docker stack |
| `make logs` | Tail all container logs |
| `make migrate` / `make migrate-down` | Apply / roll back Alembic migrations |
| `make db-shell` | psql into the Supabase database |
| `make redis-cli` | redis-cli into the local container |
| `make test`, `test-unit`, `test-integration`, `test-cov` | Run tests (coverage gate: 70%) |
| `make lint` / `make format` / `make typecheck` | Ruff + ESLint / Black + ruff format / mypy + tsc |
| `make check` | Lint + format + typecheck + test |
| `make frontend` / `make build-fe` | Vite dev server / production build |
| `make install-hooks` | Install pre-commit hooks |
| `make clean` | Remove build artifacts |

---

## Core concepts

### Booking state machine

```
requested → approved → picked_up → returned → closed
         ↘ rejected              ↘ disputed
         ↘ cancelled
         (approved) ↘ cancelled
```

All transitions are enforced in `app/models/booking.py: Booking.transition_to()`. Invalid moves raise `InvalidStateTransition`; they are never silently ignored.

**Concurrency guarantee:** the approval step acquires a distributed Redis lock (Redlock pattern, `app/core/redis.py: DistributedLock`) before checking for overlapping bookings. Two concurrent approval requests for the same item and dates cannot both succeed.

### Trust score

A number in `[0.0, 1.0]` computed from borrowing history:

```
score = w_on_time × on_time_rate
      − w_no_show × no_show_rate
      − w_dispute × dispute_rate
```

| Signal | Default weight |
|---|---|
| `on_time_rate` (on-time returns / total borrowings) | 0.50 |
| `no_show_rate` (no-shows / total booking requests) | 0.30 |
| `dispute_rate` (disputes as borrower / total borrowings) | 0.20 |

Weights are configurable through env vars. New users have `score = null` and are shown as "New to Padosi" rather than a fake default.

| Score | Label |
|---|---|
| null | New to Padosi |
| 0.0 – 0.4 | Building Trust |
| 0.4 – 0.7 | Trusted Neighbor |
| 0.7 – 0.9 | Highly Trusted |
| 0.9 – 1.0 | Padosi Champion |

---

## Design system

- **Feel:** warm, tactile, community-oriented rather than a generic SaaS dashboard
- **Palette:** Rust `#C4622D`, Amber `#E8973E`, Soil `#1A1410 / #2C1F14`, Cream `#F5EDD8`, Sage `#7A9E7E`
- **Typography:** Fraunces (display/headings) + DM Sans (body)
- **Dark mode** is the primary mode, not an inverted afterthought
- **Grain texture overlay** on backgrounds
- **Warm tinted shadows** via `shadow-warm-*` utilities

---

## Data and privacy

- **Condition photos** live in the `condition-photos` Supabase bucket and are accessible only to booking participants.
- **Item photos** live in the `item-photos` bucket with public URLs.
- **Location** is stored at the item level as a PostGIS `POINT`. Exact coordinates are never returned by the API; only the `location_label` (neighbourhood name) is public.
- **Payment data** (Razorpay order/payment IDs) is stored server-side only and never sent to the borrower's client.
- **Row-Level Security:** the backend currently uses the Supabase service-role key, which bypasses RLS. Add RLS policies before production hardening.

---

## Testing

```bash
cd backend
pytest tests/ -v
```

- `tests/unit/test_booking_state_machine.py`: all valid and invalid transitions
- `tests/unit/test_trust_score.py`: algorithm correctness and edge cases
- `tests/integration/test_booking_concurrency.py`: fires N simultaneous approval requests and asserts exactly one succeeds

The integration test needs a reachable Redis instance (`make up` provides one).

---

## Code quality and CI/CD

### Pre-commit hooks

```bash
make install-hooks     # pip install pre-commit && pre-commit install
```

Hooks run on every commit: ruff (+ format), black, mypy `--strict` on `backend/app/`, trailing whitespace, EOF fixer, YAML/JSON/TOML checks, merge-conflict detection, **private-key detection**, large-file check (500 KB), and a guard that blocks direct commits to `main`. Work on a feature branch and open a PR.

### GitHub Actions (`.github/workflows/ci.yml`)

1. **Backend:** ruff → black check → mypy → pytest with coverage
2. **Frontend:** TypeScript type check → ESLint → Vite build
3. **On push to `main`:** deploy backend to Render and frontend to Vercel

---

## Deployment

Padosi deploys as three pieces: the **API** and **worker** on Render, and the **frontend** on Vercel. Supabase and Upstash are already hosted. Everything below can start on free tiers.

### Deployment checklist

- [ ] Supabase project created, PostGIS enabled, buckets created
- [ ] Upstash Redis database created
- [ ] Production secrets generated (new `APP_SECRET_KEY`, etc.)
- [ ] Backend deployed on Render, `/health` returns 200
- [ ] Frontend deployed on Vercel with `VITE_*` vars set
- [ ] Backend `ALLOWED_ORIGINS` includes the Vercel URL
- [ ] Migrations applied

### 1. Supabase (database, auth, storage)

1. Create a project at [supabase.com](https://supabase.com) (pick the region closest to your users, e.g. Mumbai/Singapore).
2. **SQL editor:** `create extension if not exists postgis;`
3. **Settings → API:** copy the project URL, anon key, service-role key and JWT secret.
4. **Settings → Database → Connection string:** copy the URI and build both URLs:
   - `DATABASE_URL=postgresql+asyncpg://postgres:<password>@<host>:5432/postgres`
   - `DATABASE_SYNC_URL=postgresql+psycopg2://postgres:<password>@<host>:5432/postgres`
   - URL-encode special characters in the password (e.g. `!` → `%21`).
5. **Authentication → Providers:** enable Phone and configure an SMS provider (Twilio, MessageBird, etc.) for OTP.
6. Create the storage buckets: `make setup-supabase`, or manually create `item-photos` (public) and `condition-photos` (private).

### 2. Upstash Redis

1. Create a Redis database at [console.upstash.com](https://console.upstash.com).
2. Copy the `rediss://` URL and use it for `REDIS_URL`, `CELERY_BROKER_URL` (append `/0`) and `CELERY_RESULT_BACKEND` (append `/1`).
3. Upstash requires TLS. Celery's Redis transport needs an SSL option on `rediss://` URLs; if the worker fails to connect, append `?ssl_cert_reqs=CERT_NONE` (or configure `broker_use_ssl` / `redis_backend_use_ssl` in your Celery app).

> Heads-up: Celery polls Redis frequently, which can burn through Upstash's free 500K commands/month. Monitor usage, or use a longer polling interval.

### 3. Backend → Render

`render.yaml` defines two services (`padosi-api` web service and `padosi-worker` background worker) in the Singapore region.

1. Push the repo to GitHub.
2. In Render: **New → Blueprint** and select the repo. Render detects `render.yaml`.
3. For every variable marked `sync: false`, enter the value in the dashboard. Required for the API:
   `DATABASE_URL`, `DATABASE_SYNC_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `RESEND_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
4. Add variables that are **not** in `render.yaml` but your app needs:
   - `ALLOWED_ORIGINS`: your Vercel URL(s), in the format your settings class expects
   - `PYTHON_VERSION=3.12.x` (Render's default Python may differ from 3.12)
   - `FCM_CREDENTIALS_PATH` or inline credentials (use Render **Secret Files** for the Firebase JSON)
   - `EMAIL_FROM`, trust-score weights, and booking/deposit settings if you want non-default values
5. Deploy. The build command installs requirements and runs `alembic upgrade head`, so migrations apply automatically on each deploy.
6. Verify: `https://<your-service>.onrender.com/health` should return 200, and `/docs` should load.

**Free-tier notes**

- The web service spins down after 15 minutes of inactivity (cold start ≈ 30 s). Use an uptime pinger against `/health` if that is a problem.
- Render's free plan covers **web services only**. Background workers are a paid instance type, so the `padosi-worker` block with `plan: free` will likely be rejected or require upgrading to a paid plan (e.g. `starter`). Options: pay for the worker, or temporarily run Celery tasks eagerly / in-process for a demo deployment.
- `--workers 1` is deliberate on the free instance's limited memory.

### 4. Frontend → Vercel

`vercel.json` already configures the build (`cd frontend && npm install && npm run build`), output directory (`frontend/dist`), SPA rewrites, immutable asset caching, and security headers (`nosniff`, `X-Frame-Options: DENY`, referrer policy).

**Via dashboard**

1. **Add New → Project** and import the repo (leave the root directory as the repo root).
2. Add environment variables (Production, and Preview if desired):
   - `VITE_API_BASE_URL` = your Render API URL
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `VITE_MAPLIBRE_STYLE`
   - `VITE_RAZORPAY_KEY_ID` (test key)
3. Deploy.

**Via CLI**

```bash
npm i -g vercel
vercel --prod
```

Vite bakes `VITE_*` values in at build time, so **redeploy after changing any of them**.

### 5. Connect the pieces

1. Add the Vercel domain to the backend's `ALLOWED_ORIGINS` and redeploy the API.
2. In Supabase **Authentication → URL Configuration**, set the site URL and redirect URLs to the Vercel domain.
3. If you use Razorpay webhooks, point them at `https://<api-host>/api/v1/...` (your webhook route) and set the same secret as `RAZORPAY_WEBHOOK_SECRET`.

### 6. CI/CD deploys from GitHub Actions

On push to `main`, the workflow deploys both services. Add these repository secrets (**Settings → Secrets and variables → Actions**), matching what `ci.yml` references:

| Secret | Purpose |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` (or equivalent) | Triggers a Render deploy |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Vercel CLI deploys |

Check `ci.yml` for the exact secret names your workflow uses. Because the pre-commit hook blocks commits to `main`, all changes go through pull requests.

### Production hardening before real users

- Rotate every secret if any has ever been shared, pasted or committed
- Add Supabase RLS policies; stop relying on the service-role key for user-facing reads
- Restrict `ALLOWED_ORIGINS` to your real domains only
- Switch Razorpay to live keys only after implementing the real capture flow (currently stubbed)
- Add error monitoring (e.g. Sentry) and uptime checks
- Enable Supabase backups (paid) or schedule your own `pg_dump`

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Migrations fail to connect to Supabase | Direct DB hosts can be IPv6-only. Use Supabase's **connection pooler** URI (session mode) if your host has no IPv6, and check password URL-encoding |
| `alembic` can't find models | Run from `backend/` and make sure `DATABASE_SYNC_URL` uses the `psycopg2` driver |
| CORS errors in the browser | The frontend origin is missing from `ALLOWED_ORIGINS`, or the value isn't in the format your settings parser expects |
| Celery worker can't connect to Upstash | TLS options missing on `rediss://`; see the Upstash section |
| First request is very slow on Render | Free-tier cold start; ping `/health` periodically |
| Frontend still hits `localhost` after deploy | `VITE_API_BASE_URL` not set in Vercel, or you haven't redeployed since setting it |
| Geo queries fail | PostGIS extension not enabled in Supabase |
| Phone OTP never arrives | No SMS provider configured in Supabase Auth |
| Pre-commit blocks your commit to `main` | By design (`no-commit-to-branch`); create a feature branch |

---

## Scope

**In v1 (MVP)**

- [x] Auth via Supabase phone OTP
- [x] Item listing with photo upload + price suggestion
- [x] Map-based discovery with distance/category/date filters
- [x] Full booking state machine
- [x] Concurrent booking conflict prevention (Redlock)
- [x] Condition photos at pickup and return
- [x] Trust score
- [x] Real-time status updates via WebSocket
- [x] FCM push + Resend email notifications
- [x] PWA: installable, offline-queued borrow requests
- [x] Dark-mode-first design system

**Out of scope for v1**

- [ ] Dispute arbitration automation (manual review only)
- [ ] Semantic search with pgvector (category + distance for now)
- [ ] Razorpay payment capture (deposit flow modelled; API calls stubbed as Celery tasks)
- [ ] Native mobile apps (PWA only)
- [ ] Dedicated observability stack (Grafana/Prometheus)

---

## Contributing

1. Create a feature branch (direct commits to `main` are blocked)
2. `make install-hooks` once
3. Make your change with tests
4. `make check` must pass
5. Open a pull request

---

## License

Add your license here (e.g. MIT) and a `LICENSE` file at the repo root.
