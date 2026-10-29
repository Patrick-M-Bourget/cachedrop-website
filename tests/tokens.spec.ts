import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pages } from './pages';

// Decision 11: literal colours, sizes and radii become var(--token) wherever a token
// exists. The tokens come from the design system itself, not from this repo.
const TOKENS_CSS = 'handoff/design-system/tokens.css';

type Rgba = string; // normalised "r,g,b,a"

function toRgba(literal: string): Rgba | null {
  const hex = literal.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
    const a = full.length === 8 ? Math.round((n(6) / 255) * 100) / 100 : 1;
    return `${n(0)},${n(2)},${n(4)},${a}`;
  }
  const fn = literal.match(/^rgba?\(([^)]+)\)$/i)?.[1];
  if (fn) {
    const [r, g, b, a = '1'] = fn.split(/[\s,/]+/).filter(Boolean);
    return `${+r},${+g},${+b},${Math.round(parseFloat(a) * 100) / 100}`;
  }
  return null;
}

const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi;

async function loadTokens() {
  const css = await readFile(TOKENS_CSS, 'utf8');
  const light = css.slice(0, css.indexOf('[data-theme="dark"]'));
  const scales = css.slice(css.indexOf('[data-theme="dark"]'));
  const defs = (src: string) => [...src.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()] as const);
  const px = (prefix: RegExp) =>
    new Set(defs(scales).filter(([n, v]) => prefix.test(n) && /^\d+px$/.test(v)).map(([, v]) => v));
  return {
    colors: new Set(defs(light).flatMap(([, v]) => (toRgba(v) ? [toRgba(v)!] : []))),
    wholeValues: new Set(defs(css).filter(([n]) => /^--(shadow|focus-ring|backdrop|font)-/.test(n)).map(([, v]) => v)),
    radii: px(/^--radius-/),
    spaces: px(/^--space-/),
    sizes: px(/^--(container|window|reading|lede|modal|nav|control|rating|tap|tile|icon|dot)/),
    zIndexes: new Set(defs(scales).filter(([n]) => n.startsWith('--z-')).map(([, v]) => v)),
  };
}

// Literals that equal a token's value but not its meaning. Say why for each one.
const ALLOWED = new Set([
  'max-width: 440px', // homepage "Careful by default" lede: same width as --modal-max, but it isn't a modal
]);

const SPACING = /^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left)(-|$)/;
const SIZING = /^(width|height|min-width|max-width|min-height|max-height|flex-basis|flex)$/;

/** Every declaration the built page applies, from style attributes, <style> blocks, bundled CSS and SVG paint attributes. */
async function declarations(html: string) {
  const sources: string[] = [];
  for (const m of html.matchAll(/\sstyle="([^"]*)"/g)) sources.push(m[1]);
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) sources.push(m[1]);
  for (const href of html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)) sources.push(await readFile(`dist${href[1]}`, 'utf8'));
  const decls: Array<[string, string]> = [];
  for (const src of sources) {
    for (const m of src.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/gi)) {
      if (!m[1].startsWith('--')) decls.push([m[1].toLowerCase(), m[2].trim()]);
    }
  }
  for (const m of html.matchAll(/\s(fill|stroke)="([^"]+)"/g)) decls.push([m[1], m[2]]);
  return decls;
}

for (const p of pages) {
  test(`${p.path} uses tokens instead of literal colours, sizes and radii`, async ({ request }) => {
    const tokens = await loadTokens();
    const html = await (await request.get(p.path)).text();
    const offenders: string[] = [];
    for (const [prop, value] of await declarations(html)) {
      const flag = () => ALLOWED.has(`${prop}: ${value}`) || offenders.push(`${prop}: ${value}`);
      for (const c of value.match(COLOR_LITERAL) ?? []) if (tokens.colors.has(toRgba(c)!)) flag();
      if (tokens.wholeValues.has(value)) flag();
      const pxValues = value.match(/(?<![\w.-])\d+px\b/g) ?? [];
      if (prop.startsWith('border') && prop.includes('radius') && pxValues.some((v) => tokens.radii.has(v))) flag();
      if (SPACING.test(prop) && pxValues.some((v) => tokens.spaces.has(v))) flag();
      if (SIZING.test(prop) && pxValues.some((v) => tokens.sizes.has(v))) flag();
      if (prop === 'z-index' && tokens.zIndexes.has(value)) flag();
      if (prop === 'font-family' && !value.startsWith('var(') && value !== 'inherit') flag();
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
}

test('the token checker catches a literal that has a token', async () => {
  // Guards the checker itself: a known-bad snippet must be reported.
  const tokens = await loadTokens();
  expect(tokens.colors.has(toRgba('#0071e3')!)).toBe(true);
  expect(tokens.colors.has(toRgba('#00000014')!)).toBe(true); // minified rgba(0,0,0,0.08)
  expect(tokens.radii.has('9999px')).toBe(true);
  expect(tokens.spaces.has('24px')).toBe(true);
  expect(tokens.sizes.has('1120px')).toBe(true);
});
