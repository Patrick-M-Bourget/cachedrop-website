import { describe, expect, it } from 'vitest';
import { downloadEmail } from './download-email.ts';

// The download email (Decision 53): subject, the download button with the trial line under it
// (Decision 51), the three first steps and no "free" or "beta" (Decisions 51, 52), in both languages.
const SITE = 'https://cachedrop.io';
const unsubscribe = (base: string) => ({ link: `${base}/unsubscribe/U/`, headers: { 'List-Unsubscribe': `<${SITE}/api/unsubscribe?token=U>` } });
const email = (lang: 'en' | 'fr') => {
  const base = lang === 'fr' ? `${SITE}/fr` : SITE;
  return downloadEmail('ada@example.com', lang, `${base}/download/${'T'.repeat(43)}/`, SITE, unsubscribe(base));
};
/** The email's visible text, without tags, with entities as written. */
const visible = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const COPY = {
  en: {
    subject: 'Your CacheDrop download',
    button: 'Download for Mac',
    trial: 'Try it before you buy · No card needed · macOS 14 or later',
    steps: ['Open the disk image', 'Drag it to Applications', 'Run your first scan'],
    folders: ['Downloads folder', 'Applications folder'],
  },
  fr: {
    subject: 'Votre téléchargement CacheDrop',
    button: 'Télécharger pour Mac',
    trial: 'Essayez-le avant d’acheter · Aucune carte requise · macOS 14 ou version ultérieure',
    steps: ['Ouvrez l’image disque', 'Glissez CacheDrop dans Applications', 'Lancez votre première analyse'],
    folders: ['dossier Téléchargements', 'dossier Applications'],
  },
} as const;

for (const lang of ['en', 'fr'] as const) {
  const c = COPY[lang];
  describe(`${lang}: the download email`, () => {
    it(`has the subject "${c.subject}"`, () => {
      expect(email(lang).subject).toBe(c.subject);
    });

    it('has one download button to the link, with the trial line right under it', () => {
      const { html } = email(lang);
      const link = `${lang === 'fr' ? `${SITE}/fr` : SITE}/download/${'T'.repeat(43)}/`;
      const buttons = [...html.matchAll(/<a href="([^"]+)" style="display:inline-block[^"]*">([^<]+)<\/a>/g)];
      expect(buttons.map(([, href, label]) => [href, label])).toEqual([[link, c.button]]);
      const afterButton = html.slice(html.indexOf(c.button)).split('\n')[1];
      expect(afterButton).toContain(c.trial);
    });

    it('lists the three first steps in order, in the text and the HTML', () => {
      const { text, html } = email(lang);
      const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(([, li]) => visible(li));
      expect(items).toHaveLength(3);
      c.steps.forEach((step, i) => {
        expect(items[i]).toContain(step);
        expect(text).toContain(`${i + 1}. ${step}.`);
      });
      for (const folder of c.folders) expect(visible(html)).toContain(folder);
    });

    it('states the trial once and never says "free" or "beta"', () => {
      const { text, html } = email(lang);
      for (const part of [text, visible(html)]) {
        expect(part.split(c.trial)).toHaveLength(2);
        expect(part).not.toMatch(/\bfree\b|gratuit|beta|bêta/i);
      }
    });
  });
}
