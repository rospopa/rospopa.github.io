# rospopa.github.io

Public Chicago commercial and industrial real estate resources live in the
root `index.html` and `resources\` directory. They are plain HTML and CSS;
reading and crawling need no JavaScript. Three small scripts enhance the pages:
`resources\theme.js` (day/night preference), `resources\search.js`
(client-side search over `resources\search-index.json`) and
`resources\interactive.js` (calculators, remembered checklists, glossary
filter, county picker, table-of-contents tracking, news carousel).

After changing any public page, regenerate the generated files from the repo root:

    node build-site.mjs          # search index, sitemap.xml (with images), feed.xml, llms-full.txt, news section
    node build-site.mjs --news   # also refresh resources/news.json from the news feeds

`.github\workflows\update-news.yml` runs the `--news` variant daily and commits
the result with `[skip render]` so only GitHub Pages redeploys. GitHub pauses
scheduled workflows after 60 days without repository activity; re-enable it
from the Actions tab if the carousel stops updating. The script lists the
indexed pages at its top; add new guides there and in `llms.txt`. The shared
header/footer markup is identical on every page—edit all pages together when
changing navigation. `/search/` is `noindex` and deliberately absent from the
sitemap. `robots.txt` explicitly welcomes AI assistants; `llms.txt` and
`llms-full.txt` give them a Markdown directory and full text.
Generated modification dates use UTC for both working changes and commits,
so committing a page does not shift its date across a local-time boundary.

The public header uses `resources\resources.css`. Keep the complete logo
(leaf, ROSPOPA, and PAVLO) visible at every viewport width; the compact rules
below 375px leave room for the theme, sign-in, and menu controls. When changing
the shared stylesheet, update its cache version on all public pages, including
`search\index.html` and `404.html`. Check 320px, 375px, 390px, tablet, and desktop
layouts, with the mobile menu both closed and open.

News sources include the REjournals industrial RSS category and Connect CRE's
Chicago/Midwest feed in addition to the existing feeds. Mixed-region feeds
must match both an industrial/logistics term and a Chicagoland place in the
headline; only the last 30 days are eligible. The build reports parsed and
matched counts per source, deduplicates titles, and prefers direct publisher
links to aggregator duplicates. A source returning HTML or failing to fetch
is reported explicitly. The daily workflow remains the refresh mechanism;
no credentials or article bodies are stored or displayed.

`resources\truck-dimensions-turning\index.html` is the central fleet-size
reference. Keep measured cargo interiors, nominal body/container labels,
road-size rules, and overall vehicle geometry distinct. Dimensional examples
must link to primary fleet/carrier/regulatory sources; unknown overall lengths
and turning radii remain unpublished, not guessed. All site-fit conclusions
require fleet-specific engineering review. Tables reuse the keyboard-focusable,
horizontal-scroll `.table-wrap` pattern. Register new guides in `PAGES` and
`llms.txt`, link them from the guide directory and relevant sections, then build.

The shared header's Show contact info button opens a native modal dialog,
using the existing click-to-reveal decoder in `resources\interactive.js`.
Contact data remains defined only in the homepage's `#contact-details`;
other pages fetch it on activation. The original homepage disclosure stays
available. Check keyboard activation, Escape/Close focus return, and the
visible retry message on a failed homepage fetch. This control requires
JavaScript; the homepage still provides its existing no-script LinkedIn link.

The private React workspace in `client\` is built and served by the Node
service in `server\`, separately from GitHub Pages. See `DEPLOY.md` for hosting,
indexing controls, and the deployment verification checklist.

Both active sites share `resources\palette.css`: forest `#1F5F2E` for depth,
leaf `#2E8B3E` for accents, fresh `#5DB85C` for night controls, mint `#B8E0B0`
for highlights, and a white day background. Text and button colors use
contrast-safe variants; warning, error, info, and calendar colors keep their
semantic distinctions. The existing `monochrome` / `monochrome-dark` theme IDs
and `rep_theme` light/dark preference are retained for compatibility.
The workspace imports the shared palette at build time; the public stylesheet
imports a cache-versioned copy. Refresh public CSS, theme-script, and palette
cache versions when changing them. Archive/legacy assets, maps, chart embeds,
and photographs are not recolored. Check both themes, persistence, the contact
dialog, and phone/desktop layouts; run `npm --prefix client run build` and
`npm --prefix client run lint` for workspace changes.