import { randomUUID } from 'node:crypto';

import { expect, type Page, test } from '@playwright/test';

import { ADMIN, adminMfaSecret, settled, signIn, sql, watch } from './helpers';

/**
 * Tempo real de ponta a ponta (DT-116): a mudança é gravada direto no banco, como fariam uma
 * tarefa automática, um webhook ou outra pessoa em outro aparelho, e a tela aberta mostra o
 * novo sem a pessoa recarregar. A marca na janela prova que a página não foi recarregada.
 */
async function markNoReload(page: Page): Promise<void> {
  await page.evaluate(() => Object.assign(window, { fenixSemRecarga: true }));
}

async function expectNoReload(page: Page): Promise<void> {
  expect(await page.evaluate(() => 'fenixSemRecarga' in window)).toBe(true);
}

test('visitante vê o produto mudar sem recarregar a página', async ({ page }) => {
  const slug = 'kit-completo-pior-caso-demo';
  const [product] = await sql('SELECT name FROM products WHERE slug = $1', [slug]);
  const original = String(product?.['name'] ?? '');
  const watcher = watch(page);

  expect(original).not.toBe('');
  await page.goto(`/loja/${slug}`);
  await expect(page.locator('h1').first()).toBeVisible();
  await markNoReload(page);

  try {
    await sql('UPDATE products SET name = $2, updated_at = now() WHERE slug = $1', [
      slug,
      // O produto do pior caso já usa os 160 caracteres do nome.
      `${original.slice(0, 140)} · ao vivo`
    ]);
    await expect(page.locator('h1').first()).toContainText('· ao vivo', { timeout: 15_000 });
    await expectNoReload(page);
  } finally {
    await sql('UPDATE products SET name = $2, updated_at = now() WHERE slug = $1', [
      slug,
      original
    ]);
  }

  expect(watcher.problems).toEqual([]);
});

test('equipe vê o cadastro novo no Caixa sem recarregar; as abas dividem uma conexão', async ({
  page,
  context,
  request
}) => {
  test.setTimeout(120_000);

  const secret = await adminMfaSecret(request);
  const watcher = watch(page);

  await signIn(page, ADMIN.email, ADMIN.password, secret);
  await page.goto('/admin/caixa/cadastros');
  await expect(page.locator('h1').first()).toBeVisible();
  await settled(page);

  // Segunda aba do mesmo navegador: recebe os avisos pela aba que já está conectada.
  const second = await context.newPage();
  let secondStreams = 0;

  second.on('request', (req) => {
    if (req.url().includes('/api/v1/me/events')) {
      secondStreams += 1;
    }
  });
  await second.goto('/admin/caixa/cadastros');
  await expect(second.locator('h1').first()).toBeVisible();
  await settled(second);
  await markNoReload(page);
  await markNoReload(second);

  const name = `Centro ao vivo ${randomUUID().slice(0, 6)}`;

  await sql(
    `INSERT INTO cost_centers (id, code, name, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, now(), now())`,
    [`ao-vivo-${randomUUID().slice(0, 8)}`, name]
  );

  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
  await expect(second.getByText(name)).toBeVisible({ timeout: 15_000 });
  await expectNoReload(page);
  await expectNoReload(second);
  expect(secondStreams).toBe(0);

  // Fechada a aba que mantinha a conexão, a outra assume.
  await page.close();
  await expect.poll(() => secondStreams, { timeout: 15_000 }).toBeGreaterThan(0);
  expect(watcher.problems).toEqual([]);
});

test('fórum avisa "Há novidades" sem trocar a lista durante a leitura', async ({ page }) => {
  const watcher = watch(page);
  const title = `Tópico ao vivo ${randomUUID().slice(0, 6)}`;

  await page.goto('/forum/conversa-geral-demo');
  await expect(page.locator('h1').first()).toBeVisible();
  await settled(page);
  await markNoReload(page);

  await sql(
    `INSERT INTO forum_topics (id, category_id, title, visibility, status, updated_at)
     SELECT gen_random_uuid(), c.id, $1, 'PUBLIC', 'PUBLISHED', now()
     FROM forum_categories c WHERE c.slug = 'conversa-geral-demo'`,
    [title]
  );

  const banner = page.getByRole('status').filter({ hasText: 'Há tópicos novos ou respondidos.' });

  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(title)).toHaveCount(0);
  await banner.getByRole('button', { name: 'Atualizar' }).click();
  await expect(page.getByText(title)).toBeVisible();
  await expect(banner).toHaveCount(0);
  await expectNoReload(page);
  expect(watcher.problems).toEqual([]);
});
