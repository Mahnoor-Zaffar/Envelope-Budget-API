# Product Requirements Document (PRD): Envelope Budget API (Part II)

## 1. Objective

Extend the existing RESTful Personal Budget API from an in-memory prototype to a production-ready application. This phase introduces persistent data storage using PostgreSQL and Sequelize ORM, implements full transaction tracking, adds comprehensive Swagger documentation, and deploys the application live via Render.

## 2. Tech Stack & Environment

- **Runtime/Framework:** Node.js, Express.js
- **Database & ORM:** PostgreSQL, Sequelize ORM
- **API Documentation:** Swagger UI (swagger-ui-express)
- **Testing & Testing Clients:** Postman, Git
- **Deployment Platform:** Render (with Managed PostgreSQL)

## 3. Data Model & Relationships
[ Envelope ] 1  ---  * [ Transaction ]
### 3.1. Envelope Table
- `id` (Integer): Primary key, auto-incrementing.
- `title` (String): Unique category name (e.g., "Rent", "Groceries").
- `budget` (Numeric/Decimal): Total initial allocated amount.
- `balance` (Numeric/Decimal): Current available amount.

### 3.2. Transaction Table
- `id` (Integer): Primary key, auto-incrementing.
- `date` (Date): Timestamp of when the transaction occurred.
- `amount` (Numeric/Decimal): Positive value representing the payment amount.
- `recipient` (String): The entity or party receiving the funds.
- `envelopeId` (Integer): Foreign key mapping to the designated Envelope.

## 4. API Endpoints

### 4.1. Base & Documentation
| Method | Endpoint      | Description |
| :----- | :------------ | :---------- |
| `GET`  | `/`           | Health check. Returns server status. |
| `GET`  | `/api-docs`   | Swagger UI generated documentation interface. |

### 4.2. Refactored Core Envelope CRUD (Database Backed)
All endpoints must be refactored from in-memory arrays to perform SQL queries via Sequelize.

| Method   | Endpoint         | Description | Validation / Constraints |
| :------- | :--------------- | :---------- | :----------------------- |
| `POST`   | `/envelopes`     | Create a new budget envelope. | Require unique title and initial budget. |
| `GET`    | `/envelopes`     | Retrieve all envelopes. | None. |
| `GET`    | `/envelopes/:id` | Retrieve a specific envelope by ID. | Return 404 if envelope not found. |
| `PUT`    | `/envelopes/:id` | Update envelope details or edit funds. | Prevent actions causing balance to drop below zero. |
| `DELETE` | `/envelopes/:id` | Delete a specific envelope. | Return 404 if envelope not found. Cascade or handle orphan transactions. |

### 4.3. Envelope Transactions & Transfers
| Method | Endpoint                            | Description | Validation / Constraints |
| :----- | :---------------------------------- | :-------------------------------------------------------- | :------------------------------------ |
| `POST` | `/envelopes/transfer/:fromId/:toId` | Transfer funds directly from one envelope to another. | Validate sufficient funds in source envelope. Enforce atomicity (Database Transaction). |

### 4.4. New Transaction Feature Endpoints
A completely new domain layer to log actual external expenditures. Creating a transaction must automatically deduct the specified `amount` from the associated envelope's `balance`.

| Method   | Endpoint            | Description | Validation / Constraints |
| :------- | :------------------ | :---------- | :----------------------- |
| `POST`   | `/transactions`     | Create a new transaction log. | Require date, amount, recipient, and `envelopeId`. Deduct amount from envelope balance. Throw error if balance is insufficient. |
| `GET`    | `/transactions`     | Retrieve all logged transactions. | None. |
| `GET`    | `/transactions/:id` | Retrieve a single transaction by ID. | Return 404 if transaction not found. |
| `PUT`    | `/transactions/:id` | Update transaction details. | Recalculate envelope balance variations safely if amounts or envelopes change. |
| `DELETE` | `/transactions/:id` | Delete a specific transaction. | Return funds back to the associated envelope balance. |

## 5. Development & Deployment Workflow

1.  **Database Design & Local Setup:** Initialize local PostgreSQL instance. Configure Sequelize connection pool using environment variables. Define models and establish a one-to-many relationship between Envelopes and Transactions.
2.  **Migration & Adaptation:** Swap out in-memory arrays within Express routes for active Sequelize database queries. 
3.  **Transaction Integration:** Build out transaction routes ensuring database consistency (when a transaction is written, the corresponding envelope balance changes).
4.  **Testing Strategy:** Utilize Postman locally to verify API functionality, boundary validation errors, and relation edge cases.
5.  **Documentation Integration:** Decorate routes or build a `swagger.json`/`yaml` structure to serve interactive API documentation using `swagger-ui-express`.
6.  **Production Deployment:** Create a Web Service and a Managed PostgreSQL database instance on Render. Configure environment strings, push to GitHub, and deploy.

## 6. Next Steps (Optional Enhancements)
- **Frontend Client:** Create a standalone web dashboard that displays live envelopes, real-time balances, and interactive transaction log forms.