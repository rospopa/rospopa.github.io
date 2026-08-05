Render deployment instructions

1) Start command
Use this as the Start Command in the Render Web Service settings:

  cd server && npm start

This runs the Node server in ./server which reads PORT and SESSION_SECRET from environment.

2) SESSION_SECRET (env var)
- In Render dashboard, open your Web Service → Environment → Add Environment Variable
  Key: SESSION_SECRET
  Value: (generate a secure random string)
  Mark as secret (hidden) if available.

Generate a secure secret locally:
- Node: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
- OpenSSL: openssl rand -hex 32

3) Persistence note (SQLite)
Render can provide a persistent disk for a service; enable it if you want SQLite (users.db) to survive restarts. For production, prefer Postgres and update the server to use a DATABASE_URL.

4) render.yaml branch
Currently render.yaml includes a branch field. Either:
- Remove repo/branch lines so Render uses the branch you select in the UI (recommended), or
- Update branch to the branch you want Render to build (e.g., rospopa-repo-access-check).

5) Don't commit secrets
Never commit SESSION_SECRET or other secrets to the repository.

See the PR for files and this note.
