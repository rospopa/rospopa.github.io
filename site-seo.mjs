import { readFile, writeFile } from 'node:fs/promises';

const ORIGIN = 'https://rospopa.com';
const PERSON = `${ORIGIN}/#person`, WEBSITE = `${ORIGIN}/#website`, ORGANIZATION = 'https://www.marcusmillichap.com/#organization';
const SOCIAL = {
  url: `${ORIGIN}/resources/images/chicago-industrial-river-social.jpg`,
  alt: 'Industrial buildings along the Chicago River at dusk, with the downtown skyline behind them.',
  width: 1200, height: 630,
};
const TITLES = {
  'chicago-commercial-real-estate': 'Chicago Commercial Real Estate Research Guide',
  'chicago-industrial-real-estate': 'Chicago Industrial Real Estate: Warehouse and Flex Guide',
  'commercial-investment': 'Chicago Commercial Property Investment and Purchase Diligence',
  'commercial-leasing': 'Chicago Commercial Leasing: Costs and Lease Checklist',
  'commercial-property-budget': 'Commercial Property Budgets, Reserves and Capex vs Opex',
  'commercial-property-dcf-calculator': 'Free Commercial Property DCF Calculator: NOI, IRR and Returns',
  'commercial-property-insurance': 'Commercial Property Insurance for Illinois Building Owners',
  'commercial-property-owner-questions': 'Commercial Property Owner Questions: NOI, Costs and Taxes',
  community: 'Commercial Property Questions: Forums and Industry Voices',
  'discounted-cash-flow': 'Commercial Real Estate DCF: NPV, IRR and Exit Cap Explained',
  'industrial-investor-faq': 'Industrial Investor FAQ: Pricing, Diligence, Debt and Exit',
  'industrial-real-estate-faq': 'Industrial Real Estate FAQ: 100 Common Questions Answered',
  'net-operating-income': 'How to Calculate Commercial Property NOI: Illinois Owner Guide',
  'reduce-commercial-property-costs': 'How to Reduce Commercial Property Operating Costs in Illinois',
  'selling-industrial-property': 'Selling Industrial Property in Chicagoland: Owner Guide',
  'retirement-cre-investing': 'CRE Retirement Planning: IRA, 401(k) and Property Owners',
  'cre-tax-retirement': 'Commercial Real Estate Taxes for Retiring Owners',
  'battery-energy-storage': 'Battery Energy Storage Systems: Industrial Owner Guide',
};
const DESCRIPTIONS = {
  'commercial-property-dcf-calculator': 'Free commercial property DCF calculator for NOI, cash flow, debt service, cap rate, IRR, NPV and equity multiple. No login; inputs stay in your browser.',
  home: 'Pavlo Rospopa focuses on Chicagoland industrial investment sales, 10,000 to 100,000 SF. Explore owner guides to value, costs, leases and Illinois taxes.',
  resources: 'Explore Chicagoland industrial real estate guides to building types, due diligence, Illinois taxes, selling, leasing, owner expenses and investment analysis.',
  '404': 'This page is not available. Find public Chicagoland industrial real estate guides on property research, selling, leasing, taxes and owner expenses.',
  'chicago-commercial-real-estate': 'Research Chicago commercial property with a checklist for use, jurisdiction, zoning, building records, property taxes and lease or purchase decisions.',
  'chicago-industrial-real-estate': 'Evaluate Chicago industrial, warehouse, logistics and flex space with checks for loading, clear height, truck access, power, zoning and environmental risk.',
  'commercial-investment': 'A Chicago commercial and industrial purchase checklist covering income, leases, expenses, capital repairs, financing, title and environmental diligence.',
  'chicagoland-industrial-submarkets': 'Explore Chicagoland industrial submarkets, logistics corridors and freight infrastructure. Use location diligence questions, not invented market statistics.',
  'commercial-property-insurance': 'Illinois owner guide to commercial building insurance, loss of rents, liability, flood exclusions, coinsurance, deductibles and renewal cost review.',
  'commercial-property-owner-questions': 'Answers for Illinois commercial property owners on NOI, DCF, expense cuts, tax appeals, CAM, insurance, reserves and debt, with links to detailed guides.',
  community: 'Compare public forum and industry voices on commercial property, NOI, leases, insurance, renewals and Cook County taxes, with Pavlo Rospopa’s take.',
  glossary: 'Understand industrial real estate, leasing, underwriting and Illinois property terms. Find plain-English definitions of NOI, DCF, CAM, reserves and debt.',
  'illinois-industrial-property-taxes': 'Understand Illinois industrial property taxes, assessment, bills, appeals and Cook County incentives. Plan owner budgets, tenant recoveries and sale review.',
  'industrial-building-types': 'Compare industrial building types and specifications for Chicagoland assets, 10,000 to 100,000 SF. Review loading, power, clear height and verification.',
  'industrial-due-diligence': 'Check physical condition, environmental risk, title, zoning, leases and utilities for Chicagoland industrial property, from initial review through closing.',
  'industrial-investor-faq': 'Answers to industrial investor questions on pricing, building function, tenants, Illinois taxes, diligence, financing and exit for 10,000 to 100,000 SF.',
  'industrial-real-estate-faq': 'Answers to 100 industrial real estate questions on warehouses, leases, NOI, cap rates, selling, due diligence, Illinois taxes and Chicago logistics.',
  'selling-industrial-property': 'Prepare to sell a Chicagoland industrial building, 10,000 to 100,000 SF. Review buyer types, value drivers, documents, pricing and the transaction process.',
  'truck-dimensions-turning': 'Compare sourced truck and cargo dimensions, trailer and container distinctions, and fleet-specific turning paths for industrial sites. Not a clearance standard.',
  'cre-tax-retirement': 'Review federal and Illinois CRE taxes for retiring owners: passive losses, depreciation, recapture, 1031 exchanges, estate planning and inherited basis.',
};
const GLOSSARY_LINKS = [
  ['Net operating income (NOI)', 'noi'], ['effective gross income', 'egi'],
  ['Discounted cash flow (DCF)', 'dcf'], ['cap rate', 'cap-rate'],
  ['DSCR', 'dscr'], ['debt yield', 'debt-yield'], ['coinsurance', 'coinsurance'],
];
const RELATED = {
  'chicago-commercial-real-estate': [['chicago-industrial-real-estate', 'Industrial building suitability'], ['commercial-leasing', 'Commercial lease costs and obligations'], ['commercial-investment', 'Investment purchase diligence']],
  'chicago-industrial-real-estate': [['industrial-building-types', 'Industrial building types and specifications'], ['truck-dimensions-turning', 'Truck dimensions and turning-path checks'], ['industrial-due-diligence', 'Physical and environmental due diligence']],
  'chicagoland-industrial-real-estate': [['chicagoland-industrial-submarkets', 'Industrial submarkets and logistics corridors'], ['illinois-industrial-property-taxes', 'Illinois assessment and property taxes'], ['chicago-industrial-real-estate', 'Evaluating an industrial building']],
  'chicagoland-industrial-submarkets': [['chicagoland-industrial-real-estate', 'Nine-county property research'], ['truck-dimensions-turning', 'Fleet access and turning paths'], ['industrial-building-types', 'Industrial building function and specifications']],
  community: [['industrial-investor-faq', 'Investor underwriting questions'], ['selling-industrial-property', 'Preparing an industrial property sale'], ['industrial-due-diligence', 'Industrial purchase due diligence']],
  glossary: [['net-operating-income', 'NOI calculation and expense conventions'], ['discounted-cash-flow', 'DCF, NPV and exit-cap assumptions'], ['commercial-leasing', 'Lease costs and recovery obligations']],
  'industrial-building-types': [['truck-dimensions-turning', 'Truck dimensions and site access'], ['industrial-due-diligence', 'Verifying physical and environmental condition'], ['chicago-industrial-real-estate', 'Industrial building evaluation checklist']],
  'truck-dimensions-turning': [['industrial-building-types', 'Loading and industrial building specifications'], ['industrial-due-diligence', 'Site condition and access diligence'], ['commercial-leasing', 'Lease use approvals and obligations']],
};
const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = s => s.replace(/<\/(?:p|li|dd|dt|h[1-6]|tr|section|div|aside)>|<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
function meta(html, key, value, property = false) {
  const attr = property ? 'property' : 'name', re = new RegExp(`<meta ${attr}="${key}"[^>]*>`);
  const tag = `<meta ${attr}="${key}" content="${escape(value)}">`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}
export async function updateSeo(files, lastmod) {
  for (const file of files) {
    let html = await readFile(file, 'utf8');
    const original = html;
    html = html.replace(/\r\n?/g, '\n');
    const slug = file === 'index.html' ? 'home' : file === 'resources/index.html' ? 'resources' : file === '404.html' ? '404' : file === 'search/index.html' ? 'search' : file.split('/')[1];
    const route = file === '404.html' ? '/404.html' : '/' + file.replace(/index\.html$/, '');
    const url = ORIGIN + route, guide = file.startsWith('resources/') && slug !== 'resources', modified = lastmod(file);
    if (TITLES[slug]) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(TITLES[slug])}</title>`);
    const title = text(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
    if (!html.includes('rel="preload" href="/resources/fonts/inter-latin-wght.woff2"')) {
      html = html.replace('</head>', '  <link rel="preload" href="/resources/fonts/inter-latin-wght.woff2" as="font" type="font/woff2" crossorigin>\n</head>');
    }
    if (DESCRIPTIONS[slug]) html = meta(html, 'description', DESCRIPTIONS[slug]);
    const description = text(html.match(/<meta name="description" content="([^"]+)"/)[1]);
    const canonical = `<link rel="canonical" href="${url}">`;
    html = /<link rel="canonical"[^>]*>/.test(html) ? html.replace(/<link rel="canonical"[^>]*>/, canonical) : html.replace('</head>', `  ${canonical}\n</head>`);
    for (const [key, value] of Object.entries({ 'og:title': title, 'og:description': description, 'og:url': url, 'og:locale': 'en_US', 'og:site_name': 'Chicagoland Industrial' })) html = meta(html, key, value, true);
    const figure = html.match(/<figure class="(?:hero|guide)-figure"[^>]*>([\s\S]*?)<\/figure>/)?.[1];
    const img = figure?.match(/<img\b[^>]*>/)?.[0];
    const attribute = (markup, name) => markup?.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    const existingImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    const image = img ? ORIGIN + attribute(img, 'src') : existingImage || SOCIAL.url;
    const imageAlt = img ? attribute(img, 'alt') : html.match(/<meta property="og:image:alt" content="([^"]+)"/)?.[1] || SOCIAL.alt;
    const width = img ? Number(attribute(img, 'width')) : SOCIAL.width;
    const height = img ? Number(attribute(img, 'height')) : SOCIAL.height;
    if (!width || !height || !imageAlt) throw new Error(`${file}: preview image requires dimensions and alt text`);
    const credit = figure?.match(/<span class="credit">([\s\S]*?)<\/span>/)?.[1];
    const license = credit && [...credit.matchAll(/<a\b([^>]*)>/g)].find(m => /\brel="[^"]*\blicense\b/.test(m[1]));
    const imageObject = { '@type': 'ImageObject', url: image, width, height, caption: text(imageAlt), ...(credit ? { creditText: text(credit) } : {}), ...(license ? { license: attribute(license[0], 'href') } : {}) };
    for (const [key, value] of Object.entries({ 'og:type': guide ? 'article' : 'website', 'og:image': image, 'og:image:alt': text(imageAlt), 'og:image:width': width, 'og:image:height': height })) html = meta(html, key, value, true);
    for (const [key, value] of Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:title': title, 'twitter:description': description, 'twitter:image': image, 'twitter:image:alt': text(imageAlt) })) html = meta(html, key, value);
    html = meta(html, 'robots', ['search', '404'].includes(slug) ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const parsed = raw ? JSON.parse(raw[1]) : {};
    const graph = parsed['@graph'] || (parsed['@type'] ? [parsed] : []);
    const article = graph.find(n => n['@type'] === 'Article');
    const collection = graph.find(n => n['@type'] === 'CollectionPage');
    const published = article?.datePublished || collection?.datePublished || modified;
    const h1 = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]);
    const person = { '@type': 'Person', '@id': PERSON, name: 'Pavlo Rospopa', url: ORIGIN + '/', sameAs: ['https://www.linkedin.com/in/prospopa', 'https://www.marcusmillichap.com/advisors/pavlo-rospopa'], worksFor: { '@id': ORGANIZATION } };
    const organization = { '@type': 'Organization', '@id': ORGANIZATION, name: 'Marcus & Millichap', url: 'https://www.marcusmillichap.com/' };
    const website = { '@type': 'WebSite', '@id': WEBSITE, url: ORIGIN + '/', name: 'Chicagoland Industrial', inLanguage: 'en-US', publisher: { '@id': PERSON }, potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: ORIGIN + '/search/?q={search_term_string}' }, 'query-input': 'required name=search_term_string' } };
    const breadcrumbId = url + '#breadcrumb';
    const webpage = { ...collection, '@type': collection ? 'CollectionPage' : slug === 'search' ? 'SearchResultsPage' : 'WebPage', '@id': url, url, name: title, description, inLanguage: 'en-US', isPartOf: { '@id': WEBSITE }, ...(slug !== '404' ? { datePublished: published, dateModified: modified, author: { '@id': PERSON } } : {}), ...(slug !== 'home' ? { breadcrumb: { '@id': breadcrumbId } } : {}) };
    const preserved = graph.filter(n => !['Person', 'WebSite', 'Organization', 'WebPage', 'CollectionPage', 'SearchResultsPage', 'BreadcrumbList'].includes(n['@type']));
    if (article) {
      Object.assign(article, { '@id': url + '#article', name: title, headline: h1, description, dateModified: modified, author: { '@id': PERSON }, publisher: { '@id': PERSON }, mainEntityOfPage: { '@id': url }, isPartOf: { '@id': WEBSITE }, image: imageObject, about: { '@type': 'Thing', name: h1 } });
      webpage.mainEntity = { '@id': article['@id'] };
      html = meta(html, 'article:published_time', published + 'T00:00:00Z', true);
      html = meta(html, 'article:modified_time', modified + 'T00:00:00Z', true);
    }
    const breadcrumbs = [{ name: 'Home', item: ORIGIN + '/' }, ...(guide || slug === 'resources' ? [{ name: 'Guides', item: ORIGIN + '/resources/' }] : []), ...(slug !== 'resources' && slug !== 'home' ? [{ name: h1, item: url }] : [])];
    const nodes = [website, person, organization, webpage, ...preserved];
    if (slug !== 'home') nodes.push({ '@type': 'BreadcrumbList', '@id': breadcrumbId, itemListElement: breadcrumbs.map((b, i) => ({ '@type': 'ListItem', position: i + 1, ...b })) });
    if (guide) {
      const byline = `<!-- guide-byline:start --><p class="meta" data-guide-byline>By <a href="https://www.marcusmillichap.com/advisors/pavlo-rospopa" rel="author">Pavlo Rospopa</a> · Last updated <time datetime="${modified}">${new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(modified + 'T00:00:00Z'))}</time></p><!-- guide-byline:end -->`;
      if (!html.includes('<!-- /page-hero -->')) {
        html = html.replace(/(<div class="page-hero">[\s\S]*?<\/div>)/, '$1<!-- /page-hero -->');
      }
      html = html.includes('<!-- guide-byline:start -->')
        ? html.replace(/<!-- guide-byline:start -->[\s\S]*?<!-- guide-byline:end -->/, byline)
        : html.replace('<!-- /page-hero -->', `<!-- /page-hero -->\n    ${byline}`);
      const lead = html.match(/<p class="lead">([\s\S]*?)<\/p>/);
      const existingAnswer = html.match(/<p data-answer-summary>([\s\S]*?)<\/p>/);
      if (!lead && !existingAnswer) throw new Error(`${file}: guide requires a concise visible lead`);
      let answer = (existingAnswer || lead)[1];
      if (lead) html = html.replace(lead[0], '');
      if (slug !== 'glossary') {
        answer = answer.split(/(<a\b[\s\S]*?<\/a>|<[^>]+>)/).map(part => {
          if (part.startsWith('<')) return part;
          for (const [term, id] of GLOSSARY_LINKS) part = part.replace(term, `<a href="/resources/glossary/#${id}">${term}</a>`);
          return part;
        }).join('');
      }
      const summary = `<p data-answer-summary>${answer}</p>`;
      html = html.replace(/<p data-answer-summary>[\s\S]*?<\/p>/g, '');
      html = html.replace(/(<aside class="in-brief"[^>]*>\s*<h2[^>]*>[\s\S]*?<\/h2>)/, `$1${summary}`);
      const brief = html.match(/<aside class="in-brief"[\s\S]*?<\/aside>/);
      if (!brief) throw new Error(`${file}: guide has no visible answer summary`);
      html = html.replace(/\s*<aside class="in-brief"[\s\S]*?<\/aside>/, '');
      html = html.replace('<!-- guide-byline:end -->', `<!-- guide-byline:end -->\n    ${brief[0]}`);
      if (RELATED[slug] && !html.includes('id="related-guides"')) {
        html = html.replace('</main>', `  <section id="related-guides"><h2>Related guides</h2><ul>${RELATED[slug].map(([target, label]) => `<li><a href="/resources/${target}/">${escape(label)}</a></li>`).join('')}</ul></section>\n  </main>`);
      }
    }
    if (slug !== 'home') {
      const visible = `<nav class="breadcrumbs" aria-label="Breadcrumb">${breadcrumbs.map((b, i) => i === breadcrumbs.length - 1 ? `<span aria-current="page">${escape(b.name)}</span>` : `<a href="${new URL(b.item).pathname}">${escape(b.name)}</a>`).join(' / ')}</nav>`;
      html = html.includes('class="breadcrumbs"') ? html.replace(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/, visible) : html.replace('<div class="page-hero">', `<div class="page-hero">\n      ${visible}`);
    }
    html = html.replace(/<footer[\s\S]*?<\/footer>/, footer => footer.includes('href="/search/">Search the guides</a>') ? footer : footer.replace(/(<a href="\/resources\/commercial-property-owner-questions\/">[^<]+<\/a>)/, '$1 <a href="/search/">Search the guides</a>'));
    if (article) {
      const terms = [...html.matchAll(/href="\/resources\/glossary\/#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
      if (terms.length) article.mentions = [...new Map(terms.map(([, id, label]) => [id, { '@type': 'DefinedTerm', '@id': ORIGIN + '/resources/glossary/#' + id, name: text(label), inDefinedTermSet: { '@id': ORIGIN + '/resources/glossary/#terms' } }])).values()];
      if (slug === 'community') article.citation = [...new Set([...html.matchAll(/<blockquote\b[^>]*\bcite="([^"]+)"/g)].map(m => m[1]))];
    }
    for (const faq of nodes.filter(n => n['@type'] === 'FAQPage')) {
      if (slug === 'community') faq.mainEntity = [...html.matchAll(/<article class="editorial-topic"[^>]*>\s*<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].map(([, heading]) => ({
        '@type': 'Question', name: text(heading), acceptedAnswer: { '@type': 'Answer', text: '' },
      }));
      for (const question of faq.mainEntity) {
        const heading = [...html.matchAll(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/g)].find(m => text(m[1]) === text(question.name));
        if (!heading) throw new Error(`${file}: FAQ has no visible question: ${question.name}`);
        let body = html.slice(heading.index + heading[0].length).split(/<h[1234]\b|<\/(?:section|article)>/)[0];
        if (slug === 'community') {
          const note = body.match(/<div class="forum-take author-note">([\s\S]*?)<\/div>/);
          if (!note) throw new Error(`${file}: editorial FAQ has no author note: ${question.name}`);
          body = note[1].replace(/<p class="take-label">[\s\S]*?<\/p>/, '');
        }
        const answer = text(body);
        if (!answer) throw new Error(`${file}: FAQ has no visible answer: ${question.name}`);
        question.name = text(heading[1]);
        question.acceptedAnswer.text = answer;
      }
    }
    function linkPage(node) {
      if (!node || typeof node !== 'object') return;
      if (node['@id'] === url + '#webpage') node['@id'] = url;
      for (const value of Object.values(node)) Array.isArray(value) ? value.forEach(linkPage) : linkPage(value);
    }
    nodes.forEach(linkPage);
    const schema = `<script type="application/ld+json">\n  ${JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })}\n  </script>`;
    html = raw ? html.replace(raw[0], schema) : html.replace('</head>', `  ${schema}\n</head>`);
    html = html.replace(/[ \t]+$/gm, '');
    if (html !== original) await writeFile(file, html);
  }
}

export async function buildAssistantDirectory(pages) {
  const owners = new Set(['commercial-property-owner-questions', 'net-operating-income', 'discounted-cash-flow', 'reduce-commercial-property-costs', 'commercial-property-insurance', 'commercial-property-budget', 'illinois-industrial-property-taxes', 'commercial-investment', 'retirement-cre-investing', 'cre-tax-retirement', 'battery-energy-storage']);
  const link = p => `- [${p.title}](${ORIGIN}${p.url}): ${p.description}`;
  const ownerPages = pages.filter(p => owners.has(p.url.split('/')[2]));
  const otherPages = pages.filter(p => !ownerPages.includes(p));
  await writeFile('llms.txt', [
    '# Chicagoland Industrial: public guides by Pavlo Rospopa', '',
    '> Plain-English commercial and industrial property education for Chicagoland owners, buyers and tenants. Read answer-first guides to income, valuation, costs, Illinois taxes, leases and building diligence.', '',
    'The industrial focus is 10,000 to 100,000 square feet across Cook, DeKalb, DuPage, Grundy, Kane, Kendall, Lake, McHenry and Will counties, Illinois. Examples are illustrations, not market data. This library is not legal, tax, insurance, engineering or investment advice; verify property-specific facts and current official rules. The secure workspace is private.', '',
    '## Owner income, value and expenses', '', ...ownerPages.map(link), '',
    '## Building, lease and transaction guides', '', ...otherPages.map(link), '',
    '## Author and scope', '',
    '- [Pavlo Rospopa: official advisor profile](https://www.marcusmillichap.com/advisors/pavlo-rospopa): Official Marcus & Millichap profile linked on the public site.',
    '- [Pavlo Rospopa: LinkedIn](https://www.linkedin.com/in/prospopa): Professional profile linked on the public site.',
    'The site does not rank brokers, claim verified closed transactions or offer a universal best-broker recommendation. County coverage is a research scope, not an exhaustive definition of Chicagoland.', '',
    '## Reading tools', '',
    '- [Full public guide text](https://rospopa.com/llms-full.txt): Markdown text, source URLs and publication/update dates for every indexed page.',
    '- [Guide feed](https://rospopa.com/feed.xml): Atom entries with publication and modification dates.',
    '- [Sitemap](https://rospopa.com/sitemap.xml): Canonical indexed URLs with accurate modification dates.',
    '- [Search the guides](https://rospopa.com/search/): Client-side search; accepts a q query parameter and is not indexed.', '',
    'This optional directory is not an indexing directive or a promise of inclusion in answer engines. robots.txt and page-level directives are separate.', '',
  ].join('\n'));
}
