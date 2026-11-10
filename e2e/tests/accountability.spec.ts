import { expect, test } from '@playwright/test';

import { ADMIN, adminMfaSecret, expectNoHorizontalScroll, settled, signIn, watch } from './helpers';

/** Prestação de contas (DT-103): prévia, emissão congelada, PDF e conferência pelo código. */
test('diretoria emite a prestação de contas e baixa o PDF', async ({ page, request }, info) => {
  test.setTimeout(120_000);

  const watcher = watch(page);

  await signIn(page, ADMIN.email, ADMIN.password, await adminMfaSecret(request));
  await page.goto('/admin/caixa/prestacao-de-contas');
  await settled(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Prestação de contas' })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByRole('button', { name: 'Este ano' }).click();
  await page.getByRole('button', { name: 'Ver prévia' }).click();
  await expect(page.getByRole('heading', { name: 'Resumo' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Saídas' })).toBeVisible();
  await expectNoHorizontalScroll(page);

  if (process.env['SHOTS_DIR']) {
    await page.screenshot({
      path: `${process.env['SHOTS_DIR']}/${info.project.name}-previa.png`,
      fullPage: true
    });
  }

  await page.getByRole('button', { name: 'Emitir prestação de contas' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Emitir' }).click();

  const notice = page.getByText(/^Prestação de contas PC-\d{4}-\d{3}.* emitida\./);

  await expect(notice).toBeVisible();

  const code = (await page.locator('.alert strong').first().innerText()).trim();

  expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

  const download = page.waitForEvent('download');

  await page.getByRole('button', { name: 'Baixar PDF' }).first().click();
  expect((await download).suggestedFilename()).toMatch(/^prestacao-de-contas-PC-\d{4}-\d{3}\.pdf$/);

  await page.getByLabel('Código de conferência').fill(code.toLowerCase());
  await page.getByRole('button', { name: 'Conferir' }).click();
  await expect(page.getByText(/É a versão em vigor\./)).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(watcher.problems).toEqual([]);
});
