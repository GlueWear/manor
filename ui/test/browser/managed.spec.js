import {test, expect} from '@playwright/test';

const MOCK = 'http://127.0.0.1:8095';
const comet = '~doznec-salfun-naptul-habrys--disseb-lissur-dopmet-padrum';
const poolOf = page => page.getByRole('region', {name: /^Ships\b/});
const rowOf = (page, ship) => poolOf(page).locator('tbody tr').filter({hasText: ship});
const requestOf = (page, ship) => poolOf(page).locator('.request-list li').filter({hasText: ship});
const managedRow = (ship, extra = {}) => ({ship, port: 8101, online: true, ready: true, pending: null, blocked: false, fault: null, profile: null, claim: null, generation: 0, landing: 'landscape', required: ['landscape'], transport: 'manor', endpoint: null, ...extra});
test.beforeEach(async ({request}) => {await request.get(`${MOCK}/reset`);});

test('incoming requests are reviewed or rejected explicitly for ships of any rank', async ({page, request}) => {
  const at = 1794657600000;
  const identities = ['~zod', '~siglup', '~sampel-palnet', '~pilfep-sicted-mignes-magtel', comet];
  const pairRequests = identities.map((ship, i) => ({ship, at: at + i * 1000}));
  await request.post(`${MOCK}/managed-fixture`, {data: {pairRequests}});
  await page.goto('/');
  const pool = poolOf(page);
  const requests = pool.getByRole('region', {name: 'Connection requests'});
  await expect(requests.locator('li')).toHaveCount(5);
  await expect(pool.getByRole('button', {name: /Add ship|Connect ship/i})).toHaveCount(0);
  await expect(pool.locator('tbody tr')).toHaveCount(0);
  for (const entry of pairRequests) {
    await expect(requestOf(page, entry.ship).locator('time')).toHaveAttribute('datetime', new Date(entry.at).toISOString());
    await expect(requestOf(page, entry.ship).getByRole('button', {name: `Approve ${entry.ship}`})).toBeEnabled();
    await expect(requestOf(page, entry.ship).getByRole('button', {name: `Reject ${entry.ship}`})).toBeEnabled();
  }
  await expect(pool).not.toContainText(/Full moons?|manor-moon|manor-pair-request/);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({width, height: 844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await requests.screenshot({path: `test-results/connection-requests-${width}.png`});
  }
  await requestOf(page, comet).getByRole('button', {name: `Approve ${comet}`}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(comet);
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  await expect(dialog.getByLabel('Connection')).toHaveValue('local');
  await dialog.screenshot({path: 'test-results/approve-ship-mobile.png'});
  await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
  expect(await (await request.get(`${MOCK}/pokes`)).json()).toEqual([]);
  await requestOf(page, '~siglup').getByRole('button', {name: 'Reject ~siglup'}).click();
  await expect(requestOf(page, '~siglup')).toHaveCount(0);
  await expect(pool.locator('tbody tr')).toHaveCount(0);
  expect(await (await request.get(`${MOCK}/pokes`)).json()).toEqual([{kind: 'ship-reject', value: {who: '~siglup'}}]);
});

test('a withdrawn or superseded request cannot be approved from an open review', async ({page, request}) => {
  const at = Date.now();
  await request.post(`${MOCK}/managed-fixture`, {data: {pairRequests: [{ship: '~zod', at}]}});
  await page.goto('/');
  await requestOf(page, '~zod').getByRole('button', {name: 'Approve ~zod'}).click();
  const dialog = page.getByRole('dialog');
  await request.post(`${MOCK}/managed-fixture`, {data: {pairRequests: [{ship: '~zod', at: at + 1}]}});
  await expect(dialog.getByRole('button', {name: 'Approve', exact: true})).toBeDisabled();
  await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
  await requestOf(page, '~zod').getByRole('button', {name: 'Approve ~zod'}).click();
  await expect(dialog.getByRole('button', {name: 'Approve', exact: true})).toBeEnabled();
  await request.post(`${MOCK}/managed-fixture`, {data: {pairRequests: []}});
  await expect(dialog.getByRole('button', {name: 'Approve', exact: true})).toBeDisabled();
  expect(await (await request.get(`${MOCK}/pokes`)).json()).toEqual([]);
});

test('a cached-online claimed deleted ship can be forgotten without any remote unlock', async ({page, request}) => {
  const ship = '~pilfep-sicted-mignes-magtel';
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [managedRow(ship, {online: true, claim: {entered: 1}})]}});
  await page.goto('/');
  const row = rowOf(page, ship);
  await expect(row.getByRole('button', {name: `Forget ship ${ship}`})).toBeEnabled();
  await expect(row.getByRole('button', {name: `Remove ship ${ship}`})).toHaveCount(0);
  await row.getByRole('button', {name: `Forget ship ${ship}`}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', {name: 'Forget ship', exact: true})).toBeVisible();
  await expect(dialog).toContainText('only its local registration and reservation');
  await expect(dialog.locator('strong').last()).toHaveText('This does not revoke sessions or stop or delete the actual ship.');
  await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
  await expect(row).toBeVisible();
  expect(await (await request.get(`${MOCK}/pokes`)).json()).toEqual([]);
  await row.getByRole('button', {name: `Forget ship ${ship}`}).click();
  await page.setViewportSize({width: 320, height: 844});
  await dialog.screenshot({path: 'test-results/forget-cached-online-mobile.png'});
  await dialog.getByRole('button', {name: 'Forget ship', exact: true}).click();
  await expect(row).toHaveCount(0);
  expect(await (await request.get(`${MOCK}/pokes`)).json()).toEqual([{kind: 'ship-forget', value: {who: ship}}]);
  const state = await (await request.get(`${MOCK}/~/scry/manor/state.json`)).json();
  expect(state.managed.ships).toEqual([]);
  expect(state.pool).toHaveLength(3);
});

