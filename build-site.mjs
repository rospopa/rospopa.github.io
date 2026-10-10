// Builds the generated parts of the public site. Run from the repository root:
//   node build-site.mjs           # search index, sitemap, Atom feed, llms-full.txt, news section (from cached news.json)
//   node build-site.mjs --news    # also refresh resources/news.json from the news feeds first
// The GitHub Actions workflow in .github/workflows/update-news.yml runs the
// --news variant daily. This file is excluded from the GitHub Pages build.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { decodeContactValue } from './resources/contact-data.mjs';
import { updateSeo, buildAssistantDirectory } from './site-seo.mjs';

const ORIGIN = 'https://rospopa.com';
const AUTHOR = { name: 'Pavlo Rospopa', url: `${ORIGIN}/` };
const PAGES = [
  'index.html',
  'resources/index.html',
  'resources/industrial-real-estate-faq/index.html',
  'resources/industrial-investor-faq/index.html',
  'resources/community/index.html',
  'resources/industrial-building-types/index.html',
  'resources/truck-dimensions-turning/index.html',
  'resources/chicago-industrial-real-estate/index.html',
  'resources/industrial-due-diligence/index.html',
  'resources/chicagoland-industrial-submarkets/index.html',
  'resources/chicagoland-industrial-real-estate/index.html',
  'resources/illinois-industrial-property-taxes/index.html',
  'resources/selling-industrial-property/index.html',
  'resources/commercial-investment/index.html',
  'resources/retirement-cre-investing/index.html',
  'resources/cre-tax-retirement/index.html',
  'resources/battery-energy-storage/index.html',
  'resources/commercial-property-owner-questions/index.html',
  'resources/net-operating-income/index.html',
  'resources/discounted-cash-flow/index.html',
  'resources/commercial-property-dcf-calculator/index.html',
  'resources/reduce-commercial-property-costs/index.html',
  'resources/commercial-property-insurance/index.html',
  'resources/commercial-property-budget/index.html',
  'resources/commercial-leasing/index.html',
  'resources/chicago-commercial-real-estate/index.html',
  'resources/glossary/index.html',
];
const MAX_TEXT = 1400;
const today = new Date().toISOString().slice(0, 10);

// ---- helpers ---------------------------------------------------------------
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escapeXml = escapeHtml;
const plain = html => decode(html.replace(/<(script|style|form)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|li|dd|dt|h[1-6]|tr|caption|section|div|aside|figcaption)>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const first = (html, re) => { const m = html.match(re); return m ? plain(m[1]) : ''; };
function git(args) { try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return ''; } }
function lastmod(file) {
  if (git(['status', '--porcelain', '--', file])) return today;
  const committed = git(['log', '-1', '--format=%cI', '--', file]);
  return committed ? new Date(committed).toISOString().slice(0, 10) : today;
}

// ---- news ------------------------------------------------------------------
const NEWS_PATH = 'resources/news.json';
const INDUSTRIAL = /\b(industrial|warehouse|warehousing|logistics|distribution (center|facility|hub|space)|manufactur\w*|flex (space|building|industrial)|cold[- ]storage|intermodal|truck terminal|industrial outdoor storage|IOS\b|spec building|big[- ]box)/i;
const REGION = /\b(chicago\w*|illinois|cook county|dupage|will county|kane county|lake county|mchenry|kendall|grundy|dekalb|joliet|elk grove|bolingbrook|romeoville|aurora|naperville|schaumburg|bedford park|cicero|blue island|elwood|o['’]?hare|elgin|waukegan|des plaines|franklin park|melrose park|bensenville|addison|carol stream|west chicago|geneva|batavia|yorkville|oswego|plainfield|minooka|channahon|morris|woodstock|crystal lake|huntley|university park|monee|wilmington|lockport|lemont|hodgkins|mccook|alsip|bridgeview|chicago heights|south holland|harvey|markham|matteson|new lenox|frankfort|mokena|tinley park|orland park|rosemont|itasca|wood dale|roselle|hanover park|streamwood|hoffman estates|arlington heights|wheeling|buffalo grove|lincolnshire|vernon hills|libertyville|gurnee|zion|grayslake|round lake|antioch|sycamore|genoa|sandwich|plano|shorewood|crest hill|i-?55|i-?80|i-?88|i-?90|i-?294|i-?355)/i;
const FEEDS = [
  { name: 'Google News', url: 'https://news.google.com/rss/search?q=Chicago+industrial+real+estate+OR+warehouse&hl=en-US&gl=US&ceid=US:en', regional: false, aggregator: true },
  { name: 'Bisnow Chicago', url: 'https://www.bisnow.com/rss/chicago', regional: true },
  { name: 'REjournals', url: 'https://rejournals.com/feed/', regional: false },
  { name: 'REjournals', url: 'https://rejournals.com/category/industrial/feed/', regional: false },
  { name: 'Connect CRE', url: 'https://www.connectcre.com/feed/?story-market=chicago-midwest', regional: false },
  { name: 'The Real Deal Chicago', url: 'https://therealdeal.com/chicago/feed/', regional: true },
];
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i')); return m ? decode(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')).trim() : ''; };

