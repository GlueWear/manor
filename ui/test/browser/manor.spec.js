import {test, expect} from '@playwright/test';

const MOCK = 'http://127.0.0.1:8095';
const row = (page, name) => page.locator('tbody tr').filter({hasText: name});
test.beforeEach(async ({request, page}) => {
  await request.get(`${MOCK}/reset`);
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
});

test('the pool shows who has which moon, and which are getting ready', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Manor'})).toBeVisible();
  await expect(page.getByText('hosting', {exact: true})).toBeVisible();
  await expect(row(page, '~ritdex-sorled').locator('.status-col .badge')).toHaveText('in use');
  await expect(row(page, '~ritdex-sorled')).toContainText('since');
  await expect(row(page, '~lonteb-tarhus').locator('.status-col .badge')).toHaveText('link sent');
  await expect(row(page, '~fopsep-litruc').locator('.status-col .badge')).toHaveText('catching up');
  await expect(page.locator('.metrics')).toContainText('2 with visitors');
  await expect(page.getByRole('button', {name: 'Reset used moons (2)'})).toBeEnabled();
  await expect(page.locator('.log')).toContainText('Connected fleet hosting');
  await page.screenshot({path: 'test-results/manor.png', fullPage: true});
});

test('resetting the used moons frees them and Theseus restores them', async ({page, request}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Reset used moons (2)'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Reset 2 moons to their clean snapshot?');
  await dialog.getByRole('button', {name: 'Reset'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status').filter({hasText: 'Resetting 2 moons.'})).toBeVisible();
  await expect(row(page, '~ritdex-sorled').locator('.status-col .badge')).toHaveText('resetting');
  const pokes = await (await request.get(`${MOCK}/pokes`)).json();
  expect(pokes.at(-1)).toEqual({kind: 'reset', value: {ships: ['~lonteb-tarhus-siglup-narwet', '~ritdex-sorled-siglup-narwet']}});
  await expect(page.getByRole('button', {name: /Reset used moons \(0\)/})).toBeDisabled();
  // once restored, they are free again
  await expect(row(page, '~ritdex-sorled').locator('.status-col .badge')).toHaveText('free', {timeout: 8000});
});

test('one moon can be freed as it is, reset, or removed', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Free ~lonteb-tarhus-siglup-narwet as it is'}).click();
  await expect(page.getByRole('dialog')).toContainText('whoever had it can still get in');
  await page.getByRole('dialog').getByRole('button', {name: 'Free'}).click();
  await expect(row(page, '~lonteb-tarhus').locator('.status-col .badge')).toHaveText('free');
  await expect(page.getByRole('button', {name: 'Free ~lonteb-tarhus-siglup-narwet as it is'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Remove ~fopsep-litruc-siglup-narwet from the pool'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Remove'}).click();
  await expect(row(page, '~fopsep-litruc')).toHaveCount(0);
  await expect(page.locator('.log')).toContainText('Removed ~fopsep-litruc-siglup-narwet from the pool.');
});

test('connecting a fleet offers only snapshots that hold all its moons', async ({page, request}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Change fleet'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', {name: 'Connect'})).toBeDisabled();
  await dialog.getByLabel('Fleet').selectOption('other');
  const options = await dialog.getByLabel('Snapshot').locator('option').allTextContents();
  expect(options.some(o => o.startsWith('/other-clean'))).toBeTruthy();
  expect(options.some(o => o.startsWith('/half') || o.startsWith('/hosting-reset'))).toBeFalsy();
  await dialog.getByLabel('Snapshot').selectOption('/other-clean');
  await dialog.getByRole('button', {name: 'Connect'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.fleet-row')).toContainText('other');
  await expect(page.locator('.fleet-row')).toContainText('2 moons, reset from /other-clean');
  await expect(row(page, '~dozpen-dozpen')).toBeVisible();
  await expect(row(page, '~ritdex-sorled')).toHaveCount(0);
  const pokes = await (await request.get(`${MOCK}/pokes`)).json();
  expect(pokes.at(-1)).toEqual({kind: 'connect', value: {fleet: 'other', snapshot: '/other-clean'}});
  // a fleet with no snapshot of all its moons says what to do first
  await page.getByRole('button', {name: 'Change fleet'}).click();
  await page.getByRole('dialog').getByLabel('Fleet').selectOption('lonely');
  await expect(page.getByRole('dialog')).toContainText('Choose a snapshot');
  await page.getByRole('dialog').getByLabel('Fleet').selectOption('hosting');
  await expect(page.getByRole('dialog').getByLabel('Snapshot').locator('option')).toHaveCount(2);
});

test('settings are checked before saving and give the public link', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.card').first()).toContainText('No public address yet');
  await page.getByLabel('Public address').fill('Not A Host');
  await page.getByRole('button', {name: 'Save settings'}).click();
  await expect(page.getByRole('alert')).toContainText('lowercase');
  await page.getByLabel('Public address').fill('203-0-113-7.nip.io');
  await page.getByLabel('Landing page').fill('/apps/glurff/');
  await page.getByRole('button', {name: 'Save settings'}).click();
  await expect(page.locator('.public-link')).toHaveText('https://join.203-0-113-7.nip.io/');
  await expect(page.locator('.card').first()).toContainText('land in /apps/glurff/');
});

