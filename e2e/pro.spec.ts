import { expect, test } from '@playwright/test';

// Pro features are visible on every plan; without Pro (here: no API at all)
// the export explains the watermark and the media kit stays locked.
test('premium template, brand font and media kit on the free plan', async ({ page }) => {
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Открыть пример' }).click();
  await page.waitForURL(/\/editor\//, { timeout: 30_000 });

  await page.getByRole('button', { name: 'Типографика' }).first().click();
  await page.locator('input[type=file][accept*=".ttf"]').first().setInputFiles('public/fonts/Manrope-700.ttf');
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Manrope');
  await page.getByRole('button', { name: 'Заголовки' }).click();

  await page.getByRole('button', { name: 'Документ' }).first().click();
  await page.getByRole('radio', { name: /Noir/ }).check();

  await page.getByRole('button', { name: 'Экспорт' }).click();
  await expect(page.getByText(/есть функции Pro: шрифты бренда, шаблон Noir|есть функции Pro: шаблон Noir, шрифты бренда/)).toBeVisible();
  await expect(page.getByText(/Готово: \d+ стр/)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('button', { name: 'Открыть Pro' })).toBeVisible({ timeout: 30_000 });
});

test('pricing page shows both plans', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
  await expect(page.getByText(/^690\s000$/)).toBeVisible();
  await page.getByRole('radio', { name: 'Помесячно' }).click();
  await expect(page.getByText(/^79\s000$/)).toBeVisible();
});