test('pending registrations can be forgotten, and idle rows keep normal removal with a local-only alternative', async ({page, request}) => {
  await page.goto('/');
  for (const extra of [{pending: 'session'}, {pending: 'revoke', online: false}, {pending: 'profile', claim: {entered: 1}}, {online: false}, {online: true}]) {
    await request.post(`${MOCK}/managed-fixture`, {data: {ships: [managedRow('~zod', extra)]}});
    const row = rowOf(page, '~zod');
    if (extra.pending) await row.getByRole('button', {name: 'Forget ship ~zod'}).click();
    else {
      await row.getByRole('button', {name: 'Remove ship ~zod'}).click();
      await expect(page.getByRole('dialog').getByRole('button', {name: 'Remove', exact: true})).toBeEnabled();
      await page.getByRole('dialog').getByRole('button', {name: 'Forget locally instead'}).click();
    }
    await expect(page.getByRole('dialog')).toContainText('does not revoke sessions');
    await page.getByRole('dialog').getByRole('button', {name: 'Forget ship', exact: true}).click();
    await expect(row).toHaveCount(0);
  }
  const pokes = await (await request.get(`${MOCK}/pokes`)).json();
  expect(pokes).toHaveLength(5);
  expect(pokes.every(poke => poke.kind === 'ship-forget' && poke.value.who === '~zod')).toBe(true);
});

