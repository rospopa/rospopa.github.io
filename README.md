# rospopa.github.io

The public site at `rospopa.com` is a focused landing page for Pavlo Rospopa's
Chicagoland industrial investment sales work at Marcus & Millichap. `CNAME`
continues to point to `rospopa.com`. The secure app in `client\` and `server\`
is separate and is not changed by the public-site builder.

## Public homepage

`index.html` contains one full-viewport message, one call action and a short
contact footer. Styles are inline. It loads no JavaScript, external stylesheets
or web fonts. Keep the complete wordmark, responsive image preload, photo credit,
visible contact details, keyboard focus styles and no-JavaScript rendering.
Only verified facts belong in copy and Person/Organization structured data.
There are no theme switches, menus, search boxes, pop-ups or news carousels.

## Retired URLs and discovery

Run from the repository root:

    node build-site.mjs
    node --test tests/*.test.mjs

The builder updates homepage metadata, replaces every other public HTML file
with an immediate redirect to `/`, and generates homepage-only discovery files.
It excludes `client\`, `server\`, `tests\`, hidden directories and `node_modules\`.
Redirect stubs contain a meta refresh, `location.replace('/')`, `noindex`, a
homepage canonical and a visible fallback link. Old paths, queries and fragments
are intentionally not forwarded.

`404.html` uses the same redirect. GitHub Pages still returns an initial HTTP
404 for unknown routes; the browser then loads the homepage with HTTP 200.
These are client-side redirects, not server-side 301 responses. With JavaScript
disabled, the meta refresh still redirects; if refreshes are also disabled,
the visible link remains.

The sitemap lists only the homepage. The old feed remains valid but empty;
the search index is empty and unlinked. Both llms files contain only homepage
facts and contacts. `robots.txt` permits crawling so search engines can see
the old pages' redirects and `noindex`, and keeps the sitemap declaration.

The daily news workflow was removed. The legacy `--news` argument performs
the same safe rebuild without fetching news or restoring the retired library.
Unused images and calculator modules remain in the repository; the homepage
does not load them.

## Backups before the homepage restart

- `backup/full-site-2026-10-21` and annotated tag `full-site-2026-10-21`
  preserve live revision `cc0a56681ea34b2ef44fcd570ea198c0f3152baa`.
- `backup/editorial-rewrite-2026-10-21` preserves the unpublished editorial
  rewrite at `8cd69f85dc5d88175a1329956bf0f8bd81014338`, based on that live revision.

Both branches and the tag are pushed to GitHub. The full library, original
generator and news workflow are recoverable there. Do not restore their
homepage or scheduled publishing accidentally.
