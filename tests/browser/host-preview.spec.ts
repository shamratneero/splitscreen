import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// This HTTP fixture does not implement Supabase Realtime. Reject channel joins
// through the protocol so the app exercises its polling fallback, without a
// network-level WebSocket error obscuring actual UI errors.
async function usePollingFixture(context: BrowserContext) {
  await context.routeWebSocket('ws://127.0.0.1:54329/realtime/v1/websocket*', socket => {
    socket.onMessage(raw => {
      const message = JSON.parse(String(raw));
      if (!['phx_join', 'phx_leave', 'heartbeat'].includes(message.event)) return;
      socket.send(JSON.stringify({ ...message, event: 'phx_reply', payload: {
        status: message.event === 'phx_join' ? 'error' : 'ok',
        response: message.event === 'phx_join' ? { reason: 'Fixture uses polling' } : {},
      } }));
    });
  });
}

test.beforeEach(async ({ context }) => {
  await usePollingFixture(context);
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
  await expect(page.getByRole('heading', { name: /Split bills,\s+not friendships\./ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Split bills,\s+not friendships\./ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('host-home.png'), fullPage: true });
  await page.getByRole('button', { name: 'Enter manually', exact: true }).click();
  await page.getByLabel('Restaurant name').fill('Test Kitchen');
  await page.getByLabel('Item 1 name', { exact: true }).fill('Beef Biryani');
  await page.getByLabel('Item 1 quantity', { exact: true }).fill('2');
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
  await usePollingFixture(guestContext);
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
    await expect(guest.getByRole('heading', { name: 'Confirm your share' })).toBeFocused();
    await guest.screenshot({ path: testInfo.outputPath('guest-review.png'), fullPage: true });
    await guest.getByRole('button', { name: 'Edit items' }).click();
    await expect(guest.locator('.stepper output')).toHaveText('1');
    await guest.getByRole('button', { name: 'Continue', exact: true }).click();
    await guest.getByLabel('Your name').fill('Asha');
    await guest.getByRole('button', { name: 'Confirm ৳110' }).click();
    await expect(guest.getByText('01700000000', { exact: true })).toBeVisible();
    await guest.screenshot({ path: testInfo.outputPath('guest-pay.png'), fullPage: true });
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
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(239, 238, 232)');
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
  expect(errors.filter(error => !knownModelNotices.has(error) && !/^Estimating resolution as \d+$/.test(error))).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('receipt-ocr-review.png'), fullPage: true });
});

const fixtureBase = 'http://127.0.0.1:54329';
const publicToken = '00000000-0000-4000-8000-000000000002';

test('layouts fit narrow phones and desktops, and sharing supports keyboard recovery', async ({ page, request }, testInfo) => {
  await request.post(`${fixtureBase}/reset`);
  await request.post(`${fixtureBase}/rest/v1/splits`, { data: { restaurant_name: 'The Long Table · Dhanmondi', currency: 'BDT', status: 'OPEN', vat: 40, service_charge: 0, discount: 0, receipt_total: 440 } });
  await request.post(`${fixtureBase}/rest/v1/items`, { data: [{ name: 'Chicken biryani with extra seasonal vegetables', quantity: 4, unit_price: 100 }] });
  await request.post(`${fixtureBase}/rest/v1/rpc/set_claim`, { data: { p_token: publicToken, p_session_id: 'another-guest', p_item_id: 'item-0', p_quantity: 1 } });
  await request.post(`${fixtureBase}/rest/v1/rpc/confirm_guest_details`, { data: { p_token: publicToken, p_session_id: 'another-guest', p_display_name: 'Asha' } });
  const errors: string[] = [];
  captureErrors(page, errors);
  for (const [width, height, colorScheme] of [[320, 740, 'light'], [1440, 1000, 'light'], [390, 844, 'dark']] as const) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`sign-in-${width}-${colorScheme}.png`), fullPage: true });
    await page.goto(`http://127.0.0.1:3002/s/${publicToken}`);
    await expect(page.getByRole('button', { name: 'Add Chicken biryani with extra seasonal vegetables' })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`guest-${width}-${colorScheme}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Add Chicken biryani with extra seasonal vegetables' }).click();
  const share = page.getByRole('button', { name: 'Share', exact: true });
  await expect(share).toBeEnabled();
  await share.click();
  const dialog = page.getByRole('dialog', { name: 'Share Chicken biryani with extra seasonal vegetables' });
  await expect(dialog).toBeFocused();
  await expect(dialog.getByRole('checkbox', { name: /You/ })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /You/ })).toBeDisabled();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Share item' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('checkbox', { name: /Asha/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(share).toBeFocused();
  await share.click();
  await dialog.getByRole('checkbox', { name: /Asha/ }).check();
  // Delay the response to check that saving cannot be submitted twice.
  let finishSave: (() => void) | undefined;
  await page.route('**/rpc/set_shared_claim', async route => {
    await new Promise<void>(resolve => { finishSave = resolve; });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
  });
  await dialog.getByRole('button', { name: 'Share item' }).click();
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('sharing-dark.png'), fullPage: true });
  await expect.poll(() => Boolean(finishSave)).toBe(true);
  finishSave!();
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('copying a payment amount uses the displayed currency units', async ({ page, context, request }) => {
  await request.post(`${fixtureBase}/reset`);
  await request.post(`${fixtureBase}/rest/v1/splits`, { data: { restaurant_name: 'Test Kitchen', currency: 'SGD', status: 'OPEN', vat: 0, service_charge: 0, discount: 0, receipt_total: 12345 } });
  await request.post(`${fixtureBase}/rest/v1/items`, { data: [{ name: 'Dinner', quantity: 1, unit_price: 12345 }] });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`http://127.0.0.1:3002/s/${publicToken}`);
  await page.getByRole('button', { name: 'Add Dinner' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Your name').fill('Asha');
  await page.getByLabel('Your name').press('Enter');
  await expect(page.locator('.pay-amount')).toHaveText('S$123.45');
  await page.getByRole('button', { name: 'Copy amount' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('123.45');
});
