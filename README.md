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

The owner library starts at `resources\commercial-property-owner-questions\`.
NOI, DCF, cost controls, insurance and budgets/reserves have dedicated guides;
Illinois tax management extends the existing tax guide. Keep illustrative
numbers distinct from market data, reconcile NOI/reserve/debt conventions,
and link current official sources. FAQPage answers must match visible answers;
structured data is not a promise of Google rich results or search ranking.
The owner hub is linked in the shared footer, not added to the top navigation.
New pages reuse the public template and generated business contact strip.

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

The generator also builds visible one-click business phone/email links on
every guide and the homepage seller introduction from that same contact source.
These links work without JavaScript; business contact details are intentionally
public. `resources\contact-data.mjs` shares the decoder between the generator
and module-based `interactive.js`. Do not edit generated `direct-contact`
regions independently. Public headers keep contact and theme controls; workspace
Sign In lives in the footer, not the header. The logo's accessible name reads
"Rospopa, Pavlo, home" rather than treating the two wordmark lines as one word.

Community scenarios are editorial simulated perspectives, not member posts.
Keep the invite-only board separate and do not imply participation or activity
without actual member data. The board is members-only: the API requires a
signed-in session to read or post, and the public site only links to sign in. Guide publication metadata remains intact; prominent
bulk publication stamps are omitted rather than represented as market freshness.
The homepage bio uses the linked official advisor profile; add no career/deal
claims or portrait without verification and permission. The selling-guide
Elk Grove Village image uses the existing credited CC BY-SA 4.0 adaptation,
illustrates the region, and does not represent an advisor transaction.
Publishing a track-record section requires three to five verified, authorized
closed transactions (size, county, buyer type, advisor role and closing evidence;
price or price/SF only if approved), plus a permissioned advisor headshot.
An archived listing is not evidence of a closing. The official profile confirms
joining Marcus & Millichap in 2026, not a number of earlier brokerage years.

Tables retain readable minimum widths inside their focusable horizontal-scroll
wrappers instead of crushing checklist labels into narrow word fragments.
Checklist hints explain arrow-key scrolling; toggles/reset and stored state
must still work at phone widths. Generated business email links use Cloudflare's
documented `email_off` comments to opt that intentionally public contact link
out of edge obfuscation. Confirm the edge preserves the no-JavaScript mailto
after deployment; local HTML alone cannot verify Cloudflare transformation.

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