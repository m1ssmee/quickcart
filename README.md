# quickcart

A small TypeScript e-commerce backend, used as a sample codebase for demos and code-reading exercises.

## Modules

| Folder | Responsibility |
| --- | --- |
| `gateway/` | HTTP entry point. Routes requests and proxies calls to internal services. |
| `auth/` | Access tokens, refresh flow and request authentication. |
| `orders/` | Order creation and checkout. |
| `payments/` | Charge processing and the payments ledger. |
| `inventory/` | Stock levels and reservations. |
| `utils/` | Shared validation, formatting, money and logging helpers. |

## Running locally

```bash
npm install
npm run build
npm test
```

Services read their configuration from environment variables; see `gateway/config.ts`.