test('the front door gives this ship a Caddyfile once the address is set', async ({page}) => {
  await page.goto('/');
  const front = page.getByRole('region', {name: 'Front door'});
  await expect(front).toContainText('Set the public address under Settings first');
  await expect(front).toContainText('No visits through it yet.');
  await page.getByLabel('Public address').fill('203-0-113-7.nip.io');
  await page.getByRole('button', {name: 'Save settings'}).click();
  await expect(front.getByRole('button', {name: 'Download Caddyfile'})).toBeVisible();
  await front.getByLabel('HTTPS port').fill('9443');
  await front.locator('summary').click();
  const config = front.getByTestId('caddyfile');
  await expect(config).toContainText('https_port 9443');
  await expect(config).toContainText('import routes join.203-0-113-7.nip.io');
  await expect(config).toContainText('ask http://127.0.0.1:8083/apps/manor/public/tls-ask');
  await expect(config).toContainText('health_body "^~siglup-narwet$"');
  const download = page.waitForEvent('download');
  await front.getByRole('button', {name: 'Download Caddyfile'}).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('Caddyfile');
  const chunks = []; for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toContain('https_port 9443');
  await page.screenshot({path: 'test-results/front-door.png', fullPage: true});
  // the HTTPS and test ports must differ
  await front.getByLabel('Test port').fill('9443');
  await expect(front.getByRole('alert')).toContainText('different');
  await front.getByLabel('Test port').fill('8090');
  // this browser remembers the options
  await page.reload();
  await expect(page.getByRole('region', {name: 'Front door'}).getByLabel('HTTPS port')).toHaveValue('9443');
});

