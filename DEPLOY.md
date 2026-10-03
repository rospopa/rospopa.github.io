Deployment instructions

Public resource site and search deployment
-----------------------------------------

`CNAME` sets `rospopa.com`; the root `_config.yml` is the GitHub Pages/Jekyll
configuration. A read-only GitHub API check on October 2, 2026 confirmed
Pages uses the legacy build from `master`, path `/`, with custom domain
`rospopa.com`. The API reported `https_enforced: false`. No Pages workflow
is checked into this repository. Recheck these settings before deployment.
`render.yaml` describes a separate Render service on `master`, building
`client` and starting `server`; the private app uses `secure.rospopa.com`.
Render does not publish the root public HTML.

Observed live blocker on October 2, 2026: requests to the public homepage,
`/robots.txt`, and a resource path all returned a Cloudflare HTTP 301 to
`https://secure.rospopa.com/`, losing the requested path. `www.rospopa.com`
and plain HTTP also redirected there. The crawler fetch of the secure host
returned 403. Publishing these files alone will therefore NOT make the
public library accessible. Remove or narrow the public-host-to-secure-host
redirect in the Cloudflare configuration and keep `rospopa.com` routed to
GitHub Pages. Keep the private hostname routed to Render with its existing
security protections. These external settings were inspected, not changed.

Security-preserving Cloudflare configuration
-------------------------------------------

Automation, search engines, and generated files
-----------------------------------------------

- `.github/workflows/update-news.yml` runs daily (11:17 UTC) and on demand. It
  executes `node build-site.mjs --news`, which refreshes `resources/news.json`
  from public news feeds, regenerates the homepage news section, the search
  index, `sitemap.xml`, `feed.xml`, and `llms-full.txt`, and commits with
  `[skip render]` so Render does not redeploy the private app. GitHub Pages
  redeploys from the bot commit (verified). GitHub disables scheduled workflows
  after 60 days without repository activity; re-enable from the Actions tab.
- IndexNow key file: `e129f7456b6092356f7ab9e99a4830d6.txt` at the site root.
  Submit URL changes with a POST to `https://api.indexnow.org/indexnow`
  (host `rospopa.com`, the key, and `urlList`); the key is intentionally
  public. Google does not use IndexNow; use Search Console there.
- Pages carry a `Content-Security-Policy` meta tag. It allows the site's own
  scripts, Google Fonts, and Cloudflare Web Analytics
  (`static.cloudflareinsights.com` / `cloudflareinsights.com`). Any new
  third-party script or font must be added to the policy in every page.
- `robots.txt` explicitly welcomes AI assistants and blocks only internal
  search result queries and the two JSON data files. `/search/` is `noindex`.

Keep the public library and private workspace on separate origins:

| Hostname | Origin | Access |
| --- | --- | --- |
| `rospopa.com` | GitHub Pages | Public educational HTML only |
| `www.rospopa.com` | Redirect to the public canonical hostname | Preserve the requested path and query |
| `secure.rospopa.com` | Existing Render service | Existing private security controls and application authentication |

Do not disable zone-wide security to enable SEO. Retain HTTPS, DDoS
protection, WAF protections, and applicable rate limits on the public site.
Retain the private site's existing Access policies (if configured), bot
controls, origin-key guard, sessions, and per-user authorization. Neither
robots.txt nor noindex is an access-control mechanism.

In Cloudflare, inspect Redirect Rules, Bulk Redirects, legacy Page Rules,
and any Worker routes. Change only the rule sending the public hostname
to the private hostname. A broad rule may affect both hosts: narrow its
hostname condition rather than disabling unrelated protections.

If Cloudflare Access is configured, keep its login requirement on
`secure.rospopa.com`. A wildcard application covering both public and
private hostnames needs separate hostname scopes; do not add a wildcard
bypass policy. Do not change the Render origin or expose private API routes
through GitHub Pages.

Search crawlers need public HTML without an interactive challenge. First
inspect Cloudflare Security Events to identify the specific blocking rule.
If a crawler exception is necessary and supported by the current plan,
scope it to `rospopa.com` and use Cloudflare's verified-bot classification.
Skip only the specific blocking challenge/control, not all WAF rules or
rate limits. Never trust a claimed Googlebot/Bingbot user-agent alone, and
never apply a public crawler exception to `secure.rospopa.com`. Exact bot
fields and skip options vary by plan and rule type.

Keep edge-to-origin TLS verification enabled (Full strict with valid origin
certificates); do not use Flexible mode to resolve certificate problems.
Purge cached public redirects after the routing rule is corrected.

