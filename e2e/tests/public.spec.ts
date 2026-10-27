import { expect, test } from '@playwright/test';

import { expectNoHorizontalScroll, watch } from './helpers';

/** Varredura das páginas públicas (R-10, caça a bugs): título, sem rolagem lateral, sem erro. */
const PAGES = [
  '/',
  '/sobre',
  '/times',
  '/noticias',
  '/eventos',
  '/seletivas',
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

test('detalhe de notícia, produto, parceiro e tópico do fórum', async ({ page }) => {
  const watcher = watch(page);

  await page.goto('/noticias');
  await page.locator('a[href^="/noticias/"]').first().click();
  await expect(page.locator('h1')).toBeVisible();
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
