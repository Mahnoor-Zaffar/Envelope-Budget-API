# TODO.md

## 📋 Kanban Board

### 🟥 TO DO
- *(none — Part III complete)*

---

### 🟨 IN PROGRESS
- *(none)*

---

### 🟩 DONE

#### Part II
- [x] Review project requirements and Part II scope
- [x] Standardize Product Requirements Document (`PRD.md`)
- [x] Plan project and system boundaries
- [x] Design database schema & relationships (`Envelope.hasMany(Transaction)`)
- [x] Connect database to server (Sequelize pool via `DATABASE_URL` in `config/database.js`)
- [x] Create envelope table schema (`models/envelope.js`)
- [x] Implement transaction table schema (`models/transaction.js`)
- [x] Update existing envelope endpoints (async Sequelize CRUD + atomic transfers)
- [x] Create transaction CRUD endpoints (`/transactions` with balance deduction/refund logic)
- [x] Write Swagger documentation (`/api-docs`, `docs/swagger.json`)
- [x] Setup local database (PostgreSQL running locally with `.env` configured)
- [x] Initialize Git tracking and push Part II refactor to GitHub
- [x] Update frontend for Part II API (`POST /transactions`, `GET /transactions`)
- [x] Deploy application on Render
  - Live at https://envelope-budget-api.onrender.com

#### Part III
- [x] Add MIT `LICENSE` file
- [x] Re-implement income distribution (`POST /envelopes/distribute`)
- [x] Add per-envelope fund top-up (`POST /envelopes/:id/fund`)
- [x] Transaction edit/delete UI in Activity ledger
- [x] API integration tests (`npm test` with supertest + node:test)
- [x] Linear UI refactor with sidebar navigation
- [x] Update README screenshots and project status
