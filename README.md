# rospopa.github.io

Public Chicago commercial and industrial real estate resources live in the
root `index.html` and `resources\` directory. They are plain HTML and CSS;
reading and crawling need no JavaScript. Two small scripts enhance the pages:
`resources\theme.js` (day/night preference) and `resources\search.js`
(client-side search over `resources\search-index.json`).

After changing any public page, regenerate the search index from the repo root:

    node build-search-index.mjs

The script lists the indexed pages at its top; add new guides there, in
`sitemap.xml`, and in `llms.txt`. The shared header/footer markup is identical
on every page—edit all pages together when changing navigation. `/search/` is
`noindex` and deliberately absent from the sitemap.

The private React workspace in `client\` is built and served by the Node
service in `server\`, separately from GitHub Pages. See `DEPLOY.md` for hosting,
indexing controls, and the deployment verification checklist.