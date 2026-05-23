# Analytics Dashboard — Backend

Internal analytics & reporting dashboard with Node.js/Express + PostgreSQL.

---

## Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Runtime  | Node.js 18+                       |
| Framework| Express 4                         |
| Database | PostgreSQL 14+                    |
| Auth     | JWT (access + refresh token rotation) |
| Security | Helmet, bcrypt, express-validator |

---

## Project Structure

```
dashboard/
├── backend/
│   └── src/
│       ├── config/
│       │   ├── database.js     # pg Pool connection
│       │   ├── migrate.js      # schema migrations
│       │   └── seed.js         # dev seed data
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── usersController.js
│       │   ├── analyticsController.js
│       │   └── reportsController.js
│       ├── middleware/
│       │   ├── auth.js         # authenticate + authorize
│       │   ├── audit.js        # audit log writer
│       │   └── errorHandler.js # validation + global errors
│       ├── routes/
│       │   ├── auth.js
│       │   ├── users.js
│       │   ├── analytics.js
│       │   └── reports.js
│       ├── utils/
│       │   ├── jwt.js          # sign/verify helpers
│       │   └── response.js     # consistent API responses
│       ├── app.js              # Express app setup
│       └── server.js           # entry point
├── frontend/                   # (add your frontend here)
├── .env.example
└── package.json
```

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your DB credentials and JWT secrets
```

### 3. Create the database
```sql
CREATE DATABASE analytics_dashboard;
```

### 4. Run migrations
```bash
npm run db:migrate
```

### 5. Seed dev data
```bash
npm run db:seed
```

### 6. Start the server
```bash
npm run dev       # development (nodemon)
npm start         # production
```

---

## Database Schema

### Tables
| Table           | Purpose                          |
|-----------------|----------------------------------|
| `roles`         | admin / analyst / viewer         |
| `users`         | accounts with hashed passwords   |
| `refresh_tokens`| JWT refresh token store (rotated)|
| `audit_logs`    | immutable action log             |
| `reports`       | saved report definitions         |
| `dashboards`    | dashboard layouts                |
| `widgets`       | dashboard widget configs         |
| `metrics`       | time-series numeric data         |

---

## API Reference

### Auth
| Method | Path               | Access  | Description              |
|--------|--------------------|---------|--------------------------|
| POST   | /api/auth/login    | Public  | Email + password login   |
| POST   | /api/auth/refresh  | Public  | Rotate refresh token     |
| POST   | /api/auth/logout   | Public  | Revoke refresh token     |
| GET    | /api/auth/me       | Any     | Current user info        |

### Users
| Method | Path            | Access         | Description    |
|--------|-----------------|----------------|----------------|
| GET    | /api/users      | admin, analyst | List users     |
| GET    | /api/users/:id  | admin, analyst | Get user       |
| POST   | /api/users      | admin          | Create user    |
| PATCH  | /api/users/:id  | admin          | Update user    |
| DELETE | /api/users/:id  | admin          | Delete user    |

### Analytics
| Method | Path                    | Access             | Description           |
|--------|-------------------------|--------------------|----------------------|
| GET    | /api/analytics/summary  | all roles          | Dashboard summary     |
| GET    | /api/analytics/metrics  | all roles          | Time-series metrics   |
| POST   | /api/analytics/metrics  | admin, analyst     | Ingest metric event   |

### Reports
| Method | Path              | Access         | Description    |
|--------|-------------------|----------------|----------------|
| GET    | /api/reports      | all roles      | List reports   |
| GET    | /api/reports/:id  | all roles      | Get report     |
| POST   | /api/reports      | admin, analyst | Create report  |
| PATCH  | /api/reports/:id  | admin, analyst | Update report  |
| DELETE | /api/reports/:id  | admin, analyst | Delete report  |

---

## Roles

| Role    | Capabilities                            |
|---------|-----------------------------------------|
| admin   | Full access + user management           |
| analyst | Read/write reports + analytics + ingest |
| viewer  | Read-only access to reports + analytics |

---

## Seed Credentials (dev only)

| Email                       | Password      | Role    |
|-----------------------------|---------------|---------|
| admin@dashboard.local       | Admin1234!    | admin   |
| analyst@dashboard.local     | Analyst1234!  | analyst |
| viewer@dashboard.local      | Viewer1234!   | viewer  |
