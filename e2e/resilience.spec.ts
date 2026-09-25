import { expect, test, type Page } from '@playwright/test';

async function newProject(page: Page, title: string) {
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Создать брендбук' }).first().click();
  await page.getByLabel('Название бренда').fill(title);
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.waitForURL(/\/editor\//);
  await page.getByRole('button', { name: 'Обложка' }).first().click();
}

test('a save from another tab is detected, not overwritten', async ({ page, context }) => {
  await newProject(page, 'Две вкладки');
  const other = await context.newPage();
  await other.goto(page.url());
  await other.getByRole('button', { name: 'Обложка' }).first().click();

  await page.getByLabel('Подзаголовок').fill('Из первой вкладки');
  await expect(page.getByText('Сохранено', { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(1200);

  await other.getByLabel('Подзаголовок').fill('Из второй вкладки');
  await expect(other.getByRole('dialog', { name: 'Проект изменён в другой вкладке' })).toBeVisible({ timeout: 10_000 });

  await other.getByRole('button', { name: 'Сохранить мою версию как копию' }).click();
  await other.goto('/projects');
  await expect(other.getByRole('heading', { name: 'Две вкладки', exact: true })).toBeVisible();
  await expect(other.getByRole('heading', { name: /Две вкладки \(копия/ })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Обложка' }).first().click();
  await expect(page.getByLabel('Подзаголовок')).toHaveValue('Из первой вкладки');
});

test('a failed write is reported and can be retried', async ({ page }) => {
  await newProject(page, 'Ошибка записи');
  await page.evaluate(() => {
    const w = window as unknown as { __put: unknown };
    const proto = IDBObjectStore.prototype;
    w.__put = proto.put;
    proto.put = function () {
      throw new DOMException('Simulated full disk', 'QuotaExceededError');
    };
  });
  await page.getByLabel('Подзаголовок').fill('Не сохранится сразу');
  await expect(page.getByText('Не удалось сохранить').first()).toBeVisible({ timeout: 10_000 });

  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (window as unknown as { __put: typeof IDBObjectStore.prototype.put }).__put;
  });
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByText('Сохранено', { exact: true }).first()).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Обложка' }).first().click();
  await expect(page.getByLabel('Подзаголовок')).toHaveValue('Не сохранится сразу');
});
