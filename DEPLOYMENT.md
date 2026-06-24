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
| `JWT_SECRET`   | *(long random string for auth tokens)*     |

Render injects `DATABASE_URL` automatically when you link a database under **Connections**.

### 4. Deploy

Click **Deploy**. On first boot the server will:

1. Authenticate with PostgreSQL (SSL enabled in production)
2. Run versioned **migrations** from `migrations/` (production only)
3. Start listening on the assigned port

## Redeploy after pushing to GitHub

Render auto-deploys when **Auto-Deploy** is enabled on the Web Service (default for Git-connected services).

After every `git push origin main`:

1. Open your Web Service in the [Render Dashboard](https://dashboard.render.com)
2. Confirm a new deploy appears under **Events** (or click **Manual Deploy → Deploy latest commit**)
3. Watch **Logs** for:
   ```text
   ✓  Migration applied: …
   ✓  PostgreSQL connected and models synchronized.
   ✦  Envelope Budget API listening on …
   ```
4. Smoke-test: `curl https://envelope-budget-api.onrender.com/health`

**Live production URL:** https://envelope-budget-api.onrender.com

## Custom domain (optional)

1. Render Dashboard → your **Web Service** → **Settings** → **Custom Domains**
2. Click **Add Custom Domain** and enter your domain (e.g. `budget.example.com`)
3. Add the DNS records Render provides (usually a CNAME to your `*.onrender.com` hostname)
4. Wait for DNS verification (can take up to 48 hours; often minutes)
5. Render provisions HTTPS automatically via Let's Encrypt

Keep the default `*.onrender.com` URL as a fallback during DNS propagation.

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

- **Cold starts:** Free-tier Render web services spin down after ~15 minutes of inactivity; the first request may take ~30 seconds.
- **Free PostgreSQL:** Render free databases expire after **30 days** (one free DB per account). Upgrade or export data before expiry.
- **SSL:** Production database connections use SSL automatically when `NODE_ENV=production`.
- **Migrations:** Production runs `migrations/runner.js` on boot; development uses `sequelize.sync()`.
- **CI:** GitHub Actions runs `npm test` on every push to `main` (see `.github/workflows/ci.yml`).
