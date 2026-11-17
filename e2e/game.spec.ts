import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function load(page: Page, fixture: string) {
  const save = readFileSync(`e2e/fixtures/${fixture}.json`, 'utf8');
  // Set the save before the app boots; a reload would let the running page save over it.
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('qp.seeded')) return;
    sessionStorage.setItem('qp.seeded', '1');
    localStorage.setItem('qp.save', JSON.stringify({ ...JSON.parse(s), savedAt: Date.now() }));
  }, save);
  await page.goto('/');
}

test('the opening: one blank button that learns its name', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto('/');
  const blank = page.getByRole('button', { name: 'Unlabelled button' });
  await expect(blank).toBeVisible();
  for (let i = 0; i < 5; i++) await blank.click();
  await expect(page.getByRole('button', { name: 'Attend' })).toHaveText('Attend');
  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Attend' }).click();
  await page.getByRole('button', { name: 'Option 1, unreadable' }).click();
  await expect(page.getByText('Reward', { exact: true })).toBeVisible();
  await page.screenshot({ path: `e2e/shots/${info.project.name}-opening.png` });
  expect(errors).toEqual([]);
});

test('it is installable: manifest and service worker', async ({ page }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.icons.length).toBeGreaterThan(1);
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()), null, { timeout: 10_000 });
});

test('progress survives a reload', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: /Unlabelled button|Attend/ }).click();
  await page.waitForTimeout(6000); // the loop saves every five seconds
  await page.reload();
  await expect(page.getByRole('button', { name: 'Attend' })).toBeVisible();
});

const fixtures = readdirSync('e2e/fixtures').map((f) => f.replace('.json', ''));

for (const fixture of fixtures) {
  test(`renders ${fixture} without errors`, async ({ page }, info) => {
    const errors = watchErrors(page);
    await load(page, fixture);
    await page.waitForTimeout(700);
    if (fixture.startsWith('enc-')) await expect(page.getByRole('dialog')).toBeVisible();
    if (fixture.startsWith('phase-') && fixture !== 'phase-dark') await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
    // Nothing should spill off the side of a phone.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `e2e/shots/${info.project.name}-${fixture}.png` });
    expect(errors).toEqual([]);
  });
}

test('a whole conversation in the browser', async ({ page }) => {
  await load(page, 'enc-dana');
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 3; i++) await dialog.getByRole('button').first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status').first()).toBeVisible();
});

test('mobile tabs switch sections', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone');
  await load(page, 'phase-building');
  await page.getByRole('button', { name: 'Self' }).click();
  await expect(page.getByRole('region', { name: 'Self' })).toBeVisible();
  await page.getByRole('button', { name: 'Log' }).click();
  await expect(page.getByRole('region', { name: 'Log' })).toBeVisible();
});
