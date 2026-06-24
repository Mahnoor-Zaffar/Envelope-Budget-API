# Production Deployment on Render

This guide walks through deploying the Envelope Budget API with a managed PostgreSQL database on [Render](https://render.com).

## Prerequisites

- A GitHub repository containing this project
- A [Render](https://render.com) account (free tier works for development)

## Option A: One-Click Blueprint Deploy

1. Push this repository to GitHub.
2. In the Render Dashboard, click **New → Blueprint**.
3. Connect your GitHub repository.
4. Render reads `render.yaml` and provisions:
   - A **Web Service** running `npm start`
   - A **PostgreSQL** database linked via `DATABASE_URL`
5. Click **Apply** and wait for the deploy to finish.

## Option B: Manual Setup

### 1. Create the PostgreSQL Database

1. Render Dashboard → **New → PostgreSQL**
2. Name: `envelope-budget-db`
3. Copy the **Internal Database URL** (or External if testing remotely)

### 2. Create the Web Service

1. Render Dashboard → **New → Web Service**
2. Connect your GitHub repository
3. Configure:

| Setting        | Value              |
| -------------- | ------------------ |
| Runtime        | Node               |
| Build Command  | `npm install`      |
| Start Command  | `npm start`        |
| Health Check   | `/health`          |

### 3. Environment Variables

Add these in the Web Service **Environment** tab:

| Key            | Value                                      |
| -------------- | ------------------------------------------ |
| `NODE_ENV`     | `production`                               |
| `DATABASE_URL` | *(paste from PostgreSQL connection string)* |

Render injects `DATABASE_URL` automatically when you link a database under **Connections**.

### 4. Deploy

Click **Deploy**. On first boot the server will:

1. Authenticate with PostgreSQL (SSL enabled in production)
2. Run `sequelize.sync()` to create tables
3. Start listening on the assigned port

## Verify the Deployment

```bash
# Health check
curl https://<your-service>.onrender.com/health

# Swagger UI (open in browser)
https://<your-service>.onrender.com/api-docs

# Create an envelope
curl -X POST https://<your-service>.onrender.com/envelopes \
  -H "Content-Type: application/json" \
  -d '{"title":"Groceries","budget":500}'
```

## Local Development

```bash
cp .env.example .env
# Edit DATABASE_URL to match your local PostgreSQL instance
createdb envelope_budget   # if the database does not exist yet
npm install
npm run dev
```

Open http://localhost:3000/api-docs for interactive API documentation.

## Notes

- **Cold starts:** Free-tier Render services spin down after inactivity; the first request may take ~30 seconds.
- **SSL:** Production database connections use SSL automatically when `NODE_ENV=production`.
- **Schema sync:** Tables are created on startup via Sequelize `sync()`. For production migrations at scale, consider adding Sequelize CLI migrations in a future iteration.
