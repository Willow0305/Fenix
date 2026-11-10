import { expect, test } from '@playwright/test';

import { expectNoHorizontalScroll, watch } from './helpers';

/** Varredura das páginas públicas (R-10, caça a bugs): título, sem rolagem lateral, sem erro. */
const PAGES = [
  '/',
  '/sobre',
  '/times',
  '/noticias',
  '/eventos',
  '/loja',
  '/parceiros',
  '/forum',
  '/contato',
  '/termos',
  '/privacidade',
  '/interesse',
  '/entrar',
  '/cadastro',
  '/recuperar-senha',
  '/loja/pedido',
  '/validar/codigo-que-nao-existe'
];

for (const path of PAGES) {
  test(`página ${path} abre sem erro e sem rolagem lateral`, async ({ page }) => {
    const watcher = watch(page);

    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalScroll(page);
    expect(watcher.problems).toEqual([]);
  });
}

test('seletivas ficam em Eventos: o menu não tem Seletivas e /seletivas leva à agenda (DT-099)', async ({
  page
}) => {
  await page.goto('/seletivas');
  await expect(page).toHaveURL(/\/eventos#seletivas$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Seletivas' })
  ).toHaveCount(0);
});

test('"Quero jogar no Fênix" leva às seletivas abertas ou ao convite de Times (PEN-074)', async ({
  page
}) => {
  await page.goto('/');

  const join = page
    .locator('#hero-title ~ div')
    .getByRole('link', { name: 'Quero jogar no Fênix' });
  const href = await join.getAttribute('href');

  expect(['/eventos#seletivas', '/times#quero-jogar', '/interesse']).toContain(href);
  await join.click();

  if (href === '/eventos#seletivas') {
    await expect(page.locator('#seletivas')).toBeVisible();
  } else if (href === '/times#quero-jogar') {
    await expect(page.getByRole('heading', { name: 'Quer jogar com a gente?' })).toBeInViewport();
  } else {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Quero jogar no Fênix' })
    ).toBeVisible();
  }
});

test('detalhe de notícia, evento, produto, parceiro e tópico do fórum', async ({ page }) => {
  const watcher = watch(page);

  await page.goto('/noticias');
  await page.locator('a[href^="/noticias/"]').first().click();
  await expect(page.locator('h1')).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Evento abre para ler por inteiro, como a notícia.
  await page.goto('/eventos');
  await page.locator('h3 a[href^="/eventos/"]').first().click();
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByRole('link', { name: /Eventos/ }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto('/loja');
  await page
    .locator('a[href^="/loja/"]:not([href="/loja/carrinho"]):not([href="/loja/pedido"])')
    .first()
    .click();
  await expect(page.locator('h1')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto('/forum');
  await page.locator('a[href^="/forum/"]').first().click();
  await expect(page.locator('h1')).toBeVisible();
  await page.locator('a[href^="/forum/topicos/"]').first().click();
  await expect(page.locator('h1')).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(watcher.problems).toEqual([]);
});

test('carteirinha com código inválido aparece como inválida', async ({ page }) => {
  await page.goto('/validar/nao-e-carteirinha');
  await expect(page.getByRole('heading', { name: 'INVÁLIDA' })).toBeVisible();
});
