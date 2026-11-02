import { test, expect, type Page } from '@playwright/test';

// Decision 43 (with mac-cleaner Decisions 135 and 136): the draft terms of sale, refund policy
// and license agreement, in English and French. Each test reads the rendered page.

async function sectionText(page: Page, heading: string) {
  const section = page.locator('section', { has: page.getByRole('heading', { level: 2, name: heading, exact: true }) });
  await expect(section).toHaveCount(1);
  return (await section.innerText()).replace(/\s+/g, ' ');
}

type Check = { path: string; h1: string; title: string; mail: string; says: Array<[section: string, text: string[]]> };

const pages: Check[] = [
  {
    path: '/terms-of-sale/',
    h1: 'Terms of sale',
    title: 'Terms of Sale | CacheDrop',
    mail: 'hello@cachedrop.io',
    says: [
      ['What you buy', ['You pay once.', 'There is no subscription', 'every CacheDrop 1.x release', '2.0 may be a paid upgrade']],
      ['Try it first', ['scanning', 'Free until they’ve freed 2 GB on your Mac', 'Clean up and Applications uninstall']],
      ['Price', ['29.99', '19.99', 'US dollars, Canadian dollars, euros, pounds sterling and Australian dollars']],
      ['Who sells it', ['Link', 'Quebec, Canada']],
      ['Getting your license key', ['emailed', 'without an internet connection', 'sent again']],
      ['Refunds', ['30 days']],
      ['Your rights and the law', ['laws of Quebec', 'Consumer Protection Act']],
    ],
  },
  {
    path: '/fr/terms-of-sale/',
    h1: 'Conditions de vente',
    title: 'Conditions de vente | CacheDrop',
    mail: 'hello@cachedrop.io',
    says: [
      ['Ce que vous achetez', ['Vous payez une seule fois.', 'pas d’abonnement', 'toutes les versions 1.x', '2.0 pourrait être une mise à niveau payante']],
      ['Essayez d’abord', ['l’analyse', 'libéré 2 Go']], // sectionText folds the non-breaking space
      ['Prix', ['29,99', '19,99', 'dollars canadiens']],
      ['Qui le vend', ['Link', 'Québec, Canada']],
      ['Recevoir votre clé de licence', ['sans connexion Internet', 'renvoyer la clé']],
      ['Remboursements', ['30 jours']],
      ['Vos droits et la loi', ['lois du Québec', 'Loi sur la protection du consommateur']],
    ],
  },
  {
    path: '/refund-policy/',
    h1: 'Refund policy',
    title: 'Refund Policy | CacheDrop',
    mail: 'hello@cachedrop.io',
    says: [
      ['30 days, no questions asked', ['within 30 days', 'you don’t have to give a reason']],
      ['How to ask', ['hello@cachedrop.io']],
      ['Asking Link instead', ['Link support', '60 days']],
      ['What happens to the license', ['revoked', 'chargeback', 'next CacheDrop release', 'Once you install that release']],
    ],
  },
  {
    path: '/fr/refund-policy/',
    h1: 'Politique de remboursement',
    title: 'Politique de remboursement | CacheDrop',
    mail: 'hello@cachedrop.io',
    says: [
      ['30 jours, sans justification', ['dans les 30 jours', 'vous n’avez pas à donner de raison']],
      ['Comment le demander', ['hello@cachedrop.io']],
      ['Passer plutôt par Link', ['soutien de Link', '60 jours']],
      ['Ce qu’il advient de la licence', ['révoquée', 'rétrofacturation', 'version suivante de CacheDrop']],
    ],
  },
  {
    path: '/license-agreement/',
    h1: 'License agreement',
    title: 'License Agreement | CacheDrop',
    mail: 'hello@cachedrop.io',
    says: [
      ['What your license lets you do', ['Personal use', 'Up to 3 Macs', 'Every 1.x release']],
      ['No account, no activation server', ['without an internet connection', 'on your honour']],
      ['When a license is revoked', ['refunded', 'chargeback', 'leaked', 'next CacheDrop release']],
      ['What CacheDrop does to your files', ['reviewed a cleanup plan', 'Trash', 'deleted']],
      ['Warranty', ['as is']],
      ['Liability', ['As far as the law allows', 'Consumer Protection Act']],
      ['Changes and the law', ['laws of Quebec']],
    ],
  },
  {
    path: '/fr/license-agreement/',
    h1: 'Contrat de licence',
    title: 'Contrat de licence | CacheDrop',
    mail: 'hello@cachedrop.io',
    says: [
      ['Ce que votre licence vous permet', ['Usage personnel', 'Jusqu’à 3 Mac', 'Toutes les versions 1.x']],
      ['Aucun compte, aucun serveur d’activation', ['sans connexion Internet', 'votre parole']],
      ['Quand une licence est révoquée', ['remboursée', 'rétrofacturation', 'fuité']],
      ['Ce que CacheDrop fait à vos fichiers', ['plan de nettoyage', 'Corbeille', 'supprimés']],
      ['Garantie', ['tel quel']],
      ['Responsabilité', ['Dans la mesure permise par la loi', 'Loi sur la protection du consommateur']],
    ],
  },
];

for (const p of pages) {
  test.describe(p.path, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(p.path);
    });

    test('renders its title, heading and contact address', async ({ page }) => {
      await expect(page).toHaveTitle(p.title);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.h1);
      await expect(page.getByRole('link', { name: p.mail }).first()).toHaveAttribute('href', `mailto:${p.mail}`);
    });

    test('says what the decisions say', async ({ page }) => {
      for (const [section, lines] of p.says) {
        const text = await sectionText(page, section);
        for (const line of lines) expect(text, `${section}: ${line}`).toContain(line);
      }
    });

    test('lists every section in "On this page", and each link lands on it', async ({ page }) => {
      const links = page.locator('nav.toc a');
      expect(await links.count()).toBeGreaterThan(3);
      for (const href of await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')!))) {
        await expect(page.locator(href)).toHaveCount(1);
      }
    });
  });
}

test('the French pages put a non-breaking space before each colon (OQLF)', async ({ page }) => {
  for (const path of ['/fr/terms-of-sale/', '/fr/refund-policy/', '/fr/license-agreement/']) {
    await page.goto(path);
    const text = await page.locator('main').innerText();
    expect(text, path).not.toMatch(/[^\u00a0\s]:\s/);
    expect(text, path).not.toMatch(/ :/);
  }
});

test('the pages link to each other in the same language', async ({ page }) => {
  await page.goto('/terms-of-sale/');
  await expect(page.locator('main').getByRole('link', { name: 'license agreement' })).toHaveAttribute('href', '/license-agreement/');
  await expect(page.locator('main').getByRole('link', { name: 'refund policy' })).toHaveAttribute('href', '/refund-policy/');
  await page.goto('/fr/license-agreement/');
  await expect(page.locator('main').getByRole('link', { name: 'conditions de vente' })).toHaveAttribute('href', '/fr/terms-of-sale/');
  await expect(page.locator('main').getByRole('link', { name: 'politique de remboursement' })).toHaveAttribute('href', '/fr/refund-policy/');
});
