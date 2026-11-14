# Full-moon pool: local trial

This is the legacy `%2` checkpoint. The current agent and general ship
registration are documented in [MANAGED-SHIPS.md](MANAGED-SHIPS.md).
Existing rows are migrated without dropping their claims. There is no
idle eviction in the current design.

This trial is separate from Manor's public Theseus pool. Adding a full moon
does not connect a different Theseus fleet, replace claims, restore a moon,
change networking keys, or change the production Caddy process.

## Stage the host desk

Copy `desk/` into the host's mounted `%manor` desk. The owner runs:

```hoon
|commit %manor
```

The agent migrates saved state `%0` or `%1` to `%2`, preserving the existing
Theseus pool, fleet, claims, settings, activity and last public visit. The
new full-moon registry starts empty. A failed state load does not initialize
an empty pool.

## Connect the test moon

The independent moon must already run `%manor-moon`, paired to this host.
See [MOON-COMPANION.md](MOON-COMPANION.md). On the Manor admin page:

1. Under **Full moons**, choose **Add full moon** and enter the full `@p`.
2. Wait for its web port and connected status. Manor obtains these over Ames
   and pins the first accepted port. A different controller, identity,
   duplicate port or changed port makes the moon unavailable.
3. Choose its **Unlock** action once. This signs out all owner browser
   sessions on that moon. The moon becomes free only after the companion
   confirms revocation. Apps, data and networking keys are preserved.

The first test moon is `~pilfep-sicted-mignes-magtel`, web port `8101`, paired
to `~siglup-narwet`. It is a moon of `~mignes-magtel`; explicit pairing, not
an assumption about parentage, authorizes this controller.

## Run the isolated front door

Under **Full moons -> Local preview**, download `Caddyfile.full-local`.
The default listener is `127.0.0.1:8091`, separate from the existing Caddy
test port `8090`. In the folder containing the downloaded file:

```sh
caddy run --config Caddyfile.full-local --adapter caddyfile
```

Open `http://join.localhost:8091/`. Pull the lever and enter the assigned
moon. Manor consumes the one-time ticket before requesting a session, then
sets the moon's cookie and redirects to its companion's landing desk
(normally `/apps/glurff/`). Subsequent pages go directly to that moon's
pinned loopback port, not through Theseus. Caddy forwards only that moon's
own login cookie. Unknown names and host-admin paths return 404.

The local-only endpoints additionally require a loopback request and a
`.localhost:<port>` forwarded host. They cannot use the public address to
assign full moons. The production Caddyfile is intentionally unchanged.

## Acceptance

- The existing public Theseus pool and its claims are unchanged.
- The lever enters the full moon without asking the visitor for `+code`.
- Glurff loads and can enter the world.
- Reusing the same ticket fails.
- While **Unlock** is pending, the claim remains held and no new visitor
  gets that moon. Only a confirmed `%revoked` reply frees it.
- After unlock, the old cookie no longer authorizes an owner-only request.
- Apps, files and the Noltbook profile survive unlocking.

If a login/revocation fails or times out, Manor quarantines the moon and
keeps its claim. A late reply is ignored. Reconnect does not clear the
quarantine: a successful unlock is required. Restarting Manor during a
request also requires unlock before reuse. Request deadlines are not
readiness polling and never count as successful revocation.

## Before public reuse

This is not yet the public full-moon pool. Revoking cookies does not prevent
a previous owner from logging in again with a retained `+code`. Web-code
rotation on release and a shared-machine isolation review remain required.
Automatic close/idle unlocking, UI profile editing and scaling to five moons
are later milestones.

## Verification

```sh
python3 -m unittest discover -s ops -p 'test_*.py' -q
python3 ops/check_pool.py '~pilfep-sicted-mignes-magtel' --agent
python3 ops/check_pool.py '~pilfep-sicted-mignes-magtel' --tests
python3 ops/check_pool.py '~pilfep-sicted-mignes-magtel' --agent --tests
cd ui
npm test
npm run test:e2e
npm run build
```

The Hoon checks evaluate the actual source on the managed test moon in
memory. Behavioral checks mock the host-port scry and inspect computed
cards; they do not deliver requests, change profiles or install agents.
Browser tests use a mock host. The Caddy test runs a disposable loopback-only
proxy and mock upstreams, not a real ship or production front door.
