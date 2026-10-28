import { expect, type Page, test } from '@playwright/test';

import {
  ADMIN,
  addToCart,
  adminMfaSecret,
  expectNoHorizontalScroll,
  signIn,
  watch
} from './helpers';

const shot = async (page: Page, name: string) => {
  if (process.env['SHOTS_DIR']) {
    await page.screenshot({ path: `${process.env['SHOTS_DIR']}/${name}.png`, fullPage: true });
  }
};

/**
 * Comprovante de entrega (DT-075): visitante compra com entrega e paga; a diretoria registra a
 * saída; o comprador vê o código; o motoboy, pelo link sem login, confirma com o código.
 */
test('entrega em casa do pedido ao código do motoboy', async ({ page, browser, request }, info) => {
  test.setTimeout(180_000);

  const watcher = watch(page);

  // 1. Visitante compra com entrega e paga pelo PIX em modo de teste.
  await addToCart(page, /Garrafa/);
  await page.goto('/loja/carrinho');
  await page.getByText('Receber em casa').click();
  await page.getByLabel(/^CEP/).fill('69900000');
  await page.getByLabel(/^Rua/).fill('Rua das Palmeiras');
  await page.getByLabel(/^Número/).fill('25');
  await page.getByLabel(/^Bairro/).selectOption({ label: 'Bosque' });
  await page.getByLabel(/Nome completo/).fill('Comprador Entrega E2E');
  await page.getByLabel(/^E-mail/).fill(`entrega-${info.project.name}@exemplo.test`);
  await page.getByLabel(/Celular/).fill('68999990002');
  await page.getByText(/Concordo com as/).click();
  await page.getByRole('button', { name: /confirmar pedido/i }).click();
  await expect(page.getByRole('heading', { name: 'Pedido realizado!' })).toBeVisible();

  const notice = page.locator('.alert', { hasText: 'Guarde o código de acesso' });
  const [guestCode, orderNumber] = await notice.locator('strong').allInnerTexts();

  await page.getByRole('button', { name: /gerar qr pix/i }).click();
  await page.getByRole('button', { name: /simular pagamento/i }).click();
  await expect(page.getByText('Pagamento confirmado. Obrigado!')).toBeVisible();

  // 2. Diretoria registra a saída com um motoboy digitado na hora.
  const admin = await browser.newPage();

  await signIn(admin, ADMIN.email, ADMIN.password, await adminMfaSecret(request));
  await admin.goto('/admin/pedidos');
  await admin.getByRole('link', { name: orderNumber as string }).click();
  await expect(admin.getByRole('heading', { name: /Entrega/ })).toBeVisible();
  await admin.getByLabel('Quem leva').selectOption({ label: 'Outro (digitar agora)' });
  await admin.getByLabel(/^Nome/).fill('Pedro Motoboy');
  await admin.getByLabel(/^Veículo/).fill('Moto preta');
  await admin.getByLabel(/^Placa/).fill('QWE4R56');
  await admin.getByRole('button', { name: /Registrar saída para entrega/ }).click();

  const linkBox = admin.locator('code', { hasText: '/entrega/' });

  await expect(linkBox).toBeVisible();
  await expectNoHorizontalScroll(admin);
  await shot(admin, `${info.project.name}-painel-saida`);

  const link = (await linkBox.innerText()).trim();

  // 3. Comprador consulta o pedido e vê o código e quem está levando.
  await page.goto('/loja/pedido');
  await page.getByLabel(/Número do pedido/).fill(orderNumber as string);
  await page.getByLabel(/Código de acesso/).fill(guestCode as string);
  await page.getByRole('button', { name: /consultar/i }).click();
  await expect(page.getByText('Seu pedido está a caminho')).toBeVisible();
  await expect(page.getByText(/Pedro · Moto preta · QWE4R56/)).toBeVisible();

  const code = (await page.locator('.delivery-code-value').innerText()).trim();

  expect(code).toMatch(/^\d{4}$/);
  await shot(page, `${info.project.name}-comprador-codigo`);

  // 4. Motoboy abre o link sem login e confirma com o código.
  const courier = await browser.newPage();

  await courier.goto(new URL(link).pathname);
  await expect(courier.getByText('Rua das Palmeiras, 25')).toBeVisible();
  await expectNoHorizontalScroll(courier);
  await shot(courier, `${info.project.name}-motoboy`);
  await courier.getByLabel(/^Código/).fill(code);
  await courier.getByRole('button', { name: 'Confirmar entrega' }).click();
  await expect(courier.getByText('A entrega foi registrada')).toBeVisible();

  // 5. No painel, a entrega aparece comprovada pelo código.
  await admin.reload();
  await expect(admin.getByText('Prova: Código do comprador')).toBeVisible();
  expect(watcher.problems).toEqual([]);
});