async function fetchNews() {
  const items = [];
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; rospopa.com news; +https://rospopa.com/)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
      if (!res.ok) { console.warn(`news: ${feed.name} answered ${res.status}`); continue; }
      const body = await res.text();
      if (!/<(?:rss|feed)\b/i.test(body)) { console.warn(`news: ${feed.name} did not return an RSS or Atom feed`); continue; }
      const entries = body.match(/<item>[\s\S]*?<\/item>|<entry>[\s\S]*?<\/entry>/gi) || [];
      let matched = 0;
      for (const it of entries) {
        let title = tag(it, 'title').replace(/^(news|breaking|exclusive)\s*[|:]\s*/i, '');
        let source = tag(it, 'source') || feed.name;
        if (feed.aggregator) { const m = title.match(/^(.*)\s-\s([^-]+)$/); if (m) { title = m[1].trim(); source = source === feed.name ? m[2].trim() : source; } }
        const alternate = (it.match(/<link\b[^>]*>/gi) || []).find(link => !/\brel=["'](?:self|enclosure)["']/i.test(link) && /\bhref=/i.test(link));
        const link = tag(it, 'link') || decode((alternate && alternate.match(/\bhref=["']([^"']+)["']/i) || [])[1] || '');
        const date = new Date(tag(it, 'pubDate') || tag(it, 'updated') || tag(it, 'published'));
        // House style avoids dashes: number ranges read "to", other dashes become a colon or comma.
        title = title.replace(/(\d)\s*[\u2012\u2013\u2014]\s*(\d)/g, '$1 to $2').replace(/\s+[\u2012\u2013\u2014\u2015-]{1,2}\s+/, ': ').replace(/\s+[\u2012\u2013\u2014\u2015-]{1,2}\s+/g, ', ').replace(/\s*[\u2012\u2013\u2014\u2015]\s*/g, ', ');
        if (!title || !/^https?:\/\//.test(link) || isNaN(date)) continue;
        if (date > Date.now() || Date.now() - date > 30 * 86400000) continue;
        if (!INDUSTRIAL.test(title)) continue;
        if (!feed.regional && !REGION.test(title)) continue;
        items.push({ title, url: link, source, date: date.toISOString().slice(0, 10) });
        matched++;
      }
      console.log(`news: ${feed.name} parsed ${entries.length} entries, ${matched} recent Chicago industrial matches (${feed.url})`);
    } catch (error) { console.warn(`news: ${feed.name} failed: ${error.message}`); }
  }
  // De-duplicate by normalized title, prefer direct publisher links over aggregator redirects.
  const seen = new Map();
  for (const item of items.sort((a, b) => (a.url.includes('news.google.com') ? 1 : 0) - (b.url.includes('news.google.com') ? 1 : 0))) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
    if (!seen.has(key)) seen.set(key, item);
  }
  const result = [...seen.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  return { updated: today, items: result };
}

function renderNews(news) {
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const long = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
  const cards = news.items.map(item => `<li class="news-card"><a href="${escapeHtml(item.url)}" rel="noopener nofollow">${escapeHtml(item.title)}</a><p class="news-meta"><span class="news-source">${escapeHtml(item.source)}</span> · <time datetime="${item.date}">${fmt.format(new Date(item.date + 'T00:00:00Z'))}</time></p></li>`).join('\n          ');
  const body = news.items.length
    ? `<div class="carousel" data-carousel>
        <button type="button" class="carousel-btn prev" aria-label="Scroll headlines back" hidden>&#8249;</button>
        <ul class="news-track" tabindex="0" aria-label="Recent headlines; scrolls horizontally">
          ${cards}
        </ul>
        <button type="button" class="carousel-btn next" aria-label="Scroll headlines forward" hidden>&#8250;</button>
      </div>`
    : `<p class="meta">No recent headlines matched today’s industrial filters. Check back tomorrow.</p>`;
  return `<!-- news:start -->
    <section class="news" aria-labelledby="news-heading">
      <div class="news-head"><h2 id="news-heading">Chicago industrial news</h2><p class="meta">Updated <time datetime="${news.updated}">${long.format(new Date(news.updated + 'T00:00:00Z'))}</time> · Refreshed daily from public news feeds; headlines link to their publishers and are not endorsements.</p></div>
      ${body}
    </section>
    <!-- news:end -->`;
}

// ---- markdown conversion for llms-full.txt ----------------------------------
const T = name => `<${name}(?=[\\s>])[^>]*>`;   // opening tag matcher that does not bleed into <picture>, <path>, <link>, …
function toMarkdown(mainHtml) {
  let h = mainHtml.replace(/\r\n?/g, '\n')
    .replace(/<nav class="(toc|breadcrumbs|chips)"[\s\S]*?<\/nav>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<(picture|source|img)(?=[\s>])[^>]*>/gi, '')
    .replace(/<span class="credit">[\s\S]*?<\/span>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<section class="news"[\s\S]*?<\/section>/gi, '')
    .replace(/<div class="post-head">[\s\S]*?<strong>([\s\S]*?)<\/strong>[\s\S]*?<span class="post-role">([\s\S]*?)<\/span>([\s\S]*?)<\/div>/gi, (_, name, role, flag) => `\n<p>**${plain(name)}** (${plain(role)})${/Answer/.test(flag) ? ' (answer)' : ''}:</p>\n`);
  h = h.replace(new RegExp(`${T('h1')}([\\s\\S]*?)<\\/h1>`, 'gi'), (_, t) => `\n# ${plain(t)}\n`)
    .replace(new RegExp(`${T('h2')}([\\s\\S]*?)<\\/h2>`, 'gi'), (_, t) => `\n## ${plain(t)}\n`)
    .replace(new RegExp(`${T('h3')}([\\s\\S]*?)<\\/h3>`, 'gi'), (_, t) => `\n### ${plain(t)}\n`)
    .replace(/<caption>([\s\S]*?)<\/caption>/gi, (_, t) => `\n**${plain(t)}**\n`)
    .replace(new RegExp(`${T('tr')}([\\s\\S]*?)<\\/tr>`, 'gi'), (_, row) => { const cells = [...row.matchAll(/<t[hd](?=[\s>])[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m => plain(m[1])); return cells.length ? `- ${cells.join(': ')}\n` : ''; })
    .replace(new RegExp(`${T('dt')}([\\s\\S]*?)<\\/dt>\\s*${T('dd')}([\\s\\S]*?)<\\/dd>`, 'gi'), (_, t, d) => `- **${plain(t)}**: ${plain(d)}\n`)
    .replace(new RegExp(`${T('li')}([\\s\\S]*?)<\\/li>`, 'gi'), (_, t) => `- ${plain(t)}\n`)
    .replace(/<figcaption>([\s\S]*?)<\/figcaption>/gi, (_, t) => `\n_${plain(t)}_\n`)
    .replace(/<(?:aside|div) class="note"(?: role="note")?>([\s\S]*?)<\/(?:aside|div)>/gi, (_, t) => `\n> ${plain(t)}\n`)
    .replace(new RegExp(`${T('p')}([\\s\\S]*?)<\\/p>`, 'gi'), (_, t) => { const s = plain(t); return s ? `\n${s}\n` : ''; });
  return decode(h.replace(/<[^>]+>/g, '')).split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').replace(/(^- .*)\n\n(?=- )/gm, '$1\n').trim();
}

// ---- main ------------------------------------------------------------------
let news = { updated: today, items: [] };
if (process.argv.includes('--news')) {
  news = await fetchNews();
  await writeFile(NEWS_PATH, JSON.stringify(news, null, 2) + '\n');
  console.log(`news: ${news.items.length} headlines from ${new Set(news.items.map(i => i.source)).size} sources`);
} else if (existsSync(NEWS_PATH)) {
  news = JSON.parse(await readFile(NEWS_PATH, 'utf8'));
}
{
  let home = await readFile('index.html', 'utf8');
  if (!home.includes('<!-- news:start -->')) throw new Error('index.html: news markers missing');
  home = home.replace(/<!-- news:start -->[\s\S]*?<!-- news:end -->/, renderNews(news));
  await writeFile('index.html', home);
}
const homeContact = await readFile('index.html', 'utf8');
const businessCard = homeContact.match(/<div class="contact-card"><h3>Business<\/h3>([\s\S]*?)<\/div>/);
if (!businessCard) throw new Error('Homepage business contact source is missing');
const contactValues = new Map([...businessCard[1].matchAll(/data-c="([^"]+)" data-t="([^"]+)"/g)].map(([, value, type]) => [type, decodeContactValue(value)]));
const phone = contactValues.get('tel'), email = contactValues.get('mail');
if (!phone || !email) throw new Error('Homepage business phone or email is missing');
const directContact = `<!-- direct-contact:start -->
      <p class="direct-contact"><a class="btn btn-primary" href="tel:+1${phone.replace(/\D/g, '')}">Call&nbsp;${escapeHtml(phone).replace(/ /g, '&nbsp;').replace(/-/g, '&#8209;')}</a> <!--email_off--><a class="btn btn-outline" href="mailto:${escapeHtml(email)}">Email ${escapeHtml(email)}</a><!--/email_off--></p>
      <!-- direct-contact:end -->`;
for (const page of PAGES) {
  let html = await readFile(page, 'utf8');
  const faqSection = html.match(/<section id="faq" data-faq-schema="true">([\s\S]*?)<\/section>/);
  if (faqSection) {
    const schemaScript = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
    if (!schemaScript || !canonical) throw new Error(`${page}: generated FAQ requires structured data and a canonical URL`);
    const schema = JSON.parse(schemaScript[1]);
    const faq = schema['@graph'].find(node => node['@type'] === 'FAQPage');
    if (!faq) throw new Error(`${page}: FAQPage node missing`);
    const answers = [...faqSection[1].matchAll(/<h3 id="([^"]+)">([\s\S]*?)<\/h3>\s*<p>((?:(?!<\/p>)[\s\S])*)<\/p>(?=\s*<h3\b|\s*$)/g)];
    const headings = [...faqSection[1].matchAll(/<h3\b/g)];
    if (!answers.length || answers.length !== headings.length) throw new Error(`${page}: every generated FAQ heading must have an id and an answer paragraph`);
    faq.mainEntity = answers.map(([, id, question, answer]) => ({
      '@type': 'Question', '@id': `${canonical[1]}#${id}`, name: plain(question),
      acceptedAnswer: { '@type': 'Answer', text: plain(answer) },
    }));
    html = html.replace(schemaScript[0], `<script type="application/ld+json">\n  ${JSON.stringify(schema)}\n  </script>`);
  }
  if (html.includes('<!-- direct-contact:start -->')) {
    html = html.replace(/<!-- direct-contact:start -->[\s\S]*?<!-- direct-contact:end -->/, directContact);
  } else if (page.startsWith('resources/')) {
    const strip = `<aside class="guide-contact cta" aria-labelledby="guide-contact-heading"><h2 id="guide-contact-heading">Talk about your building</h2><p>Questions about selling an industrial building? Contact Pavlo Rospopa at Marcus &amp; Millichap.</p>
      ${directContact}
    </aside>`;
    const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i);
    const hero = main && main[0].match(/<div class="page-hero">[\s\S]*?<\/div>(?:<!-- \/page-hero -->)?/);
    if (!hero) throw new Error(`${page}: main page hero missing for contact strip`);
    html = html.replace(main[0], main[0].replace(hero[0], `${hero[0]}\n    ${strip}`));
  }
  if (page.startsWith('resources/')) {
    const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i);
    const heroEnd = main && main[0].match(/<div class="page-hero">[\s\S]*?<\/div>/);
    const contacts = [...html.matchAll(/<aside class="guide-contact cta"(?=[\s>])/g)];
    const contactPosition = main ? main[0].indexOf('<aside class="guide-contact cta"') : -1;
    if (contacts.length !== 1 || !heroEnd || contactPosition < heroEnd.index + heroEnd[0].length) {
      throw new Error(`${page}: exactly one guide contact strip must appear inside main after the page hero`);
    }
  }
  if (html !== await readFile(page, 'utf8')) await writeFile(page, html);
}
// Version the calculator dependency graph, not just its entry module.
for (const name of ['dcf-metrics.mjs', 'dcf-calculator.mjs']) {
  const file = `resources/${name}`;
  if (!existsSync(file)) continue;
  let source = await readFile(file, 'utf8');
  for (const dependency of ['dcf-engine.mjs', 'dcf-fields.mjs', 'dcf-metrics.mjs']) {
    if (dependency === name || !source.includes(`./${dependency}`)) continue;
    const version = createHash('sha256').update(await readFile(`resources/${dependency}`)).digest('hex').slice(0, 10);
    source = source.replaceAll(new RegExp(`\\./${dependency.replace('.', '\\.')}(?:\\?v=[a-f0-9]+)?`, 'g'), `./${dependency}?v=${version}`);
  }
  await writeFile(file, source);
}
const calculatorPage = 'resources/commercial-property-dcf-calculator/index.html';
if (existsSync(calculatorPage)) {
  let html = await readFile(calculatorPage, 'utf8');
  for (const name of ['dcf-calculator.css', 'dcf-calculator.mjs']) {
    const version = createHash('sha256').update(await readFile(`resources/${name}`)).digest('hex').slice(0, 10);
    html = html.replaceAll(new RegExp(`/resources/${name.replace('.', '\\.')}(?:\\?v=[a-f0-9]+)?`, 'g'), `/resources/${name}?v=${version}`);
  }
  await writeFile(calculatorPage, html);
}
await updateSeo([...PAGES, 'search/index.html', '404.html'], lastmod);
const records = [], pages = [];
for (const page of PAGES) {
  if (!existsSync(page)) { console.warn(`Skipping ${page}: file not found`); continue; }
  const html = await readFile(page, 'utf8');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!canonical) throw new Error(`${page}: missing canonical URL`);
  const url = new URL(canonical[1]).pathname;
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (!main) throw new Error(`${page}: missing <main>`);
  const title = first(html, /<h1>([\s\S]*?)<\/h1>/);
  if (!title) throw new Error(`${page}: missing <h1>`);
  const description = decode((html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || '');
  const published = (html.match(/"datePublished":"(\d{4}-\d{2}-\d{2})"/) || [])[1] || today;
  const figure = html.match(/<figure class="(?:hero|guide)-figure"[\s\S]*?<img src="([^"]+)"[\s\S]*?alt="([^"]*)"[\s\S]*?<figcaption>([\s\S]*?)<span class="credit">/);
  pages.push({ page, url, title, description, published, modified: lastmod(page), markdown: toMarkdown(main[1]),
    image: figure ? { loc: ORIGIN + figure[1], title: plain(figure[2]), caption: plain(figure[3]) } : null });

  const intro = main[1].split(/<section\b/i)[0].replace(/<nav class="toc"[\s\S]*?<\/nav>/i, ' ').replace(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/i, ' ').replace(/<!-- news:start -->[\s\S]*?<!-- news:end -->/, ' ');
  records.push({ p: title, u: url, h: title, t: plain(intro).slice(0, MAX_TEXT) });
  for (const section of main[1].matchAll(/<section\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/gi)) {
    const [, id, body] = section;
    const heading = first(body, /<h2[^>]*>([\s\S]*?)<\/h2>/) || title;
    const terms = [...body.matchAll(/<dt id="([^"]+)">([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi)];
    if (terms.length) { for (const [, termId, term, definition] of terms) records.push({ p: title, u: `${url}#${termId}`, h: plain(term), t: plain(definition).slice(0, MAX_TEXT) }); continue; }
    const text = plain(body.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, ' '));
    if (text) records.push({ p: title, u: `${url}#${id}`, h: heading, t: text.slice(0, MAX_TEXT) });
    // Sub-records for subsections with their own ids (e.g. individual Q&A entries).
    for (const sub of body.matchAll(/<h3 id="([^"]+)">([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3 id=|$)/g)) {
      const subText = plain(sub[3]);
      if (subText) records.push({ p: title, u: `${url}#${sub[1]}`, h: plain(sub[2]), t: subText.slice(0, MAX_TEXT) });
    }
  }
}
await writeFile('resources/search-index.json', JSON.stringify(records));

