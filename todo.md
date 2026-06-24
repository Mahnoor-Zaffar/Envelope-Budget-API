# TODO.md

## 📋 Kanban Board

### 🟥 TO DO
- [ ] **Connect database to server**
  - Configure Sequelize connection pool using environment variables (`process.env.DATABASE_URL`).
- [ ] **Create envelope table schema**
  - Define Sequelize model for `Envelope` with `id`, `title`, `budget`, and `balance`.
- [ ] **Update existing envelope endpoints**
  - Refactor all CRUD routes in `/envelopes` to perform async SQL queries using Sequelize models instead of the in-memory array.
- [ ] **Implement transaction table schema**
  - Define Sequelize model for `Transaction` with `id`, `date`, `amount`, `recipient`, and a foreign key `envelopeId`.
- [ ] **Create transaction CRUD endpoints**
  - Write new endpoints under `/transactions` to handle `POST`, `GET`, `PUT`, and `DELETE`.
  - Ensure `POST /transactions` automatically deducts funds from the linked envelope balance using a database transaction.
- [ ] **Write Swagger documentation**
  - Install `swagger-ui-express` and configure openAPI specifications for all endpoints.
- [ ] **Deploy application on Render**
  - Set up a managed PostgreSQL database and Web Service on Render, connect environment variables, and deploy from GitHub.

---

### 🟨 IN PROGRESS
- [ ] **Plan project and system boundaries**
- [ ] **Design database schema & relationships**
  - Define 1-to-Many association (`Envelope.hasMany(Transaction)`).
- [ ] **Setup local database**
  - Initialize local PostgreSQL instance via CLI or `psql`.
- [ ] **Initialize Git tracking**
  - Verify repository tracking status and prepare baseline commits.

---

### 🟩 DONE
- [x] Review project requirements and Part II scope
- [x] Standardize Product Requirements Document (`PRD.md`)