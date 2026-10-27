import { expect, test } from '@playwright/test';

import { expectNoHorizontalScroll, watch } from './helpers';

/** Compra de visitante até o PIX automático (modo de teste) confirmar sozinho (DT-071). */
test('visitante compra e paga com PIX automático', async ({ page }) => {
  const watcher = watch(page);

  await page.goto('/loja');
  await page
    .getByRole('link', { name: /Garrafa/ })
    .first()
    .click();
  await page.getByRole('button', { name: /adicionar ao carrinho/i }).click();
  await expect(page.getByText('Adicionado ao carrinho')).toBeVisible();

  await page.goto('/loja/carrinho');
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await expectNoHorizontalScroll(page);
  await page.getByLabel(/Nome completo/).fill('Visitante de Teste E2E');
  await page.getByLabel(/^E-mail/).fill('visitante-e2e@exemplo.test');
  await page.getByLabel(/Celular/).fill('68999990000');

  for (const box of await page.locator('form.card input[type=checkbox]').all()) {
    await box.check();
  }

  await page.getByRole('button', { name: /confirmar pedido/i }).click();
  await expect(page.getByRole('heading', { name: 'Pedido realizado!' })).toBeVisible();
  await expect(page.getByText(/código de acesso/i)).toBeVisible();

  await page.getByRole('button', { name: /gerar qr pix/i }).click();
  await expect(page.getByText('PIX copia e cola')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: /simular pagamento/i }).click();
  await expect(page.getByText('Pagamento confirmado. Obrigado!')).toBeVisible();
  expect(watcher.problems).toEqual([]);
});

test('carrinho mostra os direitos de quem compra', async ({ page }) => {
  await page.goto('/loja');
  await page
    .getByRole('link', { name: /Garrafa/ })
    .first()
    .click();
  await page.getByRole('button', { name: /adicionar ao carrinho/i }).click();
  await expect(page.getByText('Adicionado ao carrinho')).toBeVisible();
  await page.goto('/loja/carrinho');
  await expect(page.getByText(/desistir em até 7 dias/)).toBeVisible();
});
