import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('stage 1 PDF prototype downloads a valid multi-page PDF', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сгенерировать' }).click();
  await expect(page.getByTestId('pdf-status')).toHaveText(/Готово/, { timeout: 45_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('pdf-download').click()]);
  const bytes = await readFile(await download.path());
  const head = bytes.subarray(0, 5).toString('latin1');
  const tail = bytes.subarray(-8).toString('latin1');
  expect(head).toBe('%PDF-');
  expect(tail).toContain('%%EOF');
  // Two /Type /Page objects (not /Pages).
  expect(bytes.toString('latin1').match(/\/Type \/Page\b/g)?.length).toBeGreaterThanOrEqual(2);
});
