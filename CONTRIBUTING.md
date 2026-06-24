# Contributing

## Commit messages

Use a short imperative subject line (≤ 72 chars), then a blank line, then an optional body explaining **why**:

```
feat: add monthly spending report endpoint

Summarize envelope spend by month for portfolio analytics and Swagger docs.
```

Prefixes: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

## Local checks before pushing

```bash
npm test
npm start   # smoke-test against local PostgreSQL
```

## Pull requests

Link related `PRD*.md` sections and update `docs/swagger.json` when API shapes change.
