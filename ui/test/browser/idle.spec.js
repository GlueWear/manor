import {test, expect} from '@playwright/test';
import {createVisitorHost} from '../visitor-host.mjs';

let host;
test.beforeEach(async () => {host = await createVisitorHost(); host.now = 1000;});
test.afterEach(async () => {await host.close();});
async function open(page) {
  if (!host.clockInstalled) {
    await page.clock.install({time: new Date(0)});
    await page.clock.pauseAt(new Date(1000));
    host.clockInstalled = true;
  }
  await page.goto(`${host.origin}/apps/glurff/`);
  await expect(page.frameLocator('iframe').getByRole('heading')).toBeVisible();
  await expect.poll(() => host.clients.size).toBeGreaterThan(0);
}
async function advance(page, ms) {host.now += ms; await page.clock.runFor(ms);}

test('idle limit warns, Stay connected extends it, and expiry removes the app', async ({page}) => {
  host.configure(2);
  await open(page);
  await advance(page, 61000);
  const warning = page.getByRole('dialog', {name: 'Still here?'});
  await expect(warning).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await warning.getByRole('button', {name: 'Stay connected'}).click({force: true});
  await expect(warning).not.toBeVisible();
  expect(host.activity).toHaveLength(1);
  await advance(page, 61000);
  await expect(warning).toBeVisible();
  await page.setViewportSize({width: 390, height: 844});
  await page.clock.runFor(50);
  await warning.screenshot({path: 'test-results/idle-warning-mobile.png', animations: 'disabled'});
  await advance(page, 61000);
  await expect(page.locator('main')).toContainText('Your visit has ended');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('link', {name: 'Return to the gate'})).toBeVisible();
  expect(host.heartbeats.length).toBeGreaterThan(0);
});

test('input in another app tab refreshes the whole visit and no UI polling occurs', async ({page, context}) => {
  host.configure(2);
  await open(page);
  const other = await context.newPage();
  await open(other);
  await advance(page, 50000);
  await other.frameLocator('iframe').getByRole('textbox', {name: 'Message'}).click({force: true});
  await other.keyboard.type('hello');
  await expect.poll(() => host.activity.length).toBeGreaterThan(0);
  await advance(page, 30000);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('iframe')).toBeVisible();
  expect(host.reads).toBe(0);
  host.configure(0);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await advance(page, 3600000);
  expect(host.reads).toBe(0);
  await expect(page.locator('iframe')).toBeVisible();
  await other.close({runBeforeUnload: true});
});

test('pushed disable cancels a visible warning and pushed ending tears down all app tabs', async ({page, context}) => {
  host.configure(2);
  await open(page);
  await advance(page, 61000);
  await expect(page.getByRole('dialog')).toBeVisible();
  host.configure(0);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const other = await context.newPage();
  await open(other);
  await expect.poll(() => host.clients.size).toBe(2);
  host.broadcast('ending', null);
  for (const tab of [page, other]) {
    await expect(tab.locator('iframe')).toHaveCount(0);
    await expect(tab.locator('main')).toContainText('Your visit has ended');
  }
  await other.close({runBeforeUnload: true});
});

test('synthetic app events cannot keep the visit active and old policy replies are ignored', async ({page}) => {
  host.configure(2);
  await open(page);
  const old = host.policy();
  await page.frameLocator('iframe').getByRole('heading').evaluate(el => el.dispatchEvent(new Event('pointermove', {bubbles: true})));
  expect(host.activity).toHaveLength(0);
  await advance(page, 50000);
  await page.frameLocator('iframe').getByRole('button', {name: 'App action'}).click({force: true});
  await expect.poll(() => host.activity.length).toBe(1);
  host.broadcast('policy', old);
  await advance(page, 30000);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('owner can enable, change and disable the idle limit without changing the public pool', async ({page, request}) => {
  await request.get('http://127.0.0.1:8095/reset');
  await request.post('http://127.0.0.1:8095/managed-fixture', {data: {visitorPool: 'ships'}});
  await page.goto('/');
  const form = page.getByRole('form', {name: 'Visitor idle timeout'});
  await expect(form.getByRole('checkbox')).not.toBeChecked();
  await form.getByRole('checkbox').check();
  await form.getByLabel('Idle limit (minutes)').fill('5');
  await page.setViewportSize({width: 390, height: 844});
  await form.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await form.screenshot({path: 'test-results/idle-settings-mobile.png'});
  await form.getByRole('button', {name: 'Save timeout'}).click();
  await expect(form.getByRole('button', {name: 'Save timeout'})).toBeDisabled();
  await form.getByRole('checkbox').uncheck();
  await form.getByRole('button', {name: 'Save timeout'}).click();
  const pokes = await (await request.get('http://127.0.0.1:8095/pokes')).json();
  expect(pokes).toEqual([{kind: 'idle-policy', value: {minutes: 5}}, {kind: 'idle-policy', value: {minutes: 0}}]);
});

test('an old activity response cannot end a back-forward restored tab', async ({page}) => {
  host.configure(2);
  await open(page);
  let finish, requested;
  const started = new Promise(resolve => {requested = resolve;});
  const release = new Promise(resolve => {finish = resolve;});
  await page.route('**/~manor/visit/activity', async route => {
    requested();
    await release;
    await route.fulfill({status: 403, body: 'Old tab ended'});
  });
  await page.frameLocator('iframe').getByRole('button', {name: 'App action'}).click({force: true});
  await started;
  await page.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}));
    dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}));
  });
  await expect(page.frameLocator('iframe').getByRole('heading')).toBeVisible();
  const response = page.waitForResponse('**/~manor/visit/activity');
  finish();
  await response;
  await expect(page.frameLocator('iframe').getByRole('heading')).toBeVisible();
  await expect(page.locator('main')).toBeHidden();
});
