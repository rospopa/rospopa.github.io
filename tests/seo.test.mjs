import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {updateHomepageSeo} from '../site-seo.mjs';

const root = resolve(import.meta.dirname, '..');
const read = file => readFile(resolve(root, file), 'utf8');
const origin = 'https://rospopa.com/';
const home = await read('index.html');

test('homepage metadata contains only verified identity and one canonical URL', () => {
  const title = home.match(/<title>([^<]+)<\/title>/)[1];
  const description = home.match(/<meta name="description" content="([^"]+)"/)[1].replace(/&amp;/g, '&');
  assert.ok(title.length <= 65);
  assert.ok(description.length >= 140 && description.length <= 160);
  assert.match(home, /<link rel="canonical" href="https:\/\/rospopa.com\/">/);
  assert.match(home, /name="robots" content="index, follow/);
  const graph = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  assert.deepEqual(graph.map(n => n['@type']), ['Person', 'Organization', 'WebSite', 'WebPage']);
  assert.equal(graph[0].name, 'Pavlo Rospopa');
  assert.equal(graph[1].name, 'Marcus & Millichap');
  assert.equal(graph[0].worksFor['@id'], graph[1]['@id']);
  assert.equal(graph[3].description, description);
  assert.equal(graph[3].url, origin);
  assert.equal(updateHomepageSeo(home), home, 'homepage SEO must be idempotent');
  assert.throws(() => updateHomepageSeo('<html><title>Old library</title></html>'), /focused homepage/);
});

test('homepage keeps one focused action without library enhancements', () => {
  assert.equal([...home.matchAll(/<h1\b/g)].length, 1);
  assert.equal([...home.matchAll(/class="primary-cta"/g)].length, 1);
  assert.match(home, /class="primary-cta" href="tel:\+16305702184"/);
  assert.match(home, /href="mailto:pavlo\.rospopa@marcusmillichap\.com"/);
  assert.match(home, /href="https:\/\/secure\.rospopa\.com\/"/);
  assert.doesNotMatch(home, /<script\b[^>]*\bsrc=|<nav\b|<form\b|<dialog\b|theme-toggle|news:start|href="\/resources\/"/);
  assert.match(home, /rel="preload" as="image"/);
  assert.match(home, /fetchpriority="high"/);
  assert.match(home, /rel="license noopener"/);
});

test('homepage has a secondary same-tab login and matches the secure wordmark', () => {
  const header = home.match(/<header\b[\s\S]*?<\/header>/)[0];
  assert.match(header, /<a class="login-link" href="https:\/\/secure\.rospopa\.com\/" rel="nofollow">Log in<\/a>/);
  assert.doesNotMatch(header, /\btarget=/);
  assert.match(home, /\.login-link \{[^}]*min-height: 44px/);
  assert.match(home, /a:focus-visible \{[^}]*outline: 3px/);
  assert.match(home, /Cormorant\+Garamond:wght@600;700;800&amp;display=swap/);
  assert.match(home, /\.brand \{[^}]*gap: \.75rem/);
  assert.match(home, /\.brand img \{ width: 36px; height: 36px; object-fit: contain;/);
  assert.match(home, /\.wordmark \{[^}]*gap: \.125rem; line-height: 1;/);
  assert.match(home, /\.brand-name \{ font-size: 1\.1rem; font-weight: 800; letter-spacing: \.08em;/);
  assert.match(home, /\.brand-given \{ font-size: \.7rem; font-weight: 600; letter-spacing: \.35em; text-transform: uppercase;/);
});

test('every retired public HTML file is a noindex redirect, including archive and 404', async () => {
  const files = ['404.html', 'search/index.html', 'resources/index.html'];
  for (const directory of ['resources', 'archive']) {
    async function visit(dir) {
      for (const entry of await readdir(resolve(root, dir), {withFileTypes: true})) {
        const file = `${dir}/${entry.name}`;
        if (entry.isDirectory()) await visit(file);
        else if (entry.name.endsWith('.html') && !files.includes(file)) files.push(file);
      }
    }
    await visit(directory);
  }
  assert.ok(files.length >= 60, 'all existing legacy routes must be retained as stubs');
  for (const file of files) {
    const html = await read(file);
    assert.match(html, /<meta http-equiv="refresh" content="0; url=\/">/, file);
    assert.match(html, /<meta name="robots" content="noindex">/, file);
    assert.match(html, /<link rel="canonical" href="https:\/\/rospopa.com\/">/, file);
    assert.match(html, /<script>location\.replace\('\/'\);<\/script>/, file);
    assert.match(html, /<a href="https:\/\/rospopa.com\/">Continue to rospopa.com<\/a>/, file);
    assert.ok(html.length < 700, `${file}: unexpected old content`);
    assert.doesNotMatch(html, /application\/ld\+json|src=|<link rel="stylesheet"/, file);
  }
});

test('discovery advertises only the homepage and the retired news job is absent', async () => {
  assert.deepEqual([...(await read('sitemap.xml')).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]), [origin]);
  const feed = await read('feed.xml');
  assert.match(feed, /xmlns="http:\/\/www.w3.org\/2005\/Atom"/);
  assert.doesNotMatch(feed, /<entry>/);
  assert.deepEqual(JSON.parse(await read('resources/search-index.json')), []);
  for (const file of ['llms.txt', 'llms-full.txt']) {
    const text = await read(file);
    assert.match(text, /Pavlo Rospopa/);
    assert.match(text, /10,000 to 100,000 square feet/);
    assert.doesNotMatch(text, /https:\/\/rospopa.com\/(?:resources|search)\//);
    assert.ok(text.length < 1100);
  }
  assert.match(await read('robots.txt'), /Sitemap: https:\/\/rospopa.com\/sitemap.xml/);
  assert.doesNotMatch(await read('robots.txt'), /Disallow: \//, 'retired routes must remain crawlable');
  await assert.rejects(access(resolve(root, '.github/workflows/update-news.yml')), {code: 'ENOENT'});
});
