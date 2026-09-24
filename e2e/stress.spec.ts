import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/**
 * A08: maximum text lengths, long words and URLs, 12 colours and 6 images.
 * The project is built through the app's own modules, then exported in every
 * template. Layout is checked page by page in scripts/check-pdf.py (see README).
 */
test('stress project exports in all three templates', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.goto('/projects');
  const id = await page.evaluate(async () => {
    const { buildFormaDemo } = await import('/src/features/demo/formaDemo.ts' as string);
    const { createProject } = await import('/src/storage/projectRepository.ts' as string);
    const { project, assets } = await buildFormaDemo();
    const long = (n: number, seed: string) => (seed + ' ').repeat(Math.ceil(n / (seed.length + 1))).slice(0, n).trimEnd();
    const url = 'https://example.com/' + 'очень-длинный-путь-без-пробелов/'.repeat(4) + '?utm_source=brandfolio&utm_campaign=stress';
    const b = project.brand;
    project.title = long(80, 'Сверхдлинноеназваниепроекта');
    b.cover.title = long(80, 'Сверхдлинноеназваниебрендабезпробелов');
    b.cover.subtitle = long(180, 'Подзаголовок с обычными словами и одним Суперкалифрагилистикэкспиалидоцийным');
    b.about.description = long(4000, 'Абзац описания бренда с кириллицей и O‘zbekiston G‘ijduvon.');
    b.about.values = Array.from({ length: 12 }, (_, i) => long(300, `Ценность ${i + 1}`));
    b.colors = Array.from({ length: 12 }, (_, i) => ({ id: `c_s${i}`, name: long(60, `Оченьдлинноеимяцвета${i}`), role: i === 0 ? 'background' : i === 1 ? 'text' : 'custom', hex: ['#F3EFE7', '#242424', '#B65C3A', '#8C9A82'][i % 4]! }));
    b.logo.previewColorId = 'c_s2';
    for (const m of Object.values(b.mockups) as { colors: Record<string, string> }[]) m.colors = { backgroundColorId: 'c_s0', textColorId: 'c_s1', accentColorId: 'c_s2' };
    b.cover.backgroundColorId = null;
    const images = b.imagery.images;
    while (images.length < 6) images.push({ ...images[images.length % 3]!, id: `i_s${images.length}`, caption: long(200, 'Подпись изображения') });
    b.voice.rules = Array.from({ length: 12 }, () => long(300, 'Правило'));
    b.contacts.website = url;
    b.contacts.email = 'very.long.mailbox.name.for.testing@subdomain.example.com';
    b.mockups.socialPost.headline = long(160, 'Заголовокпостабезпробелов');
    const { projectSchema } = await import('/src/domain/schema.ts' as string);
    const check = projectSchema.safeParse(project);
    if (!check.success) throw new Error(JSON.stringify(check.error.issues.slice(0, 3)));
    await createProject(project, assets);
    return project.id as string;
  });

  await page.goto(`/editor/${id}`);
  for (const tpl of ['editorial', 'studio', 'contrast']) {
    await page.locator('header select').selectOption(tpl);
    await page.getByRole('button', { name: 'Экспорт' }).click();
    await expect(page.getByText(/Готово: \d+ стр/)).toBeVisible({ timeout: 90_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Скачать PDF' }).click()]);
    const path = info.outputPath(`stress-${tpl}.pdf`);
    await download.saveAs(path);
    const text = (await readFile(path)).subarray(0, 5).toString('latin1');
    expect(text).toBe('%PDF-');
    await page.keyboard.press('Escape');
  }
});
