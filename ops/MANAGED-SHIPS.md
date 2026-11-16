# Managed Ships

Install the same `%manor` desk and agent on the controller and managed
ships. A ship can manage a pool and be paired to another controller. These
roles are independent; pairing grants ship-local control, not access to
the controller's pool or private admin state.

Registration accepts galaxies, stars, planets, moons and comets. A managed
ship need not be a child of its controller. Messages travel over Ames.

## Installation

On each managed ship, create and mount `%manor` if needed:

```hoon
|new-desk %manor
|mount %manor
```

Copy the repository's `desk/` into the mount, then:

```hoon
|commit %manor
|install our %manor
:manor|pair ~your-controller
:manor|configure %glurff
```

Pairing and this ship's own configuration are under **Allow another Manor
to manage this ship** in the Manor page. These are not the controller's
pool settings. A fresh installation requires Landscape only by default.
Glurff and Noltbook are not mandatory. Noltbook must be running to edit
that ship's profile.

Pairing sends a connection request to the chosen controller. Its owner
opens **Ships -> Connection requests**, reviews the identity and
web connection, then chooses **Approve** or **Reject**. Approval registers
the ship in a locked state; **Unlock** is still required before sharing.
Both owners must consent: the request alone never grants access or creates
a visitor session. `%ship-add` remains available as an admin action for
manual registration.
Already registered ships do not create duplicate requests on reload.
Their reload notices refresh the status and app feeds instead.

## Landing Apps

Each managed ship's settings button offers its running web apps. The list
comes from that ship's authenticated `/apps` subscription, not from the
controller's desks or a hard-coded app list. The read-only feed uses Clay's
public tire and docket-presence scries and updates on Kiln changes.

The landing app is always a readiness requirement. Additional requirements
are preserved but appear only under **Advanced readiness checks**. Changing
the landing app removes the previous landing requirement while preserving
explicit extra requirements. The list is unavailable until the managed
ship runs this version of Manor; no host apps are substituted in its place.

Reload and Reconnect replace any existing status subscription before
opening a fresh one. Gall retains outgoing watches across agent updates;
trying to open the same wire twice would leave the row disconnected after
its readiness was cleared. Refreshing status does not free a reservation
or revoke browser sessions.

Update the controller first, then the managed ships. Notices are sent on
pairing and agent reload, not by a refresh timer. Repeating the local Pair
action can resend a request after a controller update.

## Browser Routing

Ames locates an Urbit peer, not its web server. Choose how Caddy reaches it:

- **Reported local port:** the ship runs on Caddy's machine. Manor pins the
  reported port and Caddy uses `127.0.0.1:<port>`.
- **Remote HTTPS:** supply a reachable hostname and port. Caddy verifies the
  normal TLS certificate; there is no insecure-TLS override.
- **Loopback HTTP tunnel:** create a tunnel separately and supply its
  `localhost` or `127.0.0.1` port on Caddy's machine.

Manor does not create tunnels or change router/firewall settings. Remote
plaintext HTTP is refused. Effective endpoints must be distinct, although
different remote ships can report the same internal Eyre port. Caddy checks
`/~/host` against the registered identity and forwards only that ship's
cookie. Endpoint changes and agent upgrades require no active visitor
claim or pending operation.

Caddy uses fresh upstream HTTP connections for controller requests. This
avoids stalled pooled Eyre connections observed during agent/gateway
upgrades. Ship/app transports and long-lived event streams are unchanged;
closing an event stream still cancels its upstream request.

## Reuse Policy

New Manor-assigned visits automatically unlock when the last tracked
browser tab closes. Idle eviction is **off by default**; backgrounding a tab
or losing its streaming connection does not count as closing it. Unused invitation links
still expire after two minutes; that does not evict an entered visitor.

The updated generated Caddyfile serves a small, full-window visitor wrapper
on managed ship app pages. Apps and their traffic still go directly to the
ship. The wrapper sends an open notification, a close beacon, and one small
connection heartbeat per minute using the existing open route. There is no
fleet/status polling and heartbeats do not trigger admin-page refreshes. Four
minutes without a heartbeat retires that tab; the normal 30-second final-tab
grace then applies. App navigation and refresh do not release the ship;
each top-level tab has a separate identity. Closing the last one starts a
30-second grace period. Opening a new tab during that period cancels it.
Only confirmed session revocation makes the ship free again. No apps,
files, profiles or networking keys are erased or changed.

