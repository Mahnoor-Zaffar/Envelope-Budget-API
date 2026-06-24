# Product Requirements Document (PRD): Envelope Budget API — Part IV

## 1. Objective

Harden the portfolio/production story with CI, migrations, auth foundation, paginated list endpoints, and monthly analytics — without breaking the existing single-tenant envelope model.

## 2. Delivered Scope

| Area | Deliverable |
|------|-------------|
| CI | GitHub Actions workflow running `npm test` against PostgreSQL |
| Migrations | `migrations/runner.js` applied in production instead of blind `sync()` |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (JWT) |
| Pagination | `page` & `limit` on `GET /envelopes` and `GET /transactions` |
| Reports | `GET /reports/monthly?year=&month=` spending summary |
| Docs | `DOCS.md`, `CONTRIBUTING.md`, redeploy + custom domain in `DEPLOYMENT.md` |
| Swagger | Updated OpenAPI spec for new routes |

## 3. Out of Scope (Future)

- Per-user envelope ownership (`userId` on envelopes)
- OAuth / refresh tokens
- Sequelize CLI migration files (runner uses JS migrations)
- Frontend auth UI

## 4. Acceptance Criteria

- [x] `npm test` passes locally and in GitHub Actions
- [x] Production boot runs migrations safely on existing Render DBs
- [x] Auth endpoints return JWT without breaking unauthenticated envelope flows
- [x] Paginated list responses include `pagination` metadata
- [x] Monthly report aggregates spend by envelope
