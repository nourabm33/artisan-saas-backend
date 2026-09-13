# Deployment & Monitoring Runbook

Target: a single Linux VPS (2 vCPU / 4 GB is plenty for the MVP) running Docker Compose, with a
TLS-terminating reverse proxy in front. The same image also runs unchanged on Fly.io, Railway,
Render or any Kubernetes cluster — only the process manager changes.

## 1. Architecture

```
                 https://api.example.it            https://app.example.it
Internet ──────► Caddy / Nginx (TLS) ─────► backend:3000        (Next.js frontend, separate repo)
                       │                        │  │
                       │                        │  └── redis:6379   (rate-limit counters)
                       │                        └───── postgres:5432
                       └── /metrics (bearer token) ──► Prometheus / Grafana Cloud
                                                    backend ──► Sentry (errors)
```

Image: `ghcr.io/nourabm33/artisan-saas-backend:<sha|tag|latest>`, built from the `production` target
of the `Dockerfile` (compiled JS, prod deps only, `node` user, `curl` for healthchecks).

## 2. First deploy

```bash
# on the server
sudo apt-get install -y docker.io docker-compose-plugin git
sudo mkdir -p /opt/artisan-saas && sudo chown "$USER" /opt/artisan-saas
cd /opt/artisan-saas
git clone https://github.com/nourabm33/artisan-saas-backend.git .

cp .env.production.example .env.production
# fill in: POSTGRES_PASSWORD, JWT_SECRET, APP_URL, CORS_ORIGIN, METRICS_TOKEN, SENTRY_DSN, Twilio, Cloudinary
openssl rand -hex 24   # POSTGRES_PASSWORD / METRICS_TOKEN
openssl rand -hex 48   # JWT_SECRET

docker compose -f docker-compose.prod.yml --env-file .env.production pull   # or: build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl -s localhost:3000/api/v1/health/ready | jq
```

Startup order is enforced by Compose: `postgres` healthy → `migrate` (one-shot, applies the
idempotent `schema.sql`) exits 0 → `backend` starts → `backend` healthy when `/health/ready` is 200.

Config validation is strict in production and the container refuses to start (exit 1, reason in
logs) if `JWT_SECRET` is < 32 chars or the dev placeholder, `CORS_ORIGIN` is `*`, or any URL is
malformed.

### Reverse proxy (Caddy example)

```
api.example.it {
    reverse_proxy localhost:3000 {
        header_up X-Request-Id {http.request.uuid}
    }
}
```

The app trusts one proxy hop (`trust proxy = 1`), so `X-Forwarded-For` from the proxy is used for
rate limiting. Forwarding `X-Request-Id` makes proxy and app logs share the same correlation id.

### Twilio webhook

Point the WhatsApp sandbox/number inbound webhook at `https://api.example.it/api/v1/whatsapp/webhook`
(POST). It is rate-limited by `RATE_LIMIT_PUBLIC_MAX` per IP.

## 3. Releases

The GitHub Actions workflows live in `deploy/github-workflows/` because the bot that opened the PR
lacks the `workflow` OAuth scope needed to write under `.github/workflows/`. Activate them once:

```bash
mkdir -p .github/workflows && cp deploy/github-workflows/*.yml .github/workflows/ && git add .github && git commit -m "ci: enable workflows" && git push
```

- Every push to `main` runs `ci.yml` (lint, format, typecheck, tests, build, `npm audit`, production
  image smoke test against the real compose stack) and then `release.yml` publishes
  `ghcr.io/nourabm33/artisan-saas-backend:{sha-<full sha>,latest}`. Git tags `v*` add a version tag.
- `APP_RELEASE` is baked into the image from the commit SHA and reported by `/health` (`version`) and
  Sentry (`release`).

### Manual upgrade

```bash
cd /opt/artisan-saas && git pull
sed -i "s/^APP_RELEASE=.*/APP_RELEASE=$(git rev-parse HEAD)/" .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --remove-orphans
```

The `migrate` service re-runs on every `up`; `schema.sql` uses `IF NOT EXISTS` everywhere, so
it is safe. For destructive schema changes add a new numbered SQL file and extend
`src/infrastructure/database/migrations/run.ts` before running `up`.

### Automatic deploy (optional)

