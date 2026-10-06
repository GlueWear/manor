# manor

A public front door for [Theseus](https://github.com/GlueWear/theseus) moons.
Share one link. A visitor passes a (silly) proof-of-human page, gets a moon of
their own from a pool of running moons, and lands in it already logged in, at
a page you choose, such as Noltbook. They never see the moon's `+code`.

After a demo you recycle the used moons: each is restored to a clean snapshot
and goes back in the pool.

```
https://join.<base>/gate/         the trolley page; "Pull the lever"
  -> https://join.<base>/assign   the broker claims a free moon
  -> https://<moon>.<base>/broker the broker logs in with the moon's +code
                                  and sets only the moon's session cookie
  -> https://<moon>.<base>/apps/noltbook/
```

Moon pages travel `Caddy -> host Eyre /theseus/~<moon>/... -> the moon`, the
same route the Theseus web gateway uses.

## What's here

| File | What it does |
| --- | --- |
| `gate/` | The trolley page. "Pull the lever" goes to `/assign`. It checks nothing. |
| `broker.mjs` | Hands out moons (`/assign`), logs visitors in (`/broker`), and tells Caddy which names may get certificates (`/tls-ask`). |
| `pool.mjs` | Manages the pool: add moons, read their codes from the host, recycle after demos. |
| `Caddyfile` | Public HTTPS for `join.<base>` and `<moon>.<base>`, plus the same routes on `http://join.localhost:8090` for testing. |
| `manor` | Starts, stops and checks it all; installs launchd agents. |
| `state/` | `pool.json` (moon codes), `claims.json`, `host-code`. Private, never in git. |

## Setting it up

You need a Theseus host (a planet running `%theseus`), Node 20 or newer,
Caddy 2.7 or newer (tested with 2.11), and a router that can forward a port to
this machine.

1. **Settings.** `cp manor.env.example manor.env` and fill it in: the host
   ship, its pier, and `MANOR_BASE`. With nip.io the base is your public IP
   with dashes (`curl -s https://api.ipify.org`, then `203.0.113.7` becomes
   `203-0-113-7.nip.io`).

2. **The host's +code.** Run `+code` in the host's Dojo and save it:

   ```sh
   mkdir -p state && chmod 700 state
   printf '%s\n' 'sampel-ticlyt-migfun-falmel' > state/host-code   # yours
   chmod 600 state/host-code
   ```

   `pool.mjs` uses it to log into the host. It is full access to the host:
   keep it private.

3. **The pool.** In the Theseus console:
   - **Boot Fleet** with the moons you want, choosing the desks visitors
     should have (e.g. `%noltbook`; Landscape comes with it). Wait until every
     desk shows running.
   - For each moon, open **Snapshots of ~moon**, take a snapshot named e.g.
     `clean-1`, with "keep running" checked. Recycling restores it.

   Then add each moon with its snapshot:

   ```sh
   node pool.mjs add ~moon-name --snapshot /clean-1
   node pool.mjs list
   ```

4. **The router.** Forward public TCP **443** to this machine's
   `MANOR_HTTPS_PORT` (8443). Port 80 is not needed.

5. **Run it.**

   ```sh
   ./manor check      # settings, host, Caddy config, pool
   ./manor start      # or ./manor install to run under launchd
   ```

   Try it on this machine at <http://join.localhost:8090/>. Try the public
   link from a phone on cellular: home routers often cannot reach their own
   public address from inside. The first visit to each name takes a few
   seconds while Caddy fetches its certificate.

## After a demo

```sh
node pool.mjs list                        # who has what
node pool.mjs recycle --claimed           # what would be recycled
node pool.mjs recycle --claimed --execute
```

Recycling a moon:

1. holds it back from `/assign`;
2. restores its clean snapshot on the host;
3. waits until Theseus has finished the restore and the moon is running;
4. saves the moon's **new** `+code`. A restore gives the moon new keys, and
   its code comes from its key, so the old code stops working;
5. frees the moon.

A moon whose recycle fails stays held back, shown as `recycle-error` with the
reason in `node pool.mjs list`. Fix the cause, then recycle it again or
`node pool.mjs release ~moon`.

## How it behaves

- **One moon per lever pull.** The first free moon in the pool is claimed.
  When none are free, visitors see "All moons are taken right now."
- **One-time links.** `/assign` sends the visitor to their moon with a
  ticket that works once, within two minutes. Knowing a moon's address is not
  enough to log into a moon handed to someone else. A ticket nobody used frees
  its moon again. A visitor who already has the moon's session cookie goes
  straight in.
- **Visitors own their moons.** The session they get is the moon's owner
  session. Give pool moons only the desks you want visitors to have.
- **Certificates only for pool names.** Caddy asks the broker before
  fetching a certificate, so only `join.<base>` and pool moons get one, and
  adding a moon to the pool needs no Caddy change. Caddy also requires the
  Host header to match the certificate's name.
- **Codes stay private.** Codes live only in `state/` (mode 600). Nothing
  prints or logs them.

## Operating

| Task | Command |
| --- | --- |
| Status / logs | `./manor status`, `./manor logs` |
| The host restarted (its Eyre port may have changed) | `./manor restart` |
| Run at login, restart on failure | `./manor install` (remove with `./manor uninstall`) |
| A moon's code is out of date (e.g. restored by hand in the console) | `node pool.mjs refresh ~moon` |
| Take a moon out | `node pool.mjs remove ~moon` |
| Trial certificates without rate limits | set `MANOR_ACME_DIR` to Let's Encrypt staging in `manor.env` |

| Visitors see | Cause | Fix |
| --- | --- | --- |
| "All moons are taken right now." | Every moon is claimed | Recycle after the demo, or add moons |
| "Your moon is not ready yet." | The moon refused its saved code | `node pool.mjs refresh ~moon` |
| A certificate error | Port 443 not forwarded, or a name outside the pool | Check the router; `node pool.mjs list` |
| 502 on a moon page | The host is down or moved to another Eyre port | Start the host; `./manor restart` |

## Tests

```sh
npm test
```

They run the broker and `pool.mjs` against a mock Theseus host: assigning,
one-time links, logging in, certificate approval, adding moons, and
recycling.
