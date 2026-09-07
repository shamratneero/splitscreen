import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/auth/v1/**', route => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') return route.abort();
    return route.continue();
  });
});

const captureErrors = (page: Page, errors: string[]) => {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
};

test('sign-in remains required and supports password visibility', async ({ page }, testInfo) => {
  await page.goto('/review');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('host@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveJSProperty('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await page.screenshot({ path: testInfo.outputPath('sign-in.png'), fullPage: true });
});

test('host signs in, creates a split, and confirms an anonymous guest payment', async ({ page, browser, request }, testInfo) => {
  const errors: string[] = [];
  captureErrors(page, errors);
  await request.post('http://127.0.0.1:54329/reset');
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('host@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  const loginRequest = page.waitForRequest(request => request.url().includes('/auth/v1/token'));
  await page.getByLabel('Password', { exact: true }).press('Enter');
  expect(new URL((await loginRequest).url()).origin).toBe('http://127.0.0.1:54329');
  await expect(page.getByText('Split bills, not friendships.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Split bills, not friendships.', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('host-home.png'), fullPage: true });
  await page.getByRole('button', { name: 'Enter manually', exact: true }).click();
  await page.getByLabel('Restaurant name').fill('Test Kitchen');
  await page.getByLabel('Item 1 name', { exact: true }).fill('Beef Biryani');
  await page.getByLabel('Item 1 unit price').fill('100');
  await page.getByLabel('VAT', { exact: true }).fill('20');
  await expect(page.getByRole('button', { name: 'Create split', exact: true })).toBeDisabled();
  await page.getByLabel('Receipt total').fill('220');
  await expect(page.getByText('Total matches receipt')).toBeVisible();
  await page.getByRole('heading', { name: 'Enter the bill' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('host-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Create split', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copy guest link' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Track claims', exact: true })).toBeVisible();

  const guestContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
  try {
    const guest = await guestContext.newPage();
    captureErrors(guest, errors);
    await guest.goto('http://127.0.0.1:3002/s/test-public-token');
    const claimResponse = guest.waitForResponse(response => response.url().includes('/rpc/set_claim'), { timeout: 10_000 });
    await guest.getByRole('button', { name: 'Add Beef Biryani', exact: true }).click();
    expect((await claimResponse).ok()).toBe(true);
    await expect(guest.locator('.quiet.error')).toHaveCount(0);
    expect(errors).toEqual([]);
    // Half the items means half the VAT, even though the other half is unclaimed.
    await expect(guest.locator('.bottom-bar strong')).toHaveText('৳110');
    await guest.screenshot({ path: testInfo.outputPath('guest-claim.png'), fullPage: true });
    await guest.getByRole('button', { name: 'Continue', exact: true }).click();
    await guest.getByRole('button', { name: 'Edit items' }).click();
    await expect(guest.locator('.stepper output')).toHaveText('1');
    await guest.getByRole('button', { name: 'Continue', exact: true }).click();
    await guest.getByLabel('Your name').fill('Asha');
    await guest.getByRole('button', { name: 'Confirm ৳110' }).click();
    await expect(guest.getByText('01700000000', { exact: true })).toBeVisible();
    await guest.getByRole('button', { name: 'I’ve sent it' }).click();
    await expect(guest.getByText('Payment reported', { exact: true })).toBeVisible();
    await guest.reload();
    await expect(guest.getByText('Payment reported', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Track claims', exact: true }).click();
    await expect(page.getByText('Asha', { exact: true })).toBeVisible();
    await expect(page.getByText('৳110', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mark Asha as paid' }).click();
    await expect(page.getByText('Paid', { exact: true })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'All settled' })).toBeVisible({ timeout: 12_000 });
    await page.screenshot({ path: testInfo.outputPath('host-tracking.png'), fullPage: true });
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto('/splits');
    await expect(page.getByText('Open', { exact: true })).toBeVisible();
    await expect(page.getByText('Settled', { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await guestContext.close();
  }
});
