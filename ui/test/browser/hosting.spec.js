import {test, expect} from '@playwright/test';

const MOCK = 'http://127.0.0.1:8095';
const ship = '~mapdex-fodtux-siglup-narwet';
const row = (extra = {}) => ({ship, port: 8086, online: true, ready: true, pending: null, blocked: false, claim: null, fault: null, transport: 'manor', endpoint: null, landing: 'landscape', required: ['landscape'], ...extra});
const pool = page => page.getByRole('region', {name: /^Ships\b/});
test.beforeEach(async ({request}) => {await request.get(`${MOCK}/reset`);});

test('hosting settings stay visible without Theseus and pairing stays out of the main flow', async ({page, request}) => {
  await request.get(`${MOCK}/no-theseus`);
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [row()]}});
  await page.goto('/');
  await expect(pool(page)).toBeVisible();
  const access = page.getByRole('region', {name: 'Public access'});
  await expect(access).toBeVisible();
  await access.getByLabel('Visitor pool').selectOption('ships');
  await expect(access.getByLabel('Public address')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Download Caddyfile', exact: true})).toHaveCount(1);
  await expect(access.getByRole('button', {name: 'Download Caddyfile'})).toBeVisible();
  await expect(access).toContainText('No public address saved');
  await expect(page.getByRole('region', {name: 'Theseus fleet'})).toContainText('hosting · 3 virtual moons');
  await expect(page.getByRole('region', {name: 'Theseus fleet'}).getByRole('button', {name: 'Connect a fleet'})).toBeDisabled();
  await expect(page.getByRole('button', {name: 'Choose controller'})).not.toBeVisible();
  await expect(page.getByText('Configure this ship', {exact: true})).toHaveCount(0);
  await expect(page.getByText('Local preview', {exact: true})).toHaveCount(0);
  await access.getByLabel('Public address').fill('glurff.com');
  await access.getByRole('button', {name: 'Save settings'}).click();
  const state = await (await request.get(`${MOCK}/~/scry/manor/state.json`)).json();
  expect(state.settings).toEqual({base: 'glurff.com', landing: '/apps/landscape/'});
  expect(state.pool).toHaveLength(3);
  expect(state.visitorPool).toBe('ships');
  await expect(access.locator('.public-link')).toHaveText('https://join.glurff.com/');
  const downloaded = page.waitForEvent('download');
  await access.getByRole('button', {name: 'Download Caddyfile'}).click();
  expect((await downloaded).suggestedFilename()).toBe('Caddyfile');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({width, height: 844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `test-results/hosting-no-theseus-${width}.png`, fullPage: true});
  }
  await page.locator('.managed-role > summary').click();
  await page.getByRole('button', {name: 'Choose controller'}).click();
  await expect(page.getByRole('dialog')).toContainText('access to ~siglup-narwet itself, not to the ships listed above');
  await expect(page.getByRole('dialog').getByRole('button', {name: 'Allow controller'})).toBeDisabled();
});

test('the landing picker uses that ship inventory and keeps extra readiness checks advanced', async ({page, request}) => {
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [row({required: ['landscape', 'noltbook']})]}});
  await page.goto('/');
  await pool(page).getByRole('button', {name: `Landing app for ${ship}`}).click();
  const dialog = page.getByRole('dialog');
  const select = dialog.getByLabel('Landing app', {exact: true});
  expect(await select.locator('option').allTextContents()).toEqual(['glurff', 'landscape', 'noltbook']);
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  await expect(dialog.getByRole('checkbox')).not.toBeVisible();
  await select.selectOption('glurff');
  await dialog.getByText('Advanced readiness checks', {exact: true}).click();
  await expect(dialog.getByRole('checkbox', {name: 'noltbook', exact: true})).toBeChecked();
  await expect(dialog.getByRole('checkbox', {name: 'landscape', exact: true})).not.toBeChecked();
  await page.setViewportSize({width: 320, height: 844});
  await dialog.screenshot({path: 'test-results/landing-app-mobile.png'});
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  const pokes = await (await request.get(`${MOCK}/pokes`)).json();
  expect(pokes).toEqual([{kind: 'ship-configure', value: {who: ship, landing: 'glurff', required: ['glurff', 'noltbook']}}]);
  await expect(pool(page)).toContainText('Landing: glurff');
});

test('an unavailable inventory never invents host apps and pushed inventory updates the open picker', async ({page, request}) => {
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [row({apps: null, required: ['landscape', 'noltbook']})]}});
  await page.goto('/');
  await pool(page).getByRole('button', {name: `Landing app for ${ship}`}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Landing app')).toBeDisabled();
  await expect(dialog).toContainText('App list unavailable');
  expect(await dialog.getByLabel('Landing app').locator('option').allTextContents()).toEqual(['landscape (current)']);
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [row({apps: [{desk: 'glurff', running: true, web: true}], required: ['landscape', 'noltbook']})]}});
  await expect(dialog.getByLabel('Landing app')).toBeEnabled();
  await dialog.getByLabel('Landing app').selectOption('glurff');
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  expect((await (await request.get(`${MOCK}/pokes`)).json())[0].value.required).toEqual(['glurff', 'noltbook']);
});

test('an optional Theseus authentication error cannot hide a valid Manor hosting page', async ({page}) => {
  await page.route('**/~/scry/theseus/ui.json', route => route.fulfill({status: 403, body: 'not running'}));
  await page.goto('/');
  await expect(page.getByRole('region', {name: 'Public access'})).toBeVisible();
  await expect(pool(page)).toBeVisible();
  await expect(page.getByRole('link', {name: 'Sign in'})).toHaveCount(0);
  await expect(page.getByRole('region', {name: 'Theseus fleet'})).toContainText('Unavailable');
});
