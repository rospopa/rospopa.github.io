// Builds resources/search-index.json for the public site's client-side search.
// Run from the repository root after changing any public page:
//   node build-search-index.mjs
// The script is excluded from the GitHub Pages build (_config.yml).
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PAGES = [
  'index.html',
  'resources/chicago-commercial-real-estate/index.html',
  'resources/chicago-industrial-real-estate/index.html',
  'resources/chicagoland-industrial-real-estate/index.html',
  'resources/selling-industrial-property/index.html',
  'resources/commercial-leasing/index.html',
  'resources/commercial-investment/index.html',
  'resources/glossary/index.html',
];
const MAX_TEXT = 1400;

function decode(text) {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function plain(html) {
  return decode(html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|li|dd|dt|h[1-6]|tr|caption|section|div|aside)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function first(html, pattern) {
  const match = html.match(pattern);
  return match ? plain(match[1]) : '';
}

const records = [];
for (const page of PAGES) {
  const path = resolve(page);
  if (!existsSync(path)) {
    console.warn(`Skipping ${page}: file not found`);
    continue;
  }
  const html = await readFile(path, 'utf8');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!canonical) throw new Error(`${page}: missing canonical URL`);
  const url = new URL(canonical[1]).pathname;
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (!main) throw new Error(`${page}: missing <main>`);
  const title = first(html, /<h1>([\s\S]*?)<\/h1>/);
  if (!title) throw new Error(`${page}: missing <h1>`);

  // Page-level record: everything before the first section (lead, "In brief").
  const intro = main[1].split(/<section\b/i)[0]
    .replace(/<nav class="toc"[\s\S]*?<\/nav>/i, ' ')
    .replace(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/i, ' ');
  records.push({ p: title, u: url, h: title, t: plain(intro).slice(0, MAX_TEXT) });

  // One record per <section id="...">.
  for (const section of main[1].matchAll(/<section\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/gi)) {
    const [, id, body] = section;
    const heading = first(body, /<h2[^>]*>([\s\S]*?)<\/h2>/) || title;
    const glossaryTerms = [...body.matchAll(/<dt id="([^"]+)">([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi)];
    if (glossaryTerms.length) {
      for (const [, termId, term, definition] of glossaryTerms) {
        records.push({ p: title, u: `${url}#${termId}`, h: plain(term), t: plain(definition).slice(0, MAX_TEXT) });
      }
      continue;
    }
    const text = plain(body.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, ' '));
    if (text) records.push({ p: title, u: `${url}#${id}`, h: heading, t: text.slice(0, MAX_TEXT) });
  }
}

await writeFile(resolve('resources/search-index.json'), JSON.stringify(records));
console.log(`Indexed ${records.length} entries from ${PAGES.filter(p => existsSync(resolve(p))).length} pages → resources/search-index.json`);
