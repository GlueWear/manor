# manor

A public front door for [Theseus](https://github.com/GlueWear/theseus) moons.
Share one link. A visitor passes a (silly) proof-of-human page, gets a moon of
their own from a pool of running moons, and lands in it already logged in, at
a page you choose, such as Glurff. They never see the moon's `+code`. After a
demo you reset the used moons to a clean snapshot.

Manor is an Urbit app, `%manor`, that sits next to `%theseus` on the same
ship. The only thing outside Urbit is [Caddy](https://caddyserver.com), which
gives each moon its own secure web address.

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

## Setting it up

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

`%manor` needs `%theseus` on the same ship, with the `%theseus-session` poke
(Theseus at commit `876e2ef` or later).

The tile icon is a temporary placeholder.

## License

MIT
