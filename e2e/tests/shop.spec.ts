import { expect, test } from '@playwright/test';

import {
  ADMIN,
  addToCart,
  adminMfaSecret,
  confirmEmail,
  expectNoHorizontalScroll,
  signIn,
  watch
} from './helpers';

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
  await expect(page.getByRole('heading', { name: /^Pedido .+ realizado$/ })).toBeVisible();
  await expect(page.getByText(/código de acesso/i)).toBeVisible();

  await page.getByRole('button', { name: /gerar qr pix/i }).click();
  await expect(page.getByText('PIX copia e cola')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: /simular pagamento/i }).click();
  await expect(page.getByText('Pagamento confirmado. Obrigado!')).toBeVisible();

  // Link fixo (DT-096): abre o pedido sem digitar nada, e ele fica lembrado no aparelho.
  const orderNumber = (
    await page.getByRole('heading', { name: /^Pedido .+ realizado$/ }).innerText()
  )
    .replace(/^Pedido /, '')
    .replace(/ realizado$/, '');

  await page.getByRole('link', { name: 'Abrir meu pedido' }).click();
  await page.waitForURL('**/loja/pedido#pedido=*');
  await expect(page.getByText('Pago').first()).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Pedidos lembrados neste aparelho' }).getByText(orderNumber)
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(watcher.problems).toEqual([]);
});

test('carrinho mostra os direitos de quem compra', async ({ page }) => {
  await addToCart(page, /Garrafa/);
  await page.goto('/loja/carrinho');
  await expect(page.getByText(/desistir em até 7 dias/)).toBeVisible();
});

test('remover item leva o foco ao "Desfazer", que devolve o item', async ({ page }) => {
  await addToCart(page, /Garrafa/);
  await page.goto('/loja/carrinho');
  await expect(page.locator('.cart-line')).toHaveCount(1);

  await page.getByRole('button', { name: 'Remover' }).click();

  const undo = page.getByRole('button', { name: 'Desfazer' });

  await expect(undo).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.cart-line')).toHaveCount(1);
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
  await expect(page.getByRole('heading', { name: /^Pedido .+ realizado$/ })).toBeVisible();
  await expect(page.getByText(/Entrega em casa:/)).toBeVisible();
  await expect(page.getByText('Rua das Flores, 10')).toBeVisible();
  expect(watcher.problems).toEqual([]);
});