test('moons show their full names, and Noltbook names and pictures that can be edited', async ({page, request}) => {
  await page.goto('/');
  const ada = row(page, '~ritdex-sorled-siglup-narwet');
  await expect(ada.locator('.ship-name strong')).toHaveText('Ada');
  await expect(ada.locator('.ship-name small')).toHaveText('~ritdex-sorled-siglup-narwet');
  const plain = row(page, '~lonteb-tarhus-siglup-narwet');
  await expect(plain.locator('.ship-name strong')).toHaveText('~lonteb-tarhus-siglup-narwet');
  // without Noltbook, the name and picture are only shown
  const fop = row(page, '~fopsep-litruc-siglup-narwet');
  await expect(fop.locator('button.ship-link')).toHaveCount(0);
  await expect(fop.locator('.sigil')).toHaveCount(1);
  await fop.locator('.ship-name strong').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // the name opens the editor
  await plain.locator('.ship-link strong').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Name and picture of ~lonteb-tarhus-siglup-narwet');
  await dialog.getByLabel('Name').fill('Bea');
  await dialog.getByLabel('Picture address').fill('ftp://nope');
  await dialog.getByRole('button', {name: 'Save'}).click();
  await expect(dialog.getByRole('alert')).toContainText('https://');
  // a file is shrunk and sent to Theseus, which uploads it inside the moon
  const big = Buffer.from(await page.evaluate(() => {const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#219fd1'; x.fillRect(0, 0, 400, 300); return c.toDataURL('image/png').split(',')[1];}), 'base64');
  await dialog.getByLabel('Picture file').setInputFiles({name: 'bea.png', mimeType: 'image/png', buffer: big});
  await expect(dialog).toContainText('bea.png, as a 128×96 JPEG');
  await expect(dialog.getByLabel('Picture address')).toHaveValue('');
  await dialog.getByRole('button', {name: 'Save'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(plain.locator('.ship-name strong')).toHaveText('Bea');
  await expect(plain.locator('.ship-name small')).toHaveText('~lonteb-tarhus-siglup-narwet');
  await expect(plain.locator('img.avatar')).toHaveAttribute('src', /^http:\/\/lonteb-tarhus-siglup-narwet\.localhost:5184\/apps\/noltbook\/user-avatar\/~lonteb-tarhus-siglup-narwet\?v=/);
  await expect.poll(() => plain.locator('img.avatar').evaluate(img => img.complete && img.naturalWidth > 0)).toBeTruthy();
  const pokes = await (await request.get(`${MOCK}/pokes`)).json();
  expect(pokes.at(-1)).toMatchObject({kind: 'profile', value: {who: '~lonteb-tarhus-siglup-narwet', name: 'Bea'}});
  expect(pokes.at(-1).value.upload).toMatch(/base64 chars/);
  // the picture opens it too
  await ada.locator('.avatar-wrap').click();
  await expect(page.getByRole('dialog').getByLabel('Name')).toHaveValue('Ada');
  await page.getByRole('dialog').getByRole('button', {name: 'Cancel'}).click();
  await page.screenshot({path: 'test-results/names.png', fullPage: true});
});

test('a name changed anywhere shows on every open page, with no reload', async ({page, context, request}) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  const moon = '~lonteb-tarhus-siglup-narwet';
  await expect(row(other, moon).locator('.ship-name strong')).toHaveText(moon);
  // changed on one page: the other hears it from %theseus
  await row(page, moon).locator('.ship-link strong').click();
  await page.getByRole('dialog').getByLabel('Name').fill('Bea');
  await page.getByRole('dialog').getByRole('button', {name: 'Save'}).click();
  await expect(row(other, moon).locator('.ship-name strong')).toHaveText('Bea');
  // changed in the moon's own Noltbook (or in Theseus): both hear it
  await request.get(`${MOCK}/profile-change?ship=${moon}&name=Beatrix`);
  await expect(row(page, moon).locator('.ship-name strong')).toHaveText('Beatrix');
  await expect(row(other, moon).locator('.ship-name strong')).toHaveText('Beatrix');
  await other.close();
});

test('an idle page asks the host nothing; a visitor shows up as it happens', async ({page, request}) => {
  await page.goto('/');
  await expect(row(page, '~fopsep-litruc')).toBeVisible();
  await page.waitForTimeout(1000);
  const reads = [];
  page.on('request', r => {if (r.url().includes('/~/scry/')) reads.push(r.url());});
  await page.waitForTimeout(9000);
  expect(reads).toHaveLength(0);
  // a visitor pulls the lever: %manor tells the page
  await request.get(`${MOCK}/visitor/~fopsep-litruc-siglup-narwet`);
  await expect(row(page, '~fopsep-litruc').locator('.status-col .badge')).toHaveText('link sent');
  await expect(page.locator('.log')).toContainText('Gave ~fopsep-litruc-siglup-narwet to a visitor.');
});

test('signed out, it says so and links to the login', async ({page, request}) => {
  await request.get(`${MOCK}/sign-out`);
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Sign in');
  await expect(page.getByRole('link', {name: 'Sign in'})).toHaveAttribute('href', '/~/login?redirect=/apps/manor');
});

test('fits a phone', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/');
  await expect(row(page, '~ritdex-sorled')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  // the whole table fits, actions included
  expect(await page.locator('.table-wrap').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
  await expect(row(page, '~ritdex-sorled').locator('.mobile-status .badge')).toHaveText('in use');
  await page.screenshot({path: 'test-results/manor-mobile.png', fullPage: true});
});
