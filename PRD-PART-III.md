# Product Requirements Document (PRD): Envelope Budget API — Part III

## 1. Objective

Extend the production-ready Part II application with complete frontend–backend parity, income management workflows, and automated API integration tests. Part III closes feature gaps between the REST API and the Linear-inspired client while hardening the project for portfolio and production use.

## 2. Scope

### 2.1. Income & Funding
| Method | Endpoint | Description |
| :----- | :------- | :---------- |
| `POST` | `/envelopes/distribute` | Split `totalIncome` proportionally across all envelopes by budget allocation; increases each envelope's balance. |
| `POST` | `/envelopes/:id/fund` | Add a lump-sum `amount` directly to a single envelope's balance. |

### 2.2. Transaction UI Parity
The Activity ledger must support full CRUD alignment with `/transactions`:
- **Edit** — update payee, amount, date, and envelope category via modal; backend recalculates balances.
- **Delete** — confirm, then refund the transaction amount to the linked envelope.

### 2.3. Testing
- Integration tests using Node.js built-in `node:test` and `supertest`.
- Coverage targets: envelope CRUD, transfers, distribute, fund, transaction create/delete, insufficient-funds rejection.
- Rate limiting disabled when `NODE_ENV=test`.

### 2.4. Documentation & Legal
- MIT `LICENSE` file matching README badge.
- README and `todo.md` updated with Part III status and testing instructions.

## 3. Acceptance Criteria

- [x] `POST /envelopes/distribute` rejects invalid income and empty envelope sets.
- [x] `POST /envelopes/:id/fund` increases balance atomically.
- [x] Activity table exposes edit/delete actions per transaction row.
- [x] Distribute Income form restored in the Actions view.
- [x] Add Funds action available on each envelope row.
- [x] `npm test` passes against PostgreSQL (`DATABASE_URL` or `TEST_DATABASE_URL`).
- [x] MIT License committed to repository root.

## 4. Out of Scope (Future)
- User authentication / multi-tenant accounts
- Sequelize CLI migrations (recommended before high-traffic production)
- CI pipeline (GitHub Actions)

---

See [`PRD.md`](PRD.md) in git history for Part II requirements. Part II endpoints remain unchanged unless noted above.
