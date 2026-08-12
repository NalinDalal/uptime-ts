# Uptime

Multi-region website monitoring with incident tracking, alerting, and public status pages.

## Stack

- **Runtime**: Bun
- **Frontend**: Next.js 16 + TypeScript + Tailwind v4
- **API**: Express + Prisma
- **Worker**: Bun + Redis Streams consumer groups
- **Database**: PostgreSQL 16
- **Queue**: Redis Streams
- **Infra**: Docker Compose

## Architecture

```text
Browser (Next.js)
    │
    ▼
API Server (Express + Prisma)
    │
    ├──▶ PostgreSQL (websites, users, ticks, incidents, maintenance)
    │
    └──▶ Redis Streams (check queue)
              │
              ▼
        Workers (per region)
              │
              └──▶ HTTP checks → tick writes → incident/webhook alerts
```

The API stores websites and serves the Next.js frontend. A Redis Streams queue distributes check jobs across regional workers. Each worker performs the HTTP check, writes a tick, and fires webhooks on status changes. The public status page reads from the same Postgres database.

## Project structure

```text
apps/
├── api/          # Express REST API + Prisma service
├── web/          # Next.js frontend (landing, dashboard, status pages)
└── worker/       # Regional Redis Streams consumer

packages/
├── store/        # Shared Prisma client + schema
└── redis/        # Shared Redis client
```

## Prerequisites

- [Bun](https://bun.sh) >= 1.2
- Docker + Docker Compose
- Node.js >= 18 (for tooling)

## Setup

1. Start Postgres and Redis:

   ```bash
   docker compose up -d
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Apply Prisma migrations:

   ```bash
   cd packages/store
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/uptime" \
     bunx prisma migrate deploy
   cd ../..
   ```

4. Seed regions:

   ```bash
   docker exec -i uptime-postgres \
     psql -U postgres -d uptime \
     -c "INSERT INTO region (id, name) VALUES ('india', 'India'), ('usa', 'USA'), ('nigeria', 'Nigeria');"
   ```

## Environment

Create a `.env` in the repo root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/uptime"
JWT_SECRET="dev-secret"
```

The API and worker both load `.env` automatically via Bun.

## Running

### API server

```bash
cd apps/api
bun run index.ts
```

Runs on `http://localhost:3001`.

### Frontend

```bash
cd apps/web
bun run dev
```

Runs on `http://localhost:3000`.

### Worker

```bash
cd apps/worker
REGION_ID=india WORKER_ID=india-1 bun run index.ts
```

Run one worker per region. Workers consume from the Redis Streams consumer group and perform the actual HTTP checks.

## Scripts

```bash
bun run dev        # Start all apps via turbo
bun run build      # Build all apps
bun run lint       # Lint all apps
bun run check-types # TypeScript check across workspace
bun run format     # Prettier write
```

## Key endpoints

- `POST /user/signup` — create account
- `POST /user/signin` — authenticate, returns JWT
- `POST /website` — add monitor (auth required)
- `GET /public/status/:userId` — public status page JSON
- `GET /public/status/:userId/history` — incident + maintenance timeline
- `GET /public/maintenance/:userId` — active/upcoming maintenance
- `POST /maintenance` — create maintenance window (auth required)
- `GET /user/webhook` — get alert webhook URL (auth required)
- `PATCH /user/webhook` — set alert webhook URL (auth required)

## License

Private
