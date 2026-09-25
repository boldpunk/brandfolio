import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const saved = (page: Page) => page.getByText('Сохранено', { exact: true }).first();

test('create, edit, reload and export a PDF', async ({ page }) => {
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Создать брендбук' }).first().click();
  await page.getByLabel('Название бренда').fill('Тест Бренд');
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.waitForURL(/\/editor\//);

  await page.getByRole('button', { name: 'Обложка' }).first().click();
  const subtitle = page.getByLabel('Подзаголовок');
  await subtitle.fill('Проверка автосохранения');
  await page.waitForTimeout(1200);
  await expect(saved(page)).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Обложка' }).first().click();
  await expect(page.getByLabel('Подзаголовок')).toHaveValue('Проверка автосохранения');

  await page.getByRole('button', { name: 'Экспорт' }).click();
  await expect(page.getByText(/Готово: \d+ стр/)).toBeVisible({ timeout: 45_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Скачать PDF' }).click()]);
  expect(download.suggestedFilename()).toBe('Test-Brend-brandbook.pdf');
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
});

test('archive round-trip into a clean browser profile', async ({ page, browser }) => {
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Открыть пример' }).click();
  await page.waitForURL(/\/editor\//, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Экспорт' }).click();
  // Headless Chromium has no PDF viewer, so the preview iframe can emit its own PDF download; wait for the archive.
  const [download] = await Promise.all([
    page.waitForEvent('download', (d) => d.suggestedFilename().endsWith('.brandfolio.zip')),
    page.getByRole('button', { name: 'Скачать архив' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.brandfolio\.zip$/);
  const archive = (await download.path())!;

  const clean = await browser.newContext({ locale: 'ru-RU' });
  const other = await clean.newPage();
  await other.goto('/projects');
  await expect(other.getByText('Пока нет ни одного проекта')).toBeVisible();
  await other.locator('input[type="file"][accept*="zip"]').setInputFiles(archive);
  await expect(other.getByRole('heading', { name: /FORMA/ })).toBeVisible({ timeout: 15_000 });
  await other.getByRole('link', { name: /FORMA/ }).first().click();
  await other.waitForURL(/\/editor\//);
  await other.getByRole('button', { name: 'Логотип' }).first().click();
  // Imported logos are real assets, not broken references.
  const logo = other.getByRole('region', { name: 'Документ' }).getByRole('img', { name: 'Основной' });
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(other.getByText(/Файл не найден|отсутствует/)).toHaveCount(0);
  await clean.close();
});