test('Manor alone pairs and configures this ship while managing its own pool', async ({page, request}) => {
  await request.get(`${MOCK}/no-theseus`);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Manor'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Open Theseus'})).toHaveCount(0);
  await expect(page.getByRole('region', {name: 'Theseus fleet'})).toContainText('Unavailable');
  await expect(poolOf(page)).toBeVisible();
  await page.locator('.managed-role > summary').click();
  const local = page.getByRole('region', {name: /^This ship:/});
  await expect(local).toContainText('Not paired');
  await local.getByRole('button', {name: 'Visitor settings for this ship'}).click();
  await expect(page.getByRole('dialog').getByLabel('Landing app')).toHaveValue('landscape');
  await expect(page.getByRole('dialog').getByText('Advanced readiness checks')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', {name: 'Cancel'}).click();
  await local.getByRole('button', {name: 'Choose controller'}).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Controller ship').fill('~siglup');
  await expect(dialog.getByRole('button', {name: 'Allow controller', exact: true})).toBeDisabled();
  await expect(dialog).toContainText('create visitor logins, sign browsers out');
  await expect(dialog).toContainText('itself, not to the ships listed above');
  await expect(dialog).toContainText('A connection request will be sent to its owner for approval.');
  await expect(dialog).not.toContainText('If approved');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', {name: 'Allow controller', exact: true}).click();
  await expect(local).toContainText('~siglup');
  await local.getByRole('button', {name: 'Visitor settings for this ship'}).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Landing app').selectOption('glurff');
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  await expect(local.locator('dd').nth(1)).toHaveText('glurff');
  await request.post(`${MOCK}/managed-fixture`, {data: {pairRequests: [{ship: '~zod', at: Date.now()}]}});
  await requestOf(page, '~zod').getByRole('button', {name: 'Approve ~zod'}).click();
  await expect(page.getByRole('dialog')).toContainText('~zod');
  await expect(page.getByRole('dialog').getByLabel('Ship name')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', {name: 'Approve', exact: true}).click();
  await expect(rowOf(page, '~zod')).toBeVisible();
  await local.getByRole('button', {name: 'Remove controller'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Remove controller', exact: true}).click();
  await expect(local).toContainText('Not paired');
  await expect(rowOf(page, '~zod')).toBeVisible();
  const pokes = await (await request.get(`${MOCK}/pokes`)).json();
  expect(pokes).toEqual([
    {kind: 'pair', value: {controller: '~siglup'}},
    {kind: 'managed-configure', value: {landing: 'glurff', required: ['glurff']}},
    {kind: 'ship-approve', value: {who: '~zod', endpoint: null}},
    {kind: 'pair', value: {controller: null}},
  ]);
  const subscriptions = await (await request.get(`${MOCK}/subscriptions`)).json();
  expect(subscriptions).toContain('state');
  expect(subscriptions).not.toContain('ui');
  expect(subscriptions).not.toContain('profiles');
  expect(errors).toEqual([]);
  await page.screenshot({path: 'test-results/manor-without-theseus.png', fullPage: true});
});

test('any ship size can use a verified remote endpoint or a local tunnel', async ({page, request}) => {
  const at = Date.now();
  await request.post(`${MOCK}/managed-fixture`, {data: {pairRequests: [{ship: comet, at}, {ship: '~siglup', at}]}});
  await page.goto('/');
  const pool = poolOf(page);
  await requestOf(page, comet).getByRole('button', {name: `Approve ${comet}`}).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Connection', {exact: true}).selectOption('https');
  await dialog.getByLabel('Endpoint host').fill('ship.example.com\nrespond');
  await dialog.getByRole('button', {name: 'Approve', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('hostname');
  await dialog.getByLabel('Endpoint host').fill('Ship.Example.com');
  await dialog.getByRole('button', {name: 'Approve', exact: true}).click();
  await expect(rowOf(page, comet)).toContainText('https://ship.example.com:443');
  await requestOf(page, '~siglup').getByRole('button', {name: 'Approve ~siglup'}).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Connection', {exact: true}).selectOption('https');
  await dialog.getByLabel('Endpoint host').fill('SHIP.EXAMPLE.COM');
  await dialog.getByRole('button', {name: 'Approve', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('unique');
  await dialog.getByLabel('Connection', {exact: true}).selectOption('tunnel');
  await dialog.getByLabel('Endpoint host').fill('remote.example.com');
  await dialog.getByRole('button', {name: 'Approve', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('require HTTPS');
  await dialog.getByLabel('Endpoint host').fill('localhost');
  await dialog.getByLabel('Endpoint port').fill('8201');
  await dialog.getByRole('button', {name: 'Approve', exact: true}).click();
  await expect(rowOf(page, '~siglup')).toContainText('http://localhost:8201');
  const access = page.getByRole('region', {name: 'Public access'});
  await access.getByLabel('Visitor pool').selectOption('ships');
  await access.getByRole('button', {name: 'Save settings'}).click();
  await access.getByText('Show Caddyfile', {exact: true}).click();
  await expect(access.getByTestId('caddyfile')).toContainText('reverse_proxy https://ship.example.com:443');
  await expect(access.getByTestId('caddyfile')).toContainText(`public/managed/enter/${comet}`);
  expect(await (await request.get(`${MOCK}/pokes`)).json()).toEqual([
    {kind: 'ship-approve', value: {who: comet, endpoint: {host: 'ship.example.com', port: 443, secure: true}}},
    {kind: 'ship-approve', value: {who: '~siglup', endpoint: {host: 'localhost', port: 8201, secure: false}}},
    {kind: 'hosting', value: {base: '', landing: '/apps/landscape/', pool: 'ships'}},
  ]);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({width, height: 844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(await pool.locator('.table-wrap').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
    await pool.screenshot({path: `test-results/managed-comet-${width}.png`});
  }
});

test('profile changes preview external images and distinguish keep from clear', async ({page, request}) => {
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [managedRow('~zod', {profile: {displayName: 'Pilot', avatar: {type: 'external', url: 'https://pictures.example/old.png'}}})]}});
  await page.route('https://pictures.example/**', route => route.fulfill({contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')}));
  await page.goto('/');
  const open = async () => {await rowOf(page, '~zod').locator('button.ship-link').click(); return page.getByRole('dialog');};
  let dialog = await open();
  await expect(dialog.getByLabel('Picture file')).toHaveCount(0);
  await dialog.getByLabel('Name', {exact: true}).fill('Zod');
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  await expect(rowOf(page, '~zod').locator('.ship-name strong')).toHaveText('Zod');
  dialog = await open();
  await dialog.getByLabel('Picture address').fill('data:image/png;base64,abc');
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('external picture address');
  await dialog.getByLabel('Picture address').fill('https://pictures.example/new.png');
  await expect(dialog.locator('.profile-preview img')).toHaveAttribute('src', 'https://pictures.example/new.png');
  await expect.poll(() => dialog.locator('.profile-preview img').evaluate(img => img.complete && img.naturalWidth > 0)).toBeTruthy();
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(rowOf(page, '~zod').locator('button.ship-link')).toBeEnabled();
  dialog = await open();
  await dialog.getByLabel('Name', {exact: true}).fill('');
  await dialog.getByLabel('Picture address').fill('');
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  await expect(rowOf(page, '~zod').locator('.ship-name strong')).toHaveText('~zod');
  expect(await (await request.get(`${MOCK}/pokes`)).json()).toEqual([
    {kind: 'ship-profile', value: {who: '~zod', name: 'Zod'}},
    {kind: 'ship-profile', value: {who: '~zod', avatar: 'https://pictures.example/new.png'}},
    {kind: 'ship-profile', value: {who: '~zod', name: null, avatar: null}},
  ]);
});

test('legacy upgrades, configuration, reconnect and removal use generic actions', async ({page, request}) => {
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [managedRow('~zod', {transport: 'manor-moon'})]}});
  await page.goto('/');
  const row = rowOf(page, '~zod');
  await row.getByRole('button', {name: 'Landing app for ~zod'}).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Landing app')).toHaveJSProperty('tagName', 'SELECT');
  await dialog.getByLabel('Landing app').selectOption('glurff');
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  await row.getByRole('button', {name: 'Upgrade ~zod'}).click();
  await expect(page.getByRole('dialog')).toContainText('%manor installed and paired');
  await page.getByRole('dialog').getByRole('button', {name: 'Upgrade', exact: true}).click();
  await expect(row.getByRole('button', {name: 'Upgrade ~zod'})).toHaveCount(0);
  await row.getByRole('button', {name: 'Reconnect ~zod'}).click();
  await row.getByRole('button', {name: 'Remove ship ~zod'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Remove', exact: true}).click();
  await expect(row).toHaveCount(0);
  expect(await (await request.get(`${MOCK}/pokes`)).json()).toEqual([
    {kind: 'ship-configure', value: {who: '~zod', landing: 'glurff', required: ['glurff']}},
    {kind: 'ship-upgrade', value: {who: '~zod'}},
    {kind: 'ship-reconnect', value: {who: '~zod'}},
    {kind: 'ship-remove', value: {who: '~zod'}},
  ]);
});

test('claims never idle-release; claims and pending work guard destructive changes', async ({page, request}) => {
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [
    managedRow('~zod', {transport: 'manor-moon', claim: {expires: Date.now() - 1000}}),
    managedRow('~siglup', {port: 8102, transport: 'manor-moon', pending: 'profile'}),
  ]}});
  await page.goto('/');
  const row = rowOf(page, '~zod');
  await expect(row.locator('.status-col .badge')).toHaveText('reserved');
  for (const ship of ['~zod', '~siglup']) {
    for (const label of [`Landing app for ${ship}`, `Edit endpoint ${ship}`, `Upgrade ${ship}`]) await expect(rowOf(page, ship).getByRole('button', {name: label})).toBeDisabled();
    await expect(rowOf(page, ship).getByRole('button', {name: `Forget ship ${ship}`})).toBeEnabled();
  }
  await expect(rowOf(page, '~siglup').locator('.status-col .badge')).toHaveText('saving profile');
  await expect(rowOf(page, '~siglup').getByRole('button', {name: 'Reconnect ~siglup'})).toBeDisabled();
  await page.waitForTimeout(1500);
  expect(await (await request.get(`${MOCK}/pokes`)).json()).toEqual([]);
  await expect(row.locator('.status-col .badge')).toHaveText('reserved');
  // Availability is rechecked when the host changes while a dialog is open.
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [managedRow('~zod', {transport: 'manor-moon'})]}});
  await row.getByRole('button', {name: 'Upgrade ~zod'}).click();
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [managedRow('~zod', {transport: 'manor-moon', claim: {entered: 1}})]}});
  await expect(page.getByRole('dialog').getByRole('button', {name: 'Upgrade', exact: true})).toBeDisabled();
});

