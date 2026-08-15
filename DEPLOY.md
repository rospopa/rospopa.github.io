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

3) Persistence note (Postgres)
The live app is expected to use DATABASE_URL, not a local SQLite file. The repo's server requires Postgres in production, so any contact import must target the remote database via DATABASE_URL.

For a one-off sync from the Excel workbook:

  cd server
  DATABASE_URL="postgres://<user>:<password>@<host>:<port>/<db>" node scripts/import-master-contacts.js "C:/path/to/Master.xlsx"

If you already have the Render service environment loaded in the shell, the command can just be:

  node scripts/import-master-contacts.js

4) render.yaml branch
Currently render.yaml includes a branch field. Either:
- Remove repo/branch lines so Render uses the branch you select in the UI (recommended), or
- Update branch to the branch you want Render to build (e.g., master).

5) Don't commit secrets
Never commit SESSION_SECRET, DATABASE_URL, or other secrets to the repository.

See the PR for files and this note.
