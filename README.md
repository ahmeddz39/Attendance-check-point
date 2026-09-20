# Attendance & Payroll System

Internal employee attendance, biometric device sync, and payroll dashboard.
Node.js/Express + PostgreSQL backend, React (Vite) frontend, with direct integration to
ZKTeco biometric fingerprint/face scanners over the local network.

For running this as a real, always-on internal app (not just local dev), see **[DEPLOY.md](./DEPLOY.md)**.

---

## Stack

| Layer     | Tech                                       |
|-----------|---------------------------------------------|
| Runtime   | Node.js 18+                                  |
| Framework | Express 4                                    |
| Database  | PostgreSQL 14+                               |
| Auth      | JWT (access + refresh token rotation)        |
| Devices   | ZKTeco biometric scanners via `zklib-js` (TCP, port 4370) |
| Frontend  | React 18 + Vite + Recharts                   |
| Security  | Helmet, bcrypt, express-validator, rate limiting |

---

## Project structure

```
├── backend/
│   └── src/
│       ├── config/         # DB pool, migrations, seed data, admin bootstrap
│       ├── controllers/    # auth, users, employees, devices, attendance, reports, analytics
│       ├── middleware/     # auth, audit log, error handling
│       ├── routes/
│       ├── services/       # device discovery + ZKTeco protocol adapter
│       ├── app.js
│       └── server.js
├── frontend/                # React app (Dashboard, Employees, Devices, Attendance, Salary, Reports, Users)
├── deploy/                  # setup-windows.ps1, setup-vm.sh (Linux), systemd unit, nginx config, backups
├── DEPLOY.md                 # runbook for running this on a real always-on server
└── .env.example
```

---

## Quick start (local development)

```bash
npm install
cd frontend && npm install && cd ..
cp .env.example .env   # edit DB credentials / JWT secrets
```

Create the database, then:

```bash
npm run db:migrate          # create schema
npm run db:create-admin -- admin@yourcompany.com 'StrongPassword!'   # first login
npm run dev:all              # backend (nodemon) + frontend (vite) together
```

Backend runs on `http://localhost:4000`, frontend dev server on `http://localhost:3001`
(proxies `/api` to the backend — see `frontend/vite.config.js`).

`npm run db:seed` also exists but seeds throwaway demo accounts/data left over from an
earlier prototype — use `db:create-admin` for a real account instead.

---

## Devices

Biometric scanners are discovered by scanning the local subnet for open TCP port 4370
(`GET /api/devices/discover`), then registered and polled via `zklib-js`
(`backend/src/services/attendanceDeviceAdapter.js`). This only works when the machine
running the backend is on the same physical/LAN network as the scanners — see
[DEPLOY.md](./DEPLOY.md) for the networking requirement when deploying to a VM.

---

## API reference

### Auth
| Method | Path                | Access | Description                     |
|--------|---------------------|--------|----------------------------------|
| POST   | /api/auth/login     | Public | Email + password login (rate-limited) |
| POST   | /api/auth/refresh   | Public | Rotate refresh token             |
| POST   | /api/auth/logout    | Public | Revoke refresh token             |
| GET    | /api/auth/me        | Any    | Current user info                |

### Users
| Method | Path            | Access | Description  |
|--------|-----------------|--------|--------------|
| GET    | /api/users      | admin, analyst | List users |
| GET    | /api/users/:id  | admin, analyst | Get user   |
| POST   | /api/users      | admin  | Create user  |
| PATCH  | /api/users/:id  | admin  | Update user  |
| DELETE | /api/users/:id  | admin  | Delete user  |

### Employees
| Method | Path                | Description       |
|--------|---------------------|--------------------|
| GET    | /api/employees      | List employees     |
| POST   | /api/employees      | Create employee    |
| PATCH  | /api/employees/:id  | Update employee    |
| DELETE | /api/employees/:id  | Delete employee    |

### Devices
| Method | Path                          | Description                       |
|--------|-------------------------------|-------------------------------------|
| GET    | /api/devices                  | List registered devices             |
| GET    | /api/devices/discover          | Scan LAN for scanners on port 4370  |
| POST   | /api/devices                  | Register a device                   |
| PATCH  | /api/devices/:id               | Update a device                     |
| DELETE | /api/devices/:id               | Remove a device                     |
| POST   | /api/devices/:id/connect       | Test connection to a device         |
| POST   | /api/devices/:id/sync-users    | Pull enrolled users from a device   |
| POST   | /api/devices/:id/sync-logs     | Pull attendance logs from a device  |

### Attendance
| Method | Path                                     | Description                  |
|--------|-------------------------------------------|-------------------------------|
| GET    | /api/attendance/logs                       | List raw attendance logs      |
| POST   | /api/attendance/logs                       | Record an attendance event    |
| GET    | /api/attendance/daily                      | Daily attendance summary      |
| GET    | /api/attendance/salary                     | Salary summary                |
| GET    | /api/attendance/reports/monthly            | Monthly attendance report     |
| GET    | /api/attendance/reports/employees/:employeeId | Per-employee report        |

### Reports & Analytics
| Method | Path                    | Access             | Description         |
|--------|-------------------------|--------------------|----------------------|
| GET    | /api/analytics/summary  | all roles          | Dashboard summary    |
| GET    | /api/analytics/metrics  | all roles          | Time-series metrics  |
| POST   | /api/analytics/metrics  | admin, analyst     | Ingest metric event  |
| GET    | /api/reports            | all roles          | List saved reports   |
| GET    | /api/reports/:id        | all roles          | Get report           |
| POST   | /api/reports            | admin, analyst     | Create report        |
| PATCH  | /api/reports/:id        | admin, analyst     | Update report        |
| DELETE | /api/reports/:id        | admin, analyst     | Delete report        |

---

## Roles

| Role    | Capabilities                            |
|---------|-------------------------------------------|
| admin   | Full access + user management              |
| analyst | Read/write reports + analytics + ingest    |
| viewer  | Read-only access to reports + analytics    |
