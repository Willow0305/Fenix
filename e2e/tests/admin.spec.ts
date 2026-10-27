import { expect, test } from '@playwright/test';

import { ADMIN, adminMfaSecret, expectNoHorizontalScroll, settled, signIn, watch } from './helpers';

/**
 * Painel (R-10, caça a bugs): entra com segunda etapa e visita todas as telas do menu, em
 * celular e computador — título visível, sem rolagem lateral, sem erro de JavaScript ou 5xx.
 */
test('administração: todas as telas do menu abrem sem erro', async ({ page, request }, info) => {
  test.setTimeout(240_000);

  const secret = await adminMfaSecret(request);
  const watcher = watch(page);

  await signIn(page, ADMIN.email, ADMIN.password, secret);
  await page.goto('/admin');
  await expect(page.locator('h1').first()).toBeVisible();

  const links = await page
    .locator('aside nav a[href^="/admin"]')
    .evaluateAll((anchors) => [...new Set(anchors.map((a) => a.getAttribute('href') ?? ''))]);

  expect(links.length).toBeGreaterThan(20);

  for (const href of links) {
    await test.step(`${info.project.name}: ${href}`, async () => {
      await page.goto(href);
      await expect(page.locator('h1').first(), href).toBeVisible();
      await settled(page);
      await expectNoHorizontalScroll(page);
    });
  }

  expect(watcher.problems).toEqual([]);
});

test('diretoria confere carteirinha inválida com detalhe', async ({ page, request }) => {
  const secret = await adminMfaSecret(request);

  await signIn(page, ADMIN.email, ADMIN.password, secret);
  await page.goto('/validar/c1.invalido');
  await expect(page.getByRole('heading', { name: 'INVÁLIDA' })).toBeVisible();
  await expect(page.getByText(/não é uma carteirinha do clube/)).toBeVisible();
});
