import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = file => readFile(resolve(root, file), 'utf8');
const origin = 'https://rospopa.com';
const pages = ['index.html', 'resources/index.html'];
for (const entry of await readdir(resolve(root, 'resources'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const path = `resources/${entry.name}/index.html`;
  try { await read(path); pages.push(path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const documents = await Promise.all(pages.map(async file => {
  const html = await read(file);
  const url = origin + '/' + file.replace(/index\.html$/, '');
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  return { file, html, url, graph };
}));

test('indexable pages have unique titles, descriptions and canonical URLs', () => {
  const titles = new Set(), descriptions = new Set();
  for (const { file, html, url } of documents) {
    const title = html.match(/<title>([\s\S]*?)<\/title>/)[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(!titles.has(title), `${file}: duplicate title`);
    assert.ok(!descriptions.has(description), `${file}: duplicate description`);
    titles.add(title); descriptions.add(description);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), file);
    assert.match(html, /name="robots" content="index, follow, max-image-preview:large, max-snippet:-1/);
    assert.ok(html.includes(`property="og:url" content="${url}"`), file);
  }
});

test('guide directory schema lists every visible guide exactly once', () => {
  const directory = documents.find(d => d.file === 'resources/index.html');
  const list = directory.graph.find(n => n['@type'] === 'CollectionPage').mainEntity;
  const expected = documents.filter(d => d.file.startsWith('resources/') && d.file !== directory.file).map(d => d.url).sort();
  assert.equal(list.numberOfItems, expected.length);
  assert.deepEqual(list.itemListElement.map(item => item.url).sort(), expected);
  for (const [i, item] of list.itemListElement.entries()) {
    assert.equal(item.position, i + 1);
    assert.ok(directory.html.includes(`href="${new URL(item.url).pathname}"`));
    assert.ok(item.name.length > 0);
  }
});

test('article summaries, citations and FAQ deep links correspond to visible content', () => {
  for (const { file, html, url, graph } of documents) {
    const article = graph.find(n => n['@type'] === 'Article');
    if (article) {
      assert.ok(article.abstract?.length > 30, `${file}: missing answer summary`);
      assert.ok(article.dateModified >= article.datePublished, `${file}: inconsistent dates`);
      for (const citation of article.citation || []) {
        const escaped = citation.replace(/&/g, '&amp;');
        assert.ok(html.includes(citation) || html.includes(escaped), `${file}: citation not visible: ${citation}`);
      }
    }
    for (const faq of graph.filter(n => n['@type'] === 'FAQPage')) {
      for (const q of faq.mainEntity) {
        assert.ok(q.acceptedAnswer.text.length > 0, `${file}: empty answer`);
        assert.ok(q['@id']?.startsWith(url + '#'), `${file}: missing question deep link`);
        assert.equal(q.url, q['@id']);
        assert.ok(html.includes(`id="${new URL(q.url).hash.slice(1)}"`), `${file}: broken question anchor`);
      }
    }
  }
});

test('sitemap includes only canonical indexable pages', async () => {
  const sitemap = await read('sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(urls.sort(), documents.map(d => d.url).sort());
  assert.ok(!urls.some(url => new URL(url).hostname !== 'rospopa.com' || ['/search/', '/404.html'].includes(new URL(url).pathname)));
});

test('assistant reference retains citations and canonical section links', async () => {
  const full = await read('llms-full.txt');
  const directory = await read('llms.txt');
  for (const { url } of documents) {
    assert.ok(full.includes(`Source: ${url}`), `missing full text for ${url}`);
    assert.ok(directory.includes(`](${url})`), `missing directory link for ${url}`);
  }
  assert.match(full, /\[[^\]]+\]\(https:\/\/www\.irs\.gov\/[^)]*\)/);
  assert.match(full, /\[[^\]]+\]\(https:\/\/rospopa\.com\/resources\/glossary\/#noi\)/);
  assert.ok(!full.includes('](https://rospopa.com/#exchange-sequence)'), 'relative fragments must retain their page');
});

test('search and error pages stay out of the index', async () => {
  for (const file of ['search/index.html', '404.html']) {
    assert.match(await read(file), /name="robots" content="noindex, follow"/);
  }
});
