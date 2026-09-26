import { expect, test } from '@playwright/test';

test('the interface language is switched in the header and remembered', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Правила бренда в одном документе');

  await page.getByLabel('Язык интерфейса').selectOption('uz');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Brend qoidalari bitta hujjatda');
  await expect(page.locator('html')).toHaveAttribute('lang', 'uz-Latn');
  await expect(page.getByRole('link', { name: 'Loyihalar' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Brend qoidalari bitta hujjatda');
  await page.getByLabel('Interfeys tili').selectOption('ru');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Правила бренда в одном документе');
});

test('a first visit follows the browser language', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your brand rules in one document');
  await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible();
  await context.close();
});