test('profile saves preserve free and in-use status without an unlock', async ({page, request}) => {
  for (const claim of [null, {entered: 1, expires: null}]) {
    await request.post(`${MOCK}/managed-fixture`, {data: {ships: [managedRow('~zod', {profile: {displayName: 'Before', avatar: null}, claim})]}});
    await page.goto('/');
    const row = rowOf(page, '~zod');
    const status = claim ? 'in use' : 'free';
    await expect(row.locator('.status-col .badge')).toHaveText(status);
    await row.locator('button.ship-link').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', {exact: true}).fill('After');
    await dialog.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(dialog).toHaveCount(0);
    await expect(row.locator('.status-col .badge')).toHaveText(status);
    await expect(row.getByRole('button', {name: 'Unlock ~zod'})).toBeEnabled();
    await expect(row.locator('.ship-name strong')).toHaveText('After');
    await expect(row.locator('.status-col .badge')).toHaveText(status);
    const state = await (await request.get(`${MOCK}/~/scry/manor/state.json`)).json();
    expect(state.managed.ships[0].claim).toEqual(claim);
  }
});

test('a failed async profile update preserves the claim without demanding an unlock', async ({page, request}) => {
  const claim = {entered: 1, expires: null};
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [managedRow('~zod', {profile: {displayName: 'Confirmed', avatar: null}, claim})], profileFailure: 'Profile update failed'}});
  await page.goto('/');
  const row = rowOf(page, '~zod');
  await row.locator('button.ship-link').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', {exact: true}).fill('Unconfirmed');
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(row.locator('.status-col .badge')).toHaveText('in use');
  await expect(row.locator('.ship-name strong')).toHaveText('Confirmed');
  await expect(row.locator('.status-col .badge')).toHaveText('needs attention');
  await expect(row).toContainText('Profile update failed');
  await expect(row.locator('.ship-name strong')).toHaveText('Confirmed');
  await expect(row.getByRole('button', {name: 'Landing app for ~zod'})).toBeDisabled();
  await expect(row.getByRole('button', {name: 'Edit endpoint ~zod'})).toBeDisabled();
  const state = await (await request.get(`${MOCK}/~/scry/manor/state.json`)).json();
  expect(state.managed.ships[0].claim).toEqual(claim);
  expect(state.managed.ships[0].blocked).toBe(false);
  expect((await (await request.get(`${MOCK}/pokes`)).json()).map(p => p.kind)).toEqual(['ship-profile']);
  await page.setViewportSize({width: 390, height: 844});
  await expect(row.getByText('Profile update failed', {exact: true})).toBeVisible();
  await expect(row.locator('.mobile-status .badge')).toHaveText('needs attention');
  await poolOf(page).screenshot({path: 'test-results/managed-profile-attention-mobile.png'});
});