A successful login starts a four-minute first-page registration grace period.
The first valid open notification cancels it. If no page registers, normal
confirmed logout and its offline/busy retry policy apply. A close beacon that
arrives before its open notification uses the shorter 30-second close grace.
On upgrade/reload, existing entered visits with no previously seen tabs and no
deadline receive a fresh four-minute grace period. Reloads do not extend an
already armed deadline, and already tracked visitors are not enrolled this way.

Close signals and timers are bound to the current visit generation. Old
tabs cannot unlock a newer visitor's reservation. A browser crash or an OS
shutdown may not deliver a close signal; the connection lease recovers that case
for newly opened visitor pages. Older pages retain their existing behavior until
reloaded. Manual **Unlock** remains available. Failed or indeterminate revocation
leaves the ship claimed and automatic cleanup retries once per minute, or when
the ship reports that it is available again.
The page shows **closing**, then **unlocking**, then **free** as pushed
updates.

For optional idle eviction, enable **Auto-unlock idle visitors** under
**Public access**, choose a limit (2-1440 minutes; suggested 15), and select
**Save timeout**. A server-side Behn timer controls the visit. One minute
before expiry, each tracked tab displays a countdown and **Stay connected**.
Pointer, keyboard, touch and scrolling input in any same-origin app frame
extends the shared deadline. App background work, incoming messages and
voice calls without input do not count as activity. Cross-origin embedded
pages cannot expose their input; use **Stay connected** when warned.

Policy and ending events are pushed over an authenticated event stream.
Connection heartbeats never extend this human-activity deadline. Input reports
are throttled and a single state read
checks expiry if a push was missed. Reconnecting the stream never extends
a visit. Expiry asks connected, current wrappers to remove their app frames,
requests Eyre session revocation, and holds the claim until that revocation
is confirmed. This does not revoke credentials issued by external services.
An offline ship or failed revocation remains unavailable until a queued retry
confirms logout. Stopping one managed ship does not release or block another.

Update Manor and reload the newly generated Caddyfile before enabling idle
eviction. All open tabs must support the warning/activity protocol: old
visitor tabs protect the visit from idle eviction until refreshed or closed.
Upgrades preserve claims and close tracking, and start with idle disabled.
Turning it off cancels pending idle timers without releasing visitors.

Existing visits are not enrolled or evicted during upgrade. This feature
starts with new assignments after updating Manor and reloading the generated
Caddyfile. The optional virtual Theseus fleet keeps its existing manual
release/reset behavior.

Profile updates no longer occupy the login/logout work slot. The confirmed
profile result carries the ship's fresh status, so saving a name or picture
does not require Unlock to restore readiness and does not change a visitor's
reservation. State %9 preserves the %8 pool, visits and idle configuration;
only newly opened wrappers opt into connection leases.

Unlock signs out owner sessions and frees the claim only after revocation
is confirmed. Apps, files, profiles and networking keys remain unchanged.
Failed or indeterminate revocation keeps the claim held. Clearing visitor
data is a separate reset operation, not Unlock.

**Known limitations:** active movement has been reported to trigger an idle
warning; leave idle eviction disabled for production use until verified in
the relevant apps/browsers. A Free row is not proof that every previous app
connection has ended. Glurff relay connections may outlive Eyre logout if
the browser does not close them. App/service-side disconnection and old
credential invalidation are separate integration work, not part of this
release. Do not treat browser-wrapper cleanup as a security boundary for
reassigning a ship to an untrusted visitor.

**Remove** requires no reservation or pending work. For a retired ship
that cannot answer Unlock, use **Forget ship** and confirm the warning.
This owner-only override clears the local registration, reservation and
pending requests, and cancels their subscriptions/timers. Other ships and
claims are untouched. It does not revoke remote sessions, stop a process,
delete a pier or contact the ship for an unlock acknowledgement. Do not use
it to free a ship for another visitor; use confirmed Unlock for that.

Names and external picture URLs are edited through the managed ship's
Noltbook API. Work and confirmation appear through pushed updates. Uploaded
picture files for independent ships are not added in this phase.

## Existing Installation

State `%8` preserves Manor's existing `%0`-`%7` pools, claims, paired
controller, app catalogs and pending connection requests. Upgraded installs
keep the Theseus visitor pool selected until the owner explicitly saves a
different selection. The `%6` upgrade also preserves the saved visitor-pool
selection and does not start tracking existing visits. Fresh installs start with managed ships and no public
address. Rows from
`%2` retain the legacy companion transport until deliberately switched.
This lets the controller update without disconnecting a running test.

