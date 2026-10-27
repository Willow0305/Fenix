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

  // Benefício de loja sem cadastro no site (DT-074).
  await page.goto('/admin/afiliacao/beneficios');
  await page.getByRole('button', { name: /Novo benefício/ }).click();
  await page.getByLabel(/^Nome do parceiro/).fill(`Ótica ${info.project.name}`);
  await page.getByLabel(/^Onde fica/).fill('Rua das Flores, 10');
  await page.getByLabel(/^Título/).fill('Desconto em armações');
  await page.getByLabel(/^Desconto/).fill('15');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Benefício criado.')).toBeVisible();
  await expect(page.getByText(`Ótica ${info.project.name}`)).toBeVisible();
  await expectNoHorizontalScroll(page);
  if (process.env['SHOTS_DIR']) {
    await page.goto('/admin/afiliacao');
    await expect(page.getByRole('heading', { name: 'Tipos de carteirinha' })).toBeVisible();
    await page.screenshot({
      path: `${process.env['SHOTS_DIR']}/${info.project.name}-visao.png`,
      fullPage: true
    });
    await page.goto('/admin/afiliacao/beneficios?publico=AFFILIATES');
    await page.screenshot({
      path: `${process.env['SHOTS_DIR']}/${info.project.name}-beneficios.png`,
      fullPage: true
    });
    await page.goto('/parceiros');
    await page.screenshot({
      path: `${process.env['SHOTS_DIR']}/${info.project.name}-parceiros.png`,
      fullPage: true
    });
  }
  expect(watcher.problems).toEqual([]);
});
