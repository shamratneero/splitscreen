import { expect, test } from '@playwright/test';

test('host renders and opens manual entry without React runtime errors', async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/');
  try {
    await expect(page.getByText('Split bills, not friendships.', { exact: true })).toBeVisible({ timeout: 60_000 });
  } catch (error) {
    if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
    throw error;
  }
  await page.screenshot({ path: testInfo.outputPath('host-home.png'), fullPage: true });
  await page.getByText('Enter manually', { exact: true }).click();
  await expect(page.getByText('Enter the bill', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Restaurant name')).toHaveValue("Sultan's Dine");
  await page.getByPlaceholder('Item name').fill('Beef Biryani');
  await expect(page.getByPlaceholder('Item name')).toHaveValue('Beef Biryani');
  await page.screenshot({ path: testInfo.outputPath('host-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Share with your friends', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('host-share.png'), fullPage: true });
  expect(runtimeErrors).toEqual([]);
});
