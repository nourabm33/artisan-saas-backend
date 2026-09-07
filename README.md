# Artisan SaaS - Backend

Production-ready Node.js + Express + TypeScript backend for Italian artisans (MVP: **Gommista** - tire services).

Phase 1 & 2: project infrastructure, PostgreSQL schema, domain model, authentication (register / login / refresh / me).

## Architecture

Clean architecture, dependencies point inward:

```
src/
├── domain/          entities, value objects (Email, Phone, Money), domain errors, repository interfaces
├── application/     use cases, AuthService (bcrypt + JWT), DTOs + Joi schemas
├── infrastructure/  Express app, controllers, middleware, pg repositories, schema.sql, logger
├── config/          env validation (Joi)
└── main.ts          composition root
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (local development)

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the `.env` file:

   ```bash
   cp .env.example .env
   ```

3. Start everything (PostgreSQL + Redis + backend with hot reload):

   ```bash
   docker compose up -d
   ```

   The schema in `src/infrastructure/database/schema.sql` is applied automatically the first time
   the `postgres` volume is created.

   To run the backend on the host instead, start only the infrastructure and use `npm run dev`:

   ```bash
   docker compose up -d postgres redis
   npm run dev
   ```

4. (Optional) seed a demo organization (`demo@gommista.it` / `Password123!`):

   ```bash
   npm run seed
   ```

### Health Check

```bash
curl http://localhost:3000/api/v1/health
```

## API

Base URL: `http://localhost:3000/api/v1`

| Method | Path             | Auth   | Description                                    |
| ------ | ---------------- | ------ | ---------------------------------------------- |
| GET    | `/health`        | -      | Liveness + DB/Redis status (`200` ok / `503`)  |
| POST   | `/auth/register` | -      | Create organization + owner user, returns JWTs |
| POST   | `/auth/login`    | -      | Returns access + refresh tokens                |
| POST   | `/auth/refresh`  | -      | Exchange a refresh token for a new pair        |
| GET    | `/auth/me`       | Bearer | Current user                                   |

Register:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "organizationName": "Gommista Rossi",
    "tradeType": "gommista",
    "firstName": "Mario",
    "lastName": "Rossi",
    "email": "mario@rossi.it",
    "phone": "+39 333 123 4567",
    "password": "SecurePassword123!",
    "passwordConfirm": "SecurePassword123!"
  }'
```

Errors follow a single shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": { "email": ["..."] } } }
```

Codes: `VALIDATION_ERROR` 400, `INVALID_JSON` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
`CONFLICT` 409, `INTERNAL_ERROR` 500.

## Scripts

```bash
npm run dev          # ts-node-dev with hot reload
npm run build        # compile to dist/
npm start            # run compiled build
npm test             # jest with coverage (unit + supertest integration, no DB needed)
npm run test:watch
npm run typecheck
npm run lint / lint:fix
npm run format / format:check
npm run migrate      # apply schema.sql to DATABASE_URL (idempotent)
npm run seed         # demo organization + user + service templates
```

## Environment Variables

See `.env.example`. `JWT_SECRET` must be at least 16 characters (32 in production, and the example
value is rejected in production). `CORS_ORIGIN` accepts a comma-separated list or `*`.

## Next Phases

- Phase 3: clients, service templates, requests, quotes, appointments
- Phase 4: notifications, media (Cloudinary), reviews, Stripe billing