For a ship still running the legacy companion:

1. Install the unified `%manor` desk on it. On first installation, an idle
   local legacy companion's controller, landing app, required apps and
   generation are imported. Check **This ship**; pair/configure explicitly
   if import was unavailable.
2. Manually unlock the ship if it has an active visitor claim.
3. In the controller, choose **Upgrade** to switch that row to `%manor`.
4. Verify status, local lever -> Glurff, then Unlock again.
5. Only after verification, retire the old companion installation.

The old `moon-desk/` remains a legacy fixture and rollback reference, not an
additional agent for new installations. Do not remove a working legacy
agent before its replacement is installed, paired and verified.

## Local Trial

With no public address saved, choose **Managed ships**, **Save settings**,
then **Download Caddyfile**. The file is `Caddyfile.managed-local`; run it alongside
production Caddy, and open `http://join.localhost:8091/`. Old `/public/full/`
routes remain transition aliases. A separate local preview still works
alongside a saved public configuration. Existing Caddy processes are never
changed automatically.

This section remains visible without Theseus. The single download changes
with the saved visitor pool and address. Its selector does not reload
production Caddy. The optional
Theseus section retains its saved fleet when its agent is unavailable.

## Public HTTPS

1. Update `%manor` on the controller and managed ships. Pair, approve and
   confirm readiness as above. Unlock only ships intended for visitors.
2. Point `join.<address>` and the registered ships' `<ship>.<address>` DNS
   names to the Caddy machine's public IP. A wildcard DNS record is fine;
   Caddy routes only the explicitly registered ship names.
3. In **Public access**, select **Managed ships**, enter the domain without
   `join.` (for example `example.com`), and **Save settings**. Landing apps
   remain the individual ship settings, not a shared hard-coded app.
4. Set the HTTPS/test/admin ports under **Connection settings**. Download
   the Caddyfile and validate it with
   `caddy validate --config Caddyfile --adapter caddyfile`.
5. Back up the active configuration. Forward public TCP 443 to Caddy's
   HTTPS port, then gracefully reload the intended Caddy process with
   `caddy reload --config Caddyfile --adapter caddyfile --address localhost:2020`
   (substitute its configured local admin address). Do not start a second
   public Caddy on the same ports.
6. Open `https://join.<address>/` from another network. An assignment should
   redirect to an exact registered ship's HTTPS address, then its landing
   app. The ticket works once. Confirm normal app use, then manually Unlock
   that test ship before sharing it again.

The join address exposes only the gate, its image and assignment route.
It never exposes the controller's login, apps or scries. Caddy pins each
upstream identity with `/~/host`, strips authorization and unrelated
cookies, and supplies the authority Manor validates. Public session cookies
are host-only, HttpOnly, SameSite=Lax and Secure. Certificates are approved
only for the join address and the selected pool's registered ships.

Visitors still receive an owner session on their dedicated ship, not an
app-only sandbox. Unlock revokes sessions; it does not wipe apps, files or
profiles. Idle eviction is optional and disabled until the owner enables it.

## Verification

```sh
python3 -m unittest discover -s ops -p 'test_*.py' -q
python3 ops/check_bootstrap.py '~pilfep-sicted-mignes-magtel'
python3 ops/check_bootstrap.py '~pilfep-sicted-mignes-magtel' --profile
python3 ops/check_unified.py '~pilfep-sicted-mignes-magtel' --component local --tests
python3 ops/check_unified.py '~pilfep-sicted-mignes-magtel' --component pool --tests
python3 ops/check_unified.py '~pilfep-sicted-mignes-magtel' --component interface --tests
python3 ops/check_unified.py '~pilfep-sicted-mignes-magtel' --tests
cd ui
npm test
npm run test:e2e
npm run build
```

Hoon checks run in memory on the managed test ship and deliver no cards.
The agent tests deliver the actual Dojo generators' raw command pages to
the receiver, not only hand-built typed actions. `%say` products must not
wrap those command nouns in an extra vase.
The bootstrap regression uses real Gall reads of absent optional agents;
it does not mock away the bootstrap arm. A missing legacy companion must
not block installation or state loading. Noltbook profile reads are also
skipped when Noltbook is not running.
The `--profile` check is for a test ship with Noltbook installed: it reads
the real `/api/profile/<ship>` route and constructs a status fact without
changing the profile or delivering cards. It does not make Noltbook a
requirement for other Manor installations.
The operator still runs live desk commits. Do not compile on the controller
to diagnose small components.
