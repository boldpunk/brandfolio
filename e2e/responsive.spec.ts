import { expect, test, type Page } from '@playwright/test';

const WIDTHS = [360, 390, 768, 1024, 1440];

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('no horizontal page scroll at the reference widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Открыть пример' }).click();
  await page.waitForURL(/\/editor\//, { timeout: 30_000 });
  const editorUrl = page.url();
  const previewUrl = editorUrl.replace('/editor/', '/preview/');
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
    for (const url of ['/', '/projects', '/settings', editorUrl, previewUrl]) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await noHorizontalScroll(page);
    }
  }
});

test.describe('phone, keyboard only', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('create a project and edit it with the keyboard', async ({ page }) => {
    await page.goto('/projects');
    const create = page.getByRole('button', { name: 'Создать брендбук' }).first();
    await create.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Название бренда')).toBeFocused();
    await page.keyboard.type('Мобильный');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/editor\//);

    const tabs = page.getByRole('tablist', { name: 'Панели редактора' });
    await expect(tabs).toBeVisible();
    await tabs.getByRole('tab', { name: 'Разделы' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Обложка' }).first().focus();
    await page.keyboard.press('Enter');
    await expect(tabs.getByRole('tab', { name: 'Редактор' })).toHaveAttribute('aria-selected', 'true');

    await page.getByLabel('Подзаголовок').focus();
    await page.keyboard.type('Набрано с клавиатуры');
    await tabs.getByRole('tab', { name: 'Просмотр' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tabpanel').getByText('Набрано с клавиатуры')).toBeVisible();

    // Undo from the keyboard outside of text fields.
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('tabpanel').getByText('Набрано с клавиатуры')).toHaveCount(0);
  });
});
