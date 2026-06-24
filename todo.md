# TODO.md

## 📋 Kanban Board

### 🟥 TO DO
- [ ] **Deploy application on Render**
  - Set up a managed PostgreSQL database and Web Service on Render, connect environment variables, and deploy from GitHub. See `DEPLOYMENT.md`.

---

### 🟨 IN PROGRESS
- *(none)*

---

### 🟩 DONE
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
- [x] Update frontend for Part II API (`POST /transactions`, `GET /transactions`; removed distribute UI)
