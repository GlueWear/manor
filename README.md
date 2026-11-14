# manor

A visitor pool for Urbit ships, with optional
[Theseus](https://github.com/GlueWear/theseus) integration.
Share one link. A visitor passes a (silly) proof-of-human page, gets a ship
from your pool, and lands in it already logged in at an app you choose,
such as Glurff. They never see the ship's `+code`. Independent ships are
manually unlocked for reuse; virtual Theseus fleets can also be reset to
a clean snapshot. Unlock does not erase visitor data.

Manor is an Urbit app, `%manor`, installed on the controller and the
independent ships it manages. Theseus is optional, for virtual fleets.
[Caddy](https://caddyserver.com) runs outside Urbit and gives each visitor
ship its own secure web address.

```
your ship
├─ %theseus   moons, fleets, snapshots, restores, visitor sessions
└─ %manor     the pool, who has which moon, the lever page, the admin page

next to it, outside Urbit
└─ Caddy      HTTPS for join.<address> and <moon>.<address>
```

## What a visitor sees

```
https://join.<address>/                the lever page; "Pull the lever"
  -> join.<address>/assign             %manor claims a free, ready moon
  -> <moon>.<address>/~manor/enter     %manor logs them in to the moon
  -> <moon>.<address>/apps/glurff/     their moon
```

A ticket in the link works once, for two minutes, so knowing a moon's address
is not enough to get into someone else's. Only moons that Theseus says are
ready go out: running, not paused or being restored, and every desk caught up
with its source.

## Managed Ships

The same `%manor` agent runs on controllers and managed ships. Explicit
pairing grants control; a ship may have both roles. Galaxies, stars, planets,
moons and comets can be registered, without a parent-child relationship.
The managed pool has manual Unlock, Noltbook name/picture-URL controls,
landing-app configuration and local/HTTPS/tunnel endpoint settings. There is
no idle eviction or automatic browser-close eviction.

The page opens on **Ships**. Each ship's settings button selects its
landing app from that ship's running web apps. Extra readiness dependencies
are optional under **Advanced readiness checks**. Storage-only desks are
not offered as landing apps.

**Public access** keeps the address and one Caddyfile download visible,
even with Theseus suspended. Choose the visitor pool and **Save settings**.
Managed ships with a saved public address produce an HTTPS configuration;
without an address they produce a loopback-only test configuration. Theseus
fleets retain their existing routing. Saving selects the pool in Manor,
but does not reload the running Caddy process.

**Allow another Manor to manage this ship** contains controller pairing
and this ship's own visitor settings. It is separate from configuring the
ships that this Manor manages.

Pairing sends a connection request to the chosen controller. Its owner
reviews it under **Connection requests** and chooses **Approve**; new ships
still require **Unlock** before they can receive visitors. Manual
registration remains supported through the `%ship-add` admin action.

For a retired or deleted ship, **Forget ship** removes only its Manor
registration, reservation and pending requests. It does not need a remote
unlock, stop or delete the actual ship, or revoke existing browser sessions.

See [ops/MANAGED-SHIPS.md](ops/MANAGED-SHIPS.md) for deployment, migration,
local testing and public HTTPS setup. Upgrades preserve the existing
visitor pool until explicitly changed. Visitor sessions are ship-owner
sessions, not an app-only sandbox; reuse does not erase visitor data.

The optional `./manor ship` supervisor manages independent Vere processes.
Its older `./manor moon` spelling remains an alias; existing jobs and piers
are not renamed. Existing comets can be adopted rather than provisioned from
a moon key.

## Theseus Setup

You need a planet running `%theseus`, Caddy 2.7 or newer, and a way in from
the internet: a router that can forward a port to the machine running your
ship, or a server with a public address. Ships hosted by a provider can't run
Caddy next to them.

1. **Install `%manor`.** From this repo: create a desk and copy `desk/` into
   it, then commit and install it.

   ```
   |new-desk %manor
   |mount %manor
   ```
   Copy `desk/*` into the mounted `manor` folder, then:
   ```
   |commit %manor
   |install our %manor
   ```

2. **A fleet and its snapshot.** In Theseus, boot a fleet with the desks
   visitors should have. Don't choose `%noltbook-data`: Noltbook makes its own,
   and choosing it copies yours, with every file you uploaded. Wait until every
   moon is ready, then take a fleet snapshot (the fleet's camera button).

3. **The Manor page** (its tile, or `/apps/manor`):
   - **Connect a fleet:** choose the fleet and its snapshot.
   - **Settings:** the public address, and the landing page, e.g.
     `/apps/glurff/`. With nip.io the address is your public IP with dashes:
     `curl -s https://api.ipify.org`, then `203.0.113.7` becomes
     `203-0-113-7.nip.io`.
   - **Front door:** choose the HTTPS port Caddy listens on, then download
     the Caddyfile. It is made for your ship: its Eyre port, the address, and
     only the routes Manor needs.

4. **Caddy.** Install it once (`brew install caddy` on a Mac, your package
   manager on Linux, caddyserver.com on Windows). Save the Caddyfile next to
   it and run `caddy run --config Caddyfile --adapter caddyfile`. On a Mac,
   from this repo, `./manor start` does it, and `./manor install` runs it at
   login.

5. **The router.** Forward public TCP 443 to that machine's HTTPS port.
   Port 80 is not needed: certificates use the TLS-ALPN challenge.

Try it on that machine at `http://join.localhost:8090/`, then the public link
from a phone on mobile data: home routers often can't reach their own public
address from inside. Each name's first visit takes a few seconds while Caddy
fetches its certificate.

## Running demos

The Manor page shows every moon: free, link sent, in use since, resetting,
catching up, or needing attention.

- **Reset used moons** after a demo: Theseus restores each one from the
  snapshot with new keys, and it goes out again once it is ready. A bar
  shows how many are ready, still restoring or catching up, or failed.
- **Reset fleet**, or reset, free or remove one moon.
- **Change fleet** to switch to another fleet and snapshot.
- **Names and pictures:** each moon shows its full `@p`, and its Noltbook
  name and picture when it runs Noltbook. Click a Noltbook moon's name or
  picture to change them: a name, a picture file (shrunk to 128 pixels and
  uploaded into the moon through Theseus) or a picture address. A change
  made anywhere, here, in Theseus or in Noltbook itself, shows on every open
  page without a reload: Theseus pushes it. A reset brings back the
  snapshot's name and picture.

The page updates as things happen, with no refresh timer: `%manor` and
Theseus tell it when something changes, such as a visitor pulling the lever,
a reset finishing, or a name changing. It lists recent activity: who got
which moon, resets, and anything that failed.

## How it is kept safe

- **Only Manor and moons are public.** The Caddyfile forwards only
  `/apps/manor/public/*` on the join address, `/~manor/enter` on a moon's
  address, and the moon's own pages through Theseus. Your ship's login, apps
  and scries are never reachable through it.
- **Certificates only for pool names.** Caddy asks `%manor` before fetching
  one: only the join address and pool moons get one, and each moon's
  certificate carries requests for that moon only.
- **Codes stay on the ship.** `%manor` never sees a moon's `+code`. To log a
  visitor in, it asks `%theseus` for a session (`%theseus-session`), which
  Theseus opens inside the moon. A reset ends every session made since the
  snapshot.
- **Moons can't see your login.** Theseus passes a moon only its own login
  cookie, so a moon can't read or replace your ship's.
- **Visitors own their moons** until you reset them. Give pool moons only the
  desks you want visitors to have.

## Development

### Managed ships

`./manor ship` manages independent ship piers with one macOS LaunchAgent per
ship, fixed HTTP/Ames ports, private key staging and redacted logs. The old
`./manor moon` spelling remains an alias. See
[ops/FULL-MOONS.md](ops/FULL-MOONS.md) for setup, lifecycle commands and the
live acceptance checklist. It requires Python 3.9 or newer.

Install the same `%manor` desk on controller and managed ships. Pairing is
explicit; a managed ship authorizes its controller over Ames. A ship can
also manage its own pool. See [ops/MANAGED-SHIPS.md](ops/MANAGED-SHIPS.md)
for role permissions, endpoint routing, public hosting and upgrade
instructions. Existing `%manor-moon` registrations remain supported during
the transition; `moon-desk/` and its documents are legacy references, not a
second agent required for new installations. Theseus remains available as
an optional visitor pool. Use dedicated visitor ships: owner sessions are
not restricted to the landing app.

The existing `./manor start|stop|status` commands still control Caddy.

Run manager tests with `python3 -m unittest discover -s ops -p 'test_*.py' -v`.

| Path | What |
| --- | --- |
| `desk/` | the `%manor` desk: `app/manor.hoon`, `sur/manor.hoon`, `mar/manor/action.hoon`, the lever page `web/gate.html`, and the built admin page `web/manor.html` |
| `ui/` | the admin page (React), built into `desk/web/manor.html` |
| `manor` | runs Caddy with `./Caddyfile` on macOS: start, stop, status, logs, launchd |

```sh
cd ui
npm install
npm test            # page logic, and the Caddyfile through caddy validate
npm run test:e2e    # the page against a mock host
npm run build       # writes desk/web/manor.html
```

Only virtual fleets need `%theseus` on the controller, with the
`%theseus-session` poke (Theseus at commit `876e2ef` or later). Independent
managed ships use the paired `%manor` agent and do not require Theseus.

The tile icon is a temporary placeholder.

## License

MIT