Before declaring the configuration finished, confirm public guides return
200, missing public pages return 404, the private site's normal login still
works, unauthenticated API requests remain denied, and direct requests to
the Render origin remain blocked by its origin guard. Leave private
controls intact even if they prevent crawlers from observing noindex.
Cloudflare account access is required for these external changes; a git
push cannot apply them.

The root `index.html` is deliberately a small public resource directory
(HTTP 200), not a redirect or marketing landing page. Four distinct guides
under `resources/` contain the useful crawlable content. A future landing page
can link to this library; preserve or deliberately migrate its URLs then.
The public pages have unique metadata, HTTPS canonicals, text content, and
WebPage/CollectionPage, WebSite, and breadcrumb data matching visible content.
They make no brokerage, employer, listing, review, or performance claims.
Publication dates reflect initial creation on October 2, 2026, not a market
data update. Do not refresh dates without a real content change.

`sitemap.xml` lists only the five canonical public URLs and omits invented
last-modified dates. `robots.txt` allows public crawling. `llms.txt` is an
optional reading directory, not a ranking signal or indexing control.
Google's official guidance says no special AI files or schema are required:
https://developers.google.com/search/docs/appearance/ai-features
Normal indexing, snippet eligibility, useful content, and crawl access apply.
Neither indexing, AI citations, rankings, nor traffic are guaranteed.

Pages excludes `client`, `server`, `archive`, deployment documentation,
tracked audit reports, the build log, and the workflow-log ZIP. The archived
content and PDFs are removed from the published output rather than given
misleading redirects to unrelated guides. Requests should return a real 404;
`404.html` has no redirect and carries `noindex`. Do not block `/archive/`
in robots.txt: crawlers must be able to see that it is gone. Existing indexed
URLs may need recrawling or Search Console removal requests. Exclusions
require the normal Jekyll build; a raw upload of the repository would bypass
them. Do not publish the whole repository using a `.nojekyll` deployment.

Private indexing controls:
- `client/index.html` has `noindex, nofollow, noarchive`.
- All Express responses, including API, assets, errors, and health responses,
  carry `X-Robots-Tag: noindex, nofollow, noarchive` before the origin guard.
- The private `/robots.txt` allows crawling so successful fetches can see
  `noindex`; disallowing all crawling can leave URL-only entries in search.
- The origin guard and authentication remain in place. Robots directives
  do not enforce privacy. Unknown secure paths return 404 rather than the SPA
  with status 200; the current app is served at `/` and uses internal state,
  not path-based client routing.

Deployment acceptance checklist (after publishing, not just a local build):
1. Remove the observed public-to-secure redirect, then confirm public HTTPS
   URLs return 200 without a login or bot challenge. Ensure DNS, TLS,
   www-to-canonical-host, and HTTP-to-HTTPS redirects are configured in
   Pages/Cloudflare. Enable Pages HTTPS enforcement when certificate
   provisioning permits and verify the edge-to-origin TLS configuration.
   Canonical tags do not create redirects.
2. Check source HTML, canonical URLs, JSON-LD, CSS, robots.txt, sitemap.xml,
   and llms.txt. Directory URLs should resolve consistently with trailing
   slashes; do not index duplicate `/index.html` versions.
3. Request a nonexistent URL and an old `/archive/` URL; expect HTTP 404
   with the not-found page, not HTTP 200 or a homepage redirect.
4. Confirm excluded report/log/source paths are not in the Pages artifact.
   Inspect the Pages build output whenever new internal artifacts are added.
5. Redeploy Render for private meta/header/robots changes. Check the header
   on `/`, `/api/me`, `/healthz`, and an unknown path, and verify normal login
   and app navigation. The bare Render origin remains origin-key guarded.
6. Review Cloudflare WAF, Access, bot protection, and robots overrides on
   both hostnames. Public crawler blocks or challenges prevent discovery;
   private blocks can prevent a crawler from observing `noindex`. Do not
   weaken private authentication or expose private data to solve indexing.
   Cloudflare-generated error/challenge responses may not carry the Node
   header; configure edge noindex headers for the secure hostname if needed.
7. Verify `rospopa.com` in Google Search Console, submit the sitemap, and use
   URL Inspection/live fetch for the public pages. Verify removal/noindex
   for formerly indexed private or archived URLs separately. Monitor actual
   impressions and useful visits; no additional "AI SEO" markup is needed.

External sources are official research starting points, not endorsements.
Property suitability, taxes, engineering, leases, financing, and legal
requirements still need transaction-specific professional verification.

Render deployment instructions
------------------------------

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
