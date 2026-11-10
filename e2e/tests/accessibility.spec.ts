import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoHorizontalScroll } from './helpers';

/**
 * Acessibilidade das páginas de vitrine, venda e conteúdo (Onda 7): regras WCAG 2.2 A e AA do
 * axe, reflow em 320 px (equivale a 400% de zoom em 1280 px), nada se mexendo sozinho com
 * "reduzir movimento" e foco visível em tudo que o teclado alcança.
 */
const PAGES = [
  '/',
  '/sobre',
  '/times',
  '/noticias',
  '/noticias/palavras-gigantes-teste-visual-demo',
  '/eventos',
  '/eventos/final-copa-acreana-demo',
  '/loja',
  '/loja/kit-completo-pior-caso-demo',
  '/loja/carrinho',
  '/afiliacao',
  '/forum',
  '/forum/conversa-geral-demo',
  '/parceiros',
  '/entrar'
];

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const path of PAGES) {
  test(`acessibilidade de ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    // Rola até o fim como quem lê: a frase da afiliação só ganha a cor cheia ao entrar na tela.
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();

    expect(
      violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.target.join(' ')}`)
    ).toEqual([]);
  });
}

test.describe('320 px e movimento reduzido', () => {
  test.use({ viewport: { width: 320, height: 720 }, reducedMotion: 'reduce' });
  test.skip(({ isMobile }) => !isMobile, 'Basta rodar no projeto de celular.');

  for (const path of PAGES) {
    test(`${path} cabe em 320 px e não se mexe sozinha`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalScroll(page);

      const running = await page.evaluate(
        () =>
          document.getAnimations().filter((animation) => animation.playState === 'running').length
      );

      expect(running, 'nenhuma animação rodando com "reduzir movimento"').toBe(0);
    });
  }
});

test('foco visível em cada parada do teclado no início e na loja', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Teclado: projeto de computador.');
  for (const path of ['/', '/loja']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    for (let stop = 0; stop < 30; stop += 1) {
      await page.keyboard.press('Tab');

      const focus = await page.evaluate(() => {
        const element = document.activeElement;

        if (!element || element === document.body) {
          return null;
        }

        const style = getComputedStyle(element);

        return {
          name: `${element.tagName.toLowerCase()} ${(element.textContent ?? '').trim().slice(0, 40)}`,
          visible:
            (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
            style.boxShadow !== 'none'
        };
      });

      if (focus) {
        expect(focus.visible, `foco visível em ${path}: ${focus.name}`).toBe(true);
      }
    }
  }
});
