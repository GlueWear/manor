import {test, expect} from '@playwright/test';
import {createVisitorHost} from '../visitor-host.mjs';

const servers = [];
test.afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

async function setup(context) {
  const state = await createVisitorHost();
  servers.push(state.server);
  return state;
}

test('visitor apps fill the viewport and navigation stays inside the tracked tab', async ({context, page}) => {
  const state = await setup(context);
  await page.goto(`${state.origin}/apps/glurff/`);
  await expect(page.frameLocator('iframe').getByRole('heading', {name: 'App ready'})).toBeVisible();
  expect(state.opened).toHaveLength(1);
  expect(state.opened[0]).toMatch(/^[a-f0-9]{32}$/);
  await page.frameLocator('iframe').getByRole('link', {name: 'Other app', exact: true}).click();
  await expect(page).toHaveURL(/\/apps\/next\/$/);
  expect(state.opened).toHaveLength(1);
  expect(state.closed).toHaveLength(0);
  for (const width of [1280, 390]) {
    await page.setViewportSize({width, height: 844});
    const box = await page.locator('iframe').boundingBox();
    expect(box).toEqual({x: 0, y: 0, width, height: 844});
    expect(page.frames()).toHaveLength(2);
    await expect(page.frameLocator('iframe').getByRole('heading')).toHaveCount(1);
    await expect(page.frameLocator('iframe').locator('iframe')).toHaveCount(0);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({path: `test-results/visitor-${width}.png`});
  }
  await page.close({runBeforeUnload: true});
  await expect.poll(() => state.closed).toEqual(state.opened);
});

test('refresh and multiple tabs have distinct identities; hiding a tab never closes it', async ({context, page}) => {
  const state = await setup(context);
  await page.goto(`${state.origin}/apps/glurff/`);
  await expect(page.frameLocator('iframe').getByRole('heading')).toBeVisible();
  const second = await context.newPage();
  await second.goto(`${state.origin}/apps/glurff/`);
  await expect(second.frameLocator('iframe').getByRole('heading')).toBeVisible();
  expect(new Set(state.opened).size).toBe(2);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(state.closed).toHaveLength(0);
  await page.reload();
  await expect(page.frameLocator('iframe').getByRole('heading')).toBeVisible();
  await expect.poll(() => state.closed.length).toBe(1);
  expect(new Set(state.opened).size).toBe(3);
  await page.close({runBeforeUnload: true});
  await expect.poll(() => state.closed.length).toBe(2);
  expect(state.closed).not.toContain(state.opened[1]);
  await second.close({runBeforeUnload: true});
  await expect.poll(() => [...state.closed].sort()).toEqual([...state.opened].sort());
});

test('back-forward restoration uses a fresh identity rather than resurrecting a closed tab', async ({context, page}) => {
  const state = await setup(context);
  await page.goto(`${state.origin}/apps/glurff/`);
  await expect(page.frameLocator('iframe').getByRole('heading')).toBeVisible();
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true})));
  await expect.poll(() => state.closed.length).toBe(1);
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true})));
  await expect.poll(() => state.opened.length).toBe(2);
  expect(state.opened[1]).not.toBe(state.opened[0]);
  await page.close({runBeforeUnload: true});
  await expect.poll(() => state.closed.length).toBe(2);
});

test('new app tabs register independently and revoked visits never load the app', async ({context, page}) => {
  const state = await setup(context);
  await page.goto(`${state.origin}/apps/glurff/`);
  const popupEvent = page.waitForEvent('popup');
  await page.frameLocator('iframe').getByRole('link', {name: 'New tab', exact: true}).click();
  const popup = await popupEvent;
  await expect(popup.frameLocator('iframe').getByRole('heading')).toBeVisible();
  expect(state.opened).toHaveLength(2);
  await popup.close({runBeforeUnload: true});
  await expect.poll(() => state.closed.length).toBe(1);
  state.refused = true;
  await page.reload();
  await expect(page.locator('main')).toContainText('Your visit has ended');
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('one-minute connection heartbeats never renew the idle deadline', async ({context, page}) => {
  const state = await setup(context);
  state.now = 1000;
  state.configure(7);
  const deadline = state.expiresAt;
  await page.clock.install({time: new Date(1000)});
  await page.clock.pauseAt(new Date(1000));
  await page.goto(`${state.origin}/apps/glurff/`);
  await expect(page.frameLocator('iframe').getByRole('heading')).toBeVisible();
  const initialDeadline = state.expiresAt;
  state.now += 61000;
  await page.clock.runFor(61000);
  await expect.poll(() => state.heartbeats.length).toBe(1);
  expect(state.opened).toHaveLength(1);
  expect(state.activity).toHaveLength(0);
  expect(state.expiresAt).toBe(initialDeadline);
  expect(initialDeadline).toBe(deadline);
  expect(state.reads).toBe(0);
  await page.close({runBeforeUnload: true});
  await expect.poll(() => state.closed).toEqual(state.opened);
});

test('a refused heartbeat ends the visit instead of silently re-enrolling it', async ({context, page}) => {
  const state = await setup(context);
  await page.clock.install({time: new Date(1000)});
  await page.clock.pauseAt(new Date(1000));
  await page.goto(`${state.origin}/apps/glurff/`);
  await expect(page.frameLocator('iframe').getByRole('heading')).toBeVisible();
  state.refused = true;
  await page.clock.runFor(61000);
  await expect(page.locator('main')).toContainText('Your visit has ended');
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.clock.runFor(120000);
  expect(state.opened).toHaveLength(1);
});

test('connection heartbeats wait for the initial tab registration', async ({context, page}) => {
  const state = await setup(context);
  let release;
  const registration = new Promise(resolve => {release = resolve;});
  await page.route('**/~manor/visit/open', async route => {
    await registration;
    await route.continue();
  });
  const opening = page.waitForRequest(request => request.url().endsWith('/~manor/visit/open'));
  await page.goto(`${state.origin}/apps/glurff/`);
  await opening;
  const heartbeats = await page.evaluate(() => {
    let sent = 0;
    const original = window.fetch;
    window.fetch = (url, options) => {
      if (options?.headers?.['x-manor-heartbeat']) sent++;
      return original(url, options);
    };
    dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    return sent;
  });
  expect(heartbeats).toBe(0);
  release();
  await expect(page.frameLocator('iframe').getByRole('heading')).toBeVisible();
  expect(state.opened).toHaveLength(1);
});