Set repository variable `DEPLOY_ENABLED=true` (and optionally `DEPLOY_DIR`) plus secrets
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`; `release.yml` then SSHes in after publishing and
runs the upgrade above. Use a dedicated deploy user whose key is restricted to that command.

### Rollback

```bash
BACKEND_IMAGE=ghcr.io/nourabm33/artisan-saas-backend:sha-<previous sha> \
docker compose -f docker-compose.prod.yml --env-file .env.production up -d backend
```

## 4. Monitoring

| Signal      | Where                                                  | Notes                                                                                           |
| ----------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Liveness    | `GET /api/v1/health/live`                              | Process only. Docker `HEALTHCHECK`; k8s `livenessProbe`.                                       |
| Readiness   | `GET /api/v1/health` / `/health/ready`                 | Probes PostgreSQL + Redis, `503` when degraded. LB / `readinessProbe`. Includes `version`.       |
| Metrics     | `GET /metrics` with `Authorization: Bearer $METRICS_TOKEN` | Prometheus text format: `artisan_http_requests_total`, `artisan_http_request_duration_seconds`, `artisan_http_requests_in_flight`, plus Node process/GC/event-loop defaults. Route labels are normalised (`/api/v1/quotes/:id`). |
| Errors      | Sentry (`SENTRY_DSN`)                                  | Unhandled 5xx, unhandled rejections, uncaught exceptions. Tagged with `request_id`, `org_id`, user id, `release`. Handled 4xx are never sent. |
| Logs        | container stdout (JSON)                                | Winston JSON, one line per request: `requestId`, `method`, `path`, `status`, `durationMs`. Ship with `docker logs`, Loki/Promtail, Vector or your PaaS collector. Rotated at 10 MB × 5 by the compose logging config. |

### Prometheus scrape config

```yaml
scrape_configs:
  - job_name: artisan-backend
    scheme: https
    authorization: { credentials: '<METRICS_TOKEN>' }
    static_configs: [{ targets: ['api.example.it'] }]
```

### Suggested alerts

```yaml
- alert: BackendDown
  expr: up{job="artisan-backend"} == 0
  for: 2m
- alert: High5xxRate
  expr: sum(rate(artisan_http_requests_total{status=~"5.."}[5m])) / sum(rate(artisan_http_requests_total[5m])) > 0.02
  for: 5m
- alert: SlowRequests
  expr: histogram_quantile(0.95, sum(rate(artisan_http_request_duration_seconds_bucket[5m])) by (le)) > 1
  for: 10m
- alert: RateLimitedSpike
  expr: sum(rate(artisan_http_requests_total{status="429"}[5m])) > 5
  for: 5m
```

### Debugging a user report

1. Ask for the `X-Request-Id` (the frontend surfaces `error.requestId` on 500s).
2. `docker compose -f docker-compose.prod.yml logs backend | grep <id>` — request line + stack trace.
3. Same id is a tag in Sentry (`request_id:<id>`).

## 5. Backups

`scripts/backup-db.sh` runs `pg_dump --format=custom` inside the `postgres` container, gzips it to
`backups/`, optionally uploads to S3 (`S3_BUCKET=s3://...`) and prunes files older than
`RETENTION_DAYS` (default 7).

```bash
# cron, nightly at 02:30
30 2 * * * cd /opt/artisan-saas && ./scripts/backup-db.sh >> backups/backup.log 2>&1
```

Restore:

```bash
gunzip -c backups/artisan_saas-<stamp>.dump.gz | \
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres pg_restore -U artisan -d artisan_saas --clean --if-exists
```

Test a restore into a scratch database at least once after the first deploy and quarterly after.

Uploads on local disk live in the `uploads_data` volume (`docker run --rm -v
artisan-saas_uploads_data:/data -v "$PWD":/out alpine tar czf /out/uploads.tgz -C /data .`); with
Cloudinary configured there is nothing to back up locally. Redis holds only rate-limit counters and
needs no backup.

## 6. Security checklist

- [ ] `JWT_SECRET` ≥ 32 random chars, `POSTGRES_PASSWORD` random, `METRICS_TOKEN` set.
- [ ] `CORS_ORIGIN` lists only the dashboard origin(s).
- [ ] Only ports 80/443 are exposed on the host firewall; `BACKEND_PORT` bound to `127.0.0.1:3000`
      if the proxy is on the same box (`BACKEND_PORT=127.0.0.1:3000`).
- [ ] `.env.production` is `chmod 600` and never committed (`.gitignore` covers it).
- [ ] Dependabot / `npm audit` (in CI, fails on high) reviewed monthly.
- [ ] Sentry DSN and Twilio/Cloudinary keys rotated if ever leaked; the app restarts in seconds.

## 7. Scaling notes

- The API is stateless (JWT, Redis-backed rate limits), so `docker compose up --scale backend=N`
  behind the proxy works, as do multiple replicas on Kubernetes.
- Move PostgreSQL to a managed instance (Supabase, Neon, RDS) by changing `DATABASE_URL`; remove the
  `postgres` service and the `migrate` dependency stays valid.
- Switch uploads to Cloudinary before running more than one replica (local disk is per-node).
