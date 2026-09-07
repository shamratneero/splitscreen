import { chromium } from '@playwright/test';

const URL = 'http://localhost:3000/s/22222222-2222-2222-2222-222222222222';
const shot = (n) => `/private/tmp/claude-501/-Users-shamratneero-Downloads-untitled-folder-25/4750797c-db53-4c33-86ef-8eaced7962af/scratchpad/${n}.png`;

const browser = await chromium.launch();
const errors = [];

// ---------- Guest A ----------
const a = await browser.newContext();
const pa = await a.newPage();
pa.on('pageerror', (e) => errors.push('A: ' + e));
pa.on('console', (m) => m.type() === 'error' && errors.push('A: ' + m.text()));

await pa.goto(URL, { waitUntil: 'networkidle' });
await pa.waitForSelector('text=Chicken Biryani');

// Claim 2 biryani + 1 rezala
const addBiryani = pa.getByRole('button', { name: 'Add Chicken Biryani' });
await addBiryani.click(); await pa.waitForTimeout(700);
await addBiryani.click(); await pa.waitForTimeout(700);
await pa.getByRole('button', { name: 'Add Beef Rezala' }).click(); await pa.waitForTimeout(900);

const shareA = await pa.locator('.bottom-bar strong').innerText();
console.log('Guest A share after claiming 2 biryani + 1 rezala:', shareA);
await pa.screenshot({ path: shot('a1-claimed'), fullPage: true });

// ---------- The real test: reload ----------
await pa.reload({ waitUntil: 'networkidle' });
await pa.waitForTimeout(1500);
const biryaniQty = await pa.locator('.claim-row', { hasText: 'Chicken Biryani' }).locator('output').innerText();
const shareAfterReload = await pa.locator('.bottom-bar strong').innerText();
console.log('After reload — biryani qty:', biryaniQty, '| share:', shareAfterReload);
await pa.screenshot({ path: shot('a2-after-reload'), fullPage: true });

// ---------- Guest B: separate browser context = separate session ----------
const b = await browser.newContext();
const pb = await b.newPage();
pb.on('pageerror', (e) => errors.push('B: ' + e));
pb.on('console', (m) => m.type() === 'error' && errors.push('B: ' + m.text()));
await pb.goto(URL, { waitUntil: 'networkidle' });
await pb.waitForTimeout(1500);

const rows = await pb.locator('.claim-row').allInnerTexts();
console.log('Guest B sees availability:');
rows.forEach((r) => console.log('   ', r.replace(/\n/g, ' | ')));
await pb.screenshot({ path: shot('b1-availability'), fullPage: true });

// Guest B claims a coke, then completes name + payment
await pb.getByRole('button', { name: 'Add Coke' }).click(); await pb.waitForTimeout(900);
await pb.getByRole('button', { name: 'Continue' }).click();
await pb.waitForSelector('input');
await pb.fill('input', 'Tanvir');
await pb.getByRole('button', { name: /Confirm/ }).click();
await pb.waitForSelector('text=/bKash|sent it/', { timeout: 15000 });
const payAmount = await pb.locator('.pay-amount').innerText();
console.log('Guest B pay screen amount:', payAmount);
await pb.screenshot({ path: shot('b2-pay'), fullPage: true });

await pb.getByRole('button', { name: "I've sent it" }).click().catch(async () => {
  await pb.getByRole('button', { name: /sent it/ }).click();
});
await pb.waitForSelector('text=all set', { timeout: 15000 });
await pb.screenshot({ path: shot('b3-done'), fullPage: true });
console.log('Guest B completed payment report.');

console.log('\nCONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