test('endpoint updates and reconnects preserve legacy transport and imported app configuration', async ({page, request}) => {
  const legacy = managedRow('~zod', {transport: 'manor-moon', landing: 'glurff', required: ['glurff'], generation: 7});
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [legacy], controlled: {controller: '~siglup', landing: 'glurff', required: ['glurff'], generation: 7}}});
  await page.goto('/');
  const row = rowOf(page, '~zod');
  await page.locator('.managed-role > summary').click();
  const local = page.getByRole('region', {name: /^This ship:/});
  await expect(local).toContainText('~siglup');
  await local.getByRole('button', {name: 'Visitor settings for this ship'}).click();
  await expect(page.getByRole('dialog').getByLabel('Landing app')).toHaveValue('glurff');
  await expect(page.getByRole('dialog').getByText('Advanced readiness checks')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', {name: 'Cancel'}).click();
  await row.getByRole('button', {name: 'Reconnect ~zod'}).click();
  await expect(row.getByRole('button', {name: 'Upgrade ~zod'})).toBeVisible();
  await row.getByRole('button', {name: 'Edit endpoint ~zod'}).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Connection', {exact: true}).selectOption('https');
  await dialog.getByLabel('Endpoint host').fill('ship.example.com');
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  await expect(row).toContainText('https://ship.example.com:443');
  let state = await (await request.get(`${MOCK}/~/scry/manor/state.json`)).json();
  expect(state.managed.ships).toHaveLength(1);
  expect(state.managed.ships[0]).toMatchObject({transport: 'manor-moon', landing: 'glurff', required: ['glurff'], generation: 7});
  await expect(page.locator('body')).not.toContainText('manor-moon');
  await expect(page.locator('body')).not.toContainText(/Full moons?/i);
  await row.getByRole('button', {name: 'Edit endpoint ~zod'}).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Endpoint host')).toHaveValue('ship.example.com');
  await dialog.getByLabel('Connection', {exact: true}).selectOption('local');
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  await expect(row).toContainText('127.0.0.1:8101');
  state = await (await request.get(`${MOCK}/~/scry/manor/state.json`)).json();
  expect(state.managed.ships[0].endpoint).toBeNull();
  await row.getByRole('button', {name: 'Edit endpoint ~zod'}).click();
  await request.post(`${MOCK}/managed-fixture`, {data: {ships: [{...legacy, claim: {entered: 1}}]}});
  await expect(page.getByRole('dialog').getByRole('button', {name: 'Save', exact: true})).toBeDisabled();
  expect(await (await request.get(`${MOCK}/pokes`)).json()).toEqual([
    {kind: 'ship-reconnect', value: {who: '~zod'}},
    {kind: 'ship-add', value: {who: '~zod', endpoint: {host: 'ship.example.com', port: 443, secure: true}}},
    {kind: 'ship-add', value: {who: '~zod', endpoint: null}},
  ]);
});