// sitemap.xml with image entries
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map(p => `  <url>
    <loc>${ORIGIN}${p.url}</loc>
    <lastmod>${p.modified}</lastmod>${p.image ? `
    <image:image>
      <image:loc>${escapeXml(p.image.loc)}</image:loc>
      <image:title>${escapeXml(p.image.title)}</image:title>
      <image:caption>${escapeXml(p.image.caption)}</image:caption>
    </image:image>` : ''}
  </url>`).join('\n')}
</urlset>
`;
await writeFile('sitemap.xml', sitemap);

// Atom feed of the guides
const latest = pages.map(p => p.modified).sort().pop();
const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Chicagoland Industrial: guides for industrial owners, buyers, and tenants</title>
  <subtitle>Guides to industrial property research, selling, leasing, and investment across Cook, DeKalb, DuPage, Grundy, Kane, Kendall, Lake, McHenry, and Will counties, Illinois.</subtitle>
  <link href="${ORIGIN}/feed.xml" rel="self" type="application/atom+xml"/>
  <link href="${ORIGIN}/" rel="alternate" type="text/html"/>
  <id>${ORIGIN}/</id>
  <updated>${latest}T00:00:00Z</updated>
  <author><name>${AUTHOR.name}</name><uri>${AUTHOR.url}</uri></author>
${pages.filter(p => p.url !== '/').map(p => `  <entry>
    <title>${escapeXml(p.title)}</title>
    <link href="${ORIGIN}${p.url}" rel="alternate" type="text/html"/>
    <id>${ORIGIN}${p.url}</id>
    <published>${p.published}T00:00:00Z</published>
    <updated>${p.modified}T00:00:00Z</updated>
    <summary>${escapeXml(p.description)}</summary>
  </entry>`).join('\n')}
</feed>
`;
await writeFile('feed.xml', feed);
await buildAssistantDirectory(pages);

