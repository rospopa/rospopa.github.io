export const ORIGIN = 'https://rospopa.com';
const PERSON = `${ORIGIN}/#person`;
const ORGANIZATION = 'https://www.marcusmillichap.com/#organization';
const decode = value => value.replace(/&amp;/g, '&');

export function updateHomepageSeo(source) {
  let html = source.replace(/\r\n?/g, '\n');
  if (!/<html\b[^>]*\bdata-focused-home/.test(html)) {
    throw new Error('index.html must contain the focused homepage, not the retired library.');
  }
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  if (!title || !description) throw new Error('Homepage title and description are required.');
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${ORIGIN}/">`);
  for (const [key, value, attribute] of [
    ['og:title', title, 'property'], ['og:description', description, 'property'],
    ['og:url', `${ORIGIN}/`, 'property'], ['og:site_name', 'Pavlo Rospopa', 'property'],
    ['twitter:title', title, 'name'], ['twitter:description', description, 'name'],
  ]) {
    const tag = `<meta ${attribute}="${key}" content="${value}">`;
    const pattern = new RegExp(`<meta ${attribute}="${key}"[^>]*>`);
    html = pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`);
  }
  const graph = [
    {'@type': 'Person', '@id': PERSON, name: 'Pavlo Rospopa', url: `${ORIGIN}/`,
      sameAs: ['https://www.linkedin.com/in/prospopa', 'https://www.marcusmillichap.com/advisors/pavlo-rospopa'],
      worksFor: {'@id': ORGANIZATION}},
    {'@type': 'Organization', '@id': ORGANIZATION, name: 'Marcus & Millichap', url: 'https://www.marcusmillichap.com/'},
    {'@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: 'Pavlo Rospopa', url: `${ORIGIN}/`, publisher: {'@id': PERSON}},
    {'@type': 'WebPage', '@id': `${ORIGIN}/`, url: `${ORIGIN}/`, name: decode(title), description: decode(description),
      about: {'@id': PERSON}, isPartOf: {'@id': `${ORIGIN}/#website`}, inLanguage: 'en-US'},
  ];
  const script = `<script type="application/ld+json">\n  ${JSON.stringify({'@context': 'https://schema.org', '@graph': graph}).replace(/</g, '\\u003c')}\n  </script>`;
  html = /<script type="application\/ld\+json">[\s\S]*?<\/script>/.test(html)
    ? html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, script)
    : html.replace('</head>', `  ${script}\n</head>`);
  if (!html.includes(`<link rel="canonical" href="${ORIGIN}/">`)) {
    throw new Error('Homepage canonical link is missing.');
  }
  return html;
}

export function buildAssistantDirectory() {
  return `# Pavlo Rospopa

> Chicagoland industrial investment sales at Marcus & Millichap, focused on buildings of 10,000 to 100,000 square feet.

## Website
- [Pavlo Rospopa](${ORIGIN}/): Contact Pavlo about a Chicagoland industrial building.

## Contact and profiles
- Phone: (630) 570-2184
- Email: pavlo.rospopa@marcusmillichap.com
- [Marcus & Millichap profile](https://www.marcusmillichap.com/advisors/pavlo-rospopa)
- [LinkedIn](https://www.linkedin.com/in/prospopa)

The former public guides are retired. Their URLs redirect to the homepage.
`;
}
