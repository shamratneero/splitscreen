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
    await guest.route('**/fonts.googleapis.com/**', route => route.abort());
    await guest.goto('http://127.0.0.1:3002/s/00000000-0000-4000-8000-000000000002');
    await expect(guest.locator('.bottom-bar')).toHaveCSS('position', 'fixed');
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


test('invalid guest links show a styled recovery message', async ({ page }) => {
  await page.goto('http://127.0.0.1:3002/s/demo-sultans-dine');
  await expect(page.getByRole('heading', { name: 'This link isn’t active' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(248, 249, 247)');
});

test('receipt photo is read locally and must be reviewed before sharing', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const uploads: string[] = [];
  const errors: string[] = [];
  captureErrors(page, errors);
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('/api/scan-receipt')) uploads.push(request.url());
  });
  await page.route('**/*', route => {
    const hostname = new URL(route.request().url()).hostname;
    return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort();
  });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('host@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Scan receipt', exact: true })).toBeVisible();
  const receipt = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1100; canvas.height = 750;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff'; context.fillRect(0, 0, 1100, 750);
    context.fillStyle = '#000'; context.font = '36px monospace';
    ['TEST KITCHEN', '', 'Item          Qty   Rate   Amount', 'Biryani       2     100    200', '', 'Subtotal                  200', 'VAT                       20', 'Grand Total               220'].forEach((line, i) => context.fillText(line, 60, 80 + i * 70));
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await page.getByRole('button', { name: 'Scan receipt', exact: true }).click();
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose from library' }).click();
  await (await picker).setFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from(receipt, 'base64') });
  await expect(page.getByText('Review the scan', { exact: true })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByLabel('Restaurant name')).toHaveValue('TEST KITCHEN');
  await expect(page.getByLabel('Item 1 unit price')).toHaveValue('100');
  await expect(page.getByLabel('Receipt total')).toHaveValue('220');
  await expect(page.getByRole('button', { name: 'Create split', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'I checked the scan against my receipt' }).click();
  await expect(page.getByRole('button', { name: 'Create split', exact: true })).toBeEnabled();
  expect(uploads).toEqual([]);
  // The bundled Tesseract 4 language data contains two retired engine settings.
  // Tesseract 5 reports these harmless compatibility notices on stderr.
  const knownModelNotices = new Set([
    'Warning: Parameter not found: segsearch_max_futile_classifications',
    'Warning: Parameter not found: classify_misfit_junk_penalty',
  ]);
  expect(errors.filter(error => !knownModelNotices.has(error))).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('receipt-ocr-review.png'), fullPage: true });
});
