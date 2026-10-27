import { expect, test } from '@playwright/test';

import { ADMIN, adminMfaSecret, expectNoHorizontalScroll, settled, signIn, watch } from './helpers';

/** Aba Afiliação (DT-072): abas abrem, endereço antigo redireciona e plano nasce pelo formulário. */
test('aba Afiliação: abas, endereço antigo e novo plano', async ({ page, request }, info) => {
  test.setTimeout(120_000);

  const secret = await adminMfaSecret(request);
  const watcher = watch(page);

  await signIn(page, ADMIN.email, ADMIN.password, secret);

  for (const path of [
    '/admin/afiliacao',
    '/admin/afiliacao/planos',
    '/admin/afiliacao/beneficios',
    '/admin/afiliacao/carteirinhas',
    '/admin/afiliacao/visual'
  ]) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Afiliação' })).toBeVisible();
    await settled(page);
    await expectNoHorizontalScroll(page);
  }

  await page.goto('/admin/carteirinhas');
  await page.waitForURL('**/admin/afiliacao/carteirinhas');

  await page.goto('/admin/afiliacao/planos?novo=1');
  await page.getByLabel(/^Nome/).fill(`Afiliação E2E ${info.project.name}`);
  await page.getByLabel(/^Preço/).fill('120,00');
  await page.getByRole('button', { name: 'Criar plano' }).click();
  await expect(page.getByRole('heading', { name: 'Dados do plano' })).toBeVisible();
  await page.getByRole('button', { name: 'Publicar na loja' }).click();
  await expect(page.getByText('Plano à venda na loja.')).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(watcher.problems).toEqual([]);
});
