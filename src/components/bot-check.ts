// What the bot check (Decision 12) says and which Turnstile site key it uses. BotCheck.astro puts
// both on the page; /assets/bot-check.js shows the messages. Every language in src/i18n.ts needs its copy here.
import type { Lang } from '../i18n';

/** Cloudflare's always-pass test site key, used by local builds and CI. */
export const TEST_SITE_KEY = '1x00000000000000000000AA';

/**
 * The site key the build embeds. Vercel sets PUBLIC_TURNSTILE_SITE_KEY: the real key on
 * Production, the test key on Preview. A production build without it fails instead of shipping
 * forms nobody can send.
 */
export function siteKey(key: string | undefined, vercelEnv: string | undefined): string {
  if (key) return key;
  if (vercelEnv === 'production') throw new Error('PUBLIC_TURNSTILE_SITE_KEY must be set for a production build');
  return TEST_SITE_KEY;
}

export const botCheckCopy = {
  en: {
    /** The function refused the token, or Turnstile couldn't run in this browser. */
    failed: 'We couldn’t confirm this came from a person. Reload the page and try again.',
    /** Too many sends from one place; {wait} is `minute` or `minutes`. */
    limited: 'That’s a lot of tries from your network. Try again in {wait}.',
    minute: 'a minute',
    minutes: '{n} minutes',
  },
  fr: {
    failed: 'Nous n’avons pas pu confirmer que l’envoi vient d’une personne. Rechargez la page et réessayez.',
    limited: 'Il y a eu beaucoup d’essais à partir de votre réseau. Réessayez dans {wait}.',
    minute: 'une minute',
    minutes: '{n}\u00a0minutes',
  },
} as const satisfies Record<Lang, Record<'failed' | 'limited' | 'minute' | 'minutes', string>>;

export type { Lang };