// llms-full.txt — the complete text of every public guide in Markdown
const full = [`# Chicagoland Industrial: public guides, full text`, '',
  `> ${AUTHOR.name} specializes in investment sales of industrial assets from 10,000 to 100,000 square feet across Cook, DeKalb, DuPage, Grundy, Kane, Kendall, Lake, McHenry, and Will counties in Illinois. This file contains the complete text of the public guides at ${ORIGIN}/ for reading by assistants and tools. Definitions and checklists are general education, not legal, tax, engineering, or investment advice. Guides last updated ${latest}.`, '',
  // Reuse the broker-search section maintained in llms.txt.
  ...((await readFile('llms.txt', 'utf8')).match(/^## Finding and choosing a commercial real estate broker[\s\S]*?(?=\n## )/m) || []).map(s => s.trim() + '\n'),
  ...pages.map(p => `---\n\nSource: ${ORIGIN}${p.url}\nPublished: ${p.published} · Updated: ${p.modified}\n\n${p.markdown}\n`)].join('\n');
await writeFile('llms-full.txt', full);

console.log(`Built: search index ${records.length} records · sitemap ${pages.length} URLs (${pages.filter(p => p.image).length} with images) · feed ${pages.length - 1} entries · llms-full.txt ${(full.length / 1024).toFixed(0)} KB · news ${news.items.length} headlines (updated ${news.updated})`);
