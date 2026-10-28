import { expect, test } from '@playwright/test';

import { addToCart, expectNoHorizontalScroll, watch } from './helpers';

/** Compra de visitante até o PIX automático (modo de teste) confirmar sozinho (DT-071). */
test('visitante compra e paga com PIX automático', async ({ page }) => {
  const watcher = watch(page);

  await addToCart(page, /Garrafa/);

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
  await addToCart(page, /Garrafa/);
  await page.goto('/loja/carrinho');
  await expect(page.getByText(/desistir em até 7 dias/)).toBeVisible();
});

/** Entrega em casa (DT-075): bairro da lista, taxa no total e endereço no pedido. */
test('visitante escolhe receber em casa e vê a taxa no total', async ({ page }, info) => {
  const watcher = watch(page);

  await addToCart(page, /Garrafa/);
  await page.goto('/loja/carrinho');

  await page.getByText('Receber em casa').click();
  await page.getByLabel(/^CEP/).fill('69900000');
  await page.getByLabel(/^Rua/).fill('Rua das Flores');
  await page.getByLabel(/^Número/).fill('10');
  await page.getByLabel(/^Bairro/).selectOption({ label: 'Centro' });
  await expect(page.locator('.cart-totals')).toContainText('Entrega');
  await expect(page.locator('.cart-totals')).toContainText('8,00');
  await expectNoHorizontalScroll(page);

  await page.getByLabel(/Nome completo/).fill('Visitante Entrega E2E');
  await page.getByLabel(/^E-mail/).fill('entrega-e2e@exemplo.test');
  await page.getByLabel(/Celular/).fill('68999990001');
  await page.getByText(/Concordo com as/).click();

  if (process.env['SHOTS_DIR']) {
    await page.screenshot({
      path: `${process.env['SHOTS_DIR']}/${info.project.name}-checkout-entrega.png`,
      fullPage: true
    });
  }

  await page.getByRole('button', { name: /confirmar pedido/i }).click();
  await expect(page.getByRole('heading', { name: 'Pedido realizado!' })).toBeVisible();
  await expect(page.getByText(/Entrega em casa:/)).toBeVisible();
  await expect(page.getByText('Rua das Flores, 10')).toBeVisible();
  expect(watcher.problems).toEqual([]);
});

/** Cartão com a diretoria e cancelamento pelo comprador antes de pagar (DT-076). */
test('visitante escolhe cartão e cancela o pedido', async ({ page }, info) => {
  const watcher = watch(page);

  await addToCart(page, /Garrafa/);
  await page.goto('/loja/carrinho');
  await page.getByText('Cartão', { exact: true }).click();
  await page.getByLabel(/Nome completo/).fill('Visitante Cartão E2E');
  await page.getByLabel(/^E-mail/).fill(`cartao-${info.project.name}@exemplo.test`);
  await page.getByLabel(/Celular/).fill('68999990003');
  await page.getByText(/Concordo com as/).click();
  await page.getByRole('button', { name: /confirmar pedido/i }).click();
  await expect(page.getByText(/Pagamento com cartão\./)).toBeVisible();
  await expect(page.getByRole('button', { name: /gerar qr pix/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Cancelar pedido' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar pedido' }).click();
  await expect(page.getByText('Cancelado').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(watcher.problems).toEqual([]);
});
