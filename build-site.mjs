// Rebuild the focused public homepage, retired-route redirects and discovery files.
// The secure app and its deployment configuration are deliberately out of scope.
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {ORIGIN, updateHomepageSeo, buildAssistantDirectory} from './site-seo.mjs';

const redirect = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pavlo Rospopa | Page moved</title>
  <meta http-equiv="refresh" content="0; url=/">
  <link rel="canonical" href="${ORIGIN}/">
  <meta name="robots" content="noindex">
  <script>location.replace('/');</script>
</head>
<body>
  <main><p>This page has moved. <a href="${ORIGIN}/">Continue to rospopa.com</a>.</p></main>
</body>
</html>
`;

const excluded = new Set(['client', 'server', 'tests', 'node_modules']);
async function publicHtml(directory = '.') {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (entry.name.startsWith('.') || excluded.has(entry.name)) continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await publicHtml(file));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(file);
  }
  return files.sort();
}

const homepage = updateHomepageSeo(await readFile('index.html', 'utf8'));
await writeFile('index.html', homepage);
let redirected = 0;
for (const file of await publicHtml()) {
  if (file === 'index.html') continue;
  await writeFile(file, redirect);
  redirected++;
}
// Keep the old feed URL valid but empty; do not advertise retired page URLs.
await writeFile('feed.xml', `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${ORIGIN}/</id>
  <title>Pavlo Rospopa</title>
  <updated>2026-10-22T00:00:00Z</updated>
  <link href="${ORIGIN}/feed.xml" rel="self"/>
  <link href="${ORIGIN}/"/>
</feed>
`);
await writeFile('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/sitemap/0.9">
  <url><loc>${ORIGIN}/</loc></url>
</urlset>
`);
await writeFile('resources/search-index.json', '[]\n');
const directory = buildAssistantDirectory();
await writeFile('llms.txt', directory);
await writeFile('llms-full.txt', directory);
await writeFile('robots.txt', `# The public site now contains one focused homepage.
# Retired routes remain crawlable so their noindex and redirects can be seen.
User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`);
if (process.argv.includes('--news')) {
  console.log('News publishing is retired. No headlines were fetched or rendered.');
}
console.log(`Built focused homepage, ${redirected} redirect stubs, one-URL sitemap and homepage-only discovery files.`);
