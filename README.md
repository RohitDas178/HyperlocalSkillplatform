# Skilloc - Backend

Simple Node.js backend for the Skilloc hyperlocal marketplace. Provides basic endpoints for client and worker registration and login using a file-based JSON store.

Prerequisites
- Node.js 14+ installed

Install

```bash
npm install
```

Run

```bash
npm start
# or for development with nodemon (if installed):
npm run dev
```

API Endpoints
- `GET /api/services` - list available services
- `POST /api/client/register` - register a client (JSON body)
- `POST /api/worker/register` - register a worker (JSON body)
- `POST /api/auth/login` - login with `{ email, password, type }` where `type` is `client` or `worker`

- `GET /api/me` - (protected) returns profile info; requires `Authorization: Bearer <token>` header

Environment
- `JWT_SECRET` - secret used to sign tokens (default provided for development). Set in environment for production.
- `JWT_EXPIRES` - token expiration (default: `7d`)

Notes
- This is a simple demo backend using file-based storage in `data/` for development and testing only.
