import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { expectNoHorizontalScroll, settled, watch } from './helpers';

/** Cadastro e área da conta: carteirinhas, notificações e pedidos (sem rolagem lateral). */
test('cadastro, carteirinhas vazias e avisos de conteúdo nas preferências', async ({ page }) => {
  const watcher = watch(page);
  const email = `e2e-${randomUUID().slice(0, 8)}@exemplo.test`;
  const password = 'Senha-Conta-E2E-2026!';

  await page.goto('/cadastro');
  await page.getByLabel(/Nome completo/).fill('Pessoa de Teste E2E');
  await page.getByLabel(/^E-mail/).fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByLabel(/Confirme a senha/).fill(password);

  for (const box of await page.locator('form input[type=checkbox]').all()) {
    await box.check();
  }

  await page.getByRole('button', { name: /criar conta|cadastrar/i }).click();
  await page.waitForURL('**/minha-conta');
  await expectNoHorizontalScroll(page);

  for (const path of [
    '/minha-conta/carteirinhas',
    '/minha-conta/notificacoes',
    '/minha-conta/pedidos',
    '/minha-conta/inscricoes',
    '/minha-conta/favoritos',
    '/minha-conta/seguranca',
    '/minha-conta/privacidade'
  ]) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await settled(page);
    await expectNoHorizontalScroll(page);
  }

  await page.goto('/minha-conta/carteirinhas');
  await expect(page.getByText(/ainda não tem carteirinha/)).toBeVisible();

  await page.goto('/minha-conta/notificacoes');
  await page.getByText('Como receber os avisos').click();
  await expect(page.getByText('Notícias do clube').first()).toBeVisible();
  await expect(page.getByText('Novos tópicos no fórum').first()).toBeVisible();
  expect(watcher.problems).toEqual([]);
});
