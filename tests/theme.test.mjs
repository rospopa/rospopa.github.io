import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const palette = await read('resources/palette.css');
const blocks = [...palette.matchAll(/[^{}]+\{([^}]+)\}/g)];
const declarations = block => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]));
const light = declarations(blocks[0][1]);
const dark = { ...light, ...declarations(blocks[1][1]) };
const resolveColor = (theme, key) => {
  const value = theme[key];
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  return reference ? resolveColor(theme, reference[1]) : value;
};
const luminance = hex => {
  const channels = hex.slice(1).match(/../g).map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

for (const [name, theme] of Object.entries({ light, dark })) {
  test(`${name} theme uses neutral structural colors`, () => {
    for (const key of ['--paper', '--color-base-100', '--color-base-200', '--color-base-300',
      '--ink', '--muted', '--brand', '--brand-soft', '--brand-line', '--brand-text',
      '--hero-bg', '--hero-ink', '--hero-muted', '--hero-accent', '--th-bg', '--th-ink',
      '--control-line', '--theme-chrome']) {
      const color = resolveColor(theme, key);
      assert.match(color, /^#[a-f0-9]{6}$/i, key);
      const [r, g, b] = color.slice(1).match(/../g).map(channel => parseInt(channel, 16));
      assert.ok(r === g && g === b, `${key}: ${color} is not neutral`);
    }
  });

  test(`${name} text and controls retain accessible contrast`, () => {
    const pairs = [
      ['--ink', '--paper'], ['--ink', '--color-base-100'], ['--muted', '--color-base-200'],
      ['--accent', '--paper'], ['--accent', '--color-base-100'], ['--accent', '--color-base-200'],
      ['--brand-text', '--brand-soft'], ['--hero-ink', '--hero-bg'], ['--hero-muted', '--hero-bg'],
      ['--th-ink', '--th-bg'], ['--color-primary-content', '--color-primary'],
      ['--color-secondary-content', '--color-secondary'], ['--color-accent-content', '--color-accent'],
      ['--color-neutral-content', '--color-neutral'],
    ];
    for (const [foreground, background] of pairs) {
      const a = luminance(resolveColor(theme, foreground)), b = luminance(resolveColor(theme, background));
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)} < 4.5`);
    }
    const control = luminance(resolveColor(theme, '--control-line'));
    const surface = luminance(resolveColor(theme, '--color-base-100'));
    assert.ok((Math.max(control, surface) + 0.05) / (Math.min(control, surface) + 0.05) >= 3);
  });
}

test('public pages version the theme script, stylesheet and nested palette', async () => {
  const version = content => createHash('sha256').update(content.replace(/\r\n?/g, '\n')).digest('hex').slice(0, 10);
  const stylesheet = await read('resources/resources.css');
  const script = await read('resources/theme.js');
  assert.ok(stylesheet.includes(`palette.css?v=${version(palette)}`));
  const pages = ['index.html', '404.html', 'search/index.html', 'resources/index.html'];
  for (const entry of await readdir(new URL('../resources/', import.meta.url), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = `resources/${entry.name}/index.html`;
    try { await read(file); pages.push(file); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const file of pages) {
    const html = await read(file);
    assert.ok(html.includes(`/resources/resources.css?v=${version(stylesheet)}`), file);
    assert.ok(html.includes(`/resources/theme.js?v=${version(script)}`), file);
  }
  assert.ok(script.includes(resolveColor(dark, '--theme-chrome')));
});