/** Cartão com a diretoria e cancelamento pelo comprador antes de pagar (DT-076). */
test('visitante escolhe cartão e cancela o pedido', async ({ page }, info) => {
  const watcher = watch(page);

  await addToCart(page, /Garrafa/);
  await page.goto('/loja/carrinho');
  await page.getByText('Cartão ou dinheiro', { exact: true }).click();
  await page.getByLabel(/Nome completo/).fill('Visitante Cartão E2E');
  await page.getByLabel(/^E-mail/).fill(`cartao-${info.project.name}@exemplo.test`);
  await page.getByLabel(/Celular/).fill('68999990003');
  await page.getByText(/Concordo com as/).click();
  await page.getByRole('button', { name: /confirmar pedido/i }).click();
  await expect(page.getByText(/Pagamento com cartão ou dinheiro\./)).toBeVisible();
  await expect(page.getByRole('link', { name: /Falar com a diretoria no WhatsApp/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /gerar qr pix/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Cancelar pedido' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar pedido' }).click();
  await expect(page.getByText('Cancelado').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(watcher.problems).toEqual([]);
});

/** Cartão pelo site só com conta de e-mail confirmado (DT-100): visitante vê o caminho. */
test('visitante não paga com cartão pelo site e vê como entrar', async ({ page }) => {
  const watcher = watch(page);

  await addToCart(page, /Garrafa/);
  await page.goto('/loja/carrinho');
  await expect(
    page.getByText(/Para pagar com cartão pelo site, é preciso ter conta/)
  ).toBeVisible();
  await expect(page.getByRole('radio', { name: /Cartão pelo site/ })).toHaveCount(0);
  await expect(
    page.locator('.choice-card.is-unavailable').getByRole('link', { name: 'Entre', exact: true })
  ).toHaveAttribute('href', '/entrar?next=/loja/carrinho');
  await expectNoHorizontalScroll(page);
  expect(watcher.problems).toEqual([]);
});

/** Cartão pelo site em modo de teste (DT-079): recusado mostra o motivo; aprovado em 3x baixa. */
test('conta confirmada paga com cartão pelo site', async ({ page, request }, info) => {
  const watcher = watch(page);

  await confirmEmail(ADMIN.email);
  await signIn(page, ADMIN.email, ADMIN.password, await adminMfaSecret(request));
  await addToCart(page, /Garrafa/, { signedIn: true });
  await page.goto('/loja/carrinho');
  await page.getByText('Cartão pelo site', { exact: true }).click();

  const phone = page.getByLabel(/Celular/);

  if (await phone.isEditable()) {
    await phone.fill('68999990004');
  }

  await page.getByText(/Concordo com as/).click();
  await page.getByRole('button', { name: /confirmar pedido/i }).click();
  await expect(page.getByRole('heading', { name: /Pagar com cartão/ })).toBeVisible();

  await page.getByRole('button', { name: 'Simular recusado' }).click();
  await expect(page.getByText('Limite insuficiente no cartão.')).toBeVisible();
  await page.getByLabel(/^Parcelas/).selectOption('3');
  await expectNoHorizontalScroll(page);

  if (process.env['SHOTS_DIR']) {
    await page.screenshot({
      path: `${process.env['SHOTS_DIR']}/${info.project.name}-cartao.png`,
      fullPage: true
    });
  }

  await page.getByRole('button', { name: 'Simular cartão aprovado' }).click();
  await expect(page.getByText('Pagamento confirmado. Obrigado!')).toBeVisible();
  expect(watcher.problems).toEqual([]);
});

/** Pré-vendas em carrossel (DT-090): a remessa troca com deslize e esmaecimento; o botão não. */
test('destaque da pré-venda alterna as remessas abertas', async ({ page }, info) => {
  const watcher = watch(page);
  const card = page.getByRole('region', { name: 'Pré-vendas abertas' });
  const shots = `${info.project.name}`;

  await page.goto('/loja');
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: /Mostrar remessa/ })).toHaveCount(2);
  await expect(card.locator('.campaign-slide:not([aria-hidden="true"]) h2')).toHaveText(
    'Uniformes temporada 2027'
  );
  await expectNoHorizontalScroll(page);

  await card.getByRole('button', { name: 'Próxima remessa' }).click();
  // Quadros da travessia, para conferência visual (pasta do teste em test-results).
  await page.waitForTimeout(250);
  await card.screenshot({ path: info.outputPath(`carrossel-${shots}-1.png`) });
  await page.waitForTimeout(200);
  await card.screenshot({ path: info.outputPath(`carrossel-${shots}-2.png`) });
  await expect(card.locator('.campaign-slide.is-leaving')).toHaveCount(0);
  await expect(card.locator('.campaign-slide:not([aria-hidden="true"]) h2')).toHaveText(
    'Agasalhos de viagem'
  );
  await card.screenshot({ path: info.outputPath(`carrossel-${shots}-3.png`) });
  await expect(card.getByRole('link', { name: 'Ver produtos da pré-venda' })).toHaveCount(1);

  await card.getByRole('button', { name: 'Remessa anterior' }).click();
  await page.waitForTimeout(300);
  await card.screenshot({ path: info.outputPath(`carrossel-${shots}-volta.png`) });
  await expect(card.locator('.campaign-slide:not([aria-hidden="true"]) h2')).toHaveText(
    'Uniformes temporada 2027'
  );
  expect(watcher.problems).toEqual([]);
});
