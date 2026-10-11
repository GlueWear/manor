// What the admin page shows, from %manor's state and Theseus's view of the
// moons. No DOM here, so it can be tested on its own.

// An Urbit date (~2026.10.7..23.09.41..1a2b) as Unix ms.
export function daMs(value) {
  const match = /^~(\d+)\.(\d+)\.(\d+)\.\.(\d+)\.(\d+)\.(\d+)/.exec(value);
  return match ? Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]) : NaN;
}

// ~ritdex-sorled-siglup-narwet -> ~ritdex-sorled, for a moon of the host.
export function shortMoon(ship, host) {
  const tail = String(host || '').replace(/^~/, '');
  return tail && ship.endsWith(`-${tail}`) ? ship.slice(0, -tail.length - 1) : ship;
}

// Where a moon's picture loads from: an address as it is; a picture uploaded
// to Noltbook from the moon's own origin, with its version in the address so
// a new upload isn't hidden behind the old one in a cache. '' for none.
export function avatarSrc(avatar, origin, ship) {
  const url = typeof avatar?.url === 'string' ? avatar.url.trim() : '';
  if (/^https?:\/\//i.test(url)) return url;
  if (origin === undefined) return '';
  if (url.startsWith('/')) return `${origin}${url}`;
  if (avatar?.type === 'urbit') return `${origin}/apps/noltbook/user-avatar/${ship}${url ? `?v=${encodeURIComponent(url)}` : ''}`;
  return '';
}
// A moon's own origin through Theseus's gateway, or undefined without one.
export function moonOrigin(gw, ship) {
  if (!gw?.url || !['ok', 'external'].includes(gw.status)) return undefined;
  return gw.url.replace('{moon}', ship.replace(/^~/, '')).replace(/\/$/, '');
}
export function validateProfiles(data) {
  const ok = p => p && typeof p.ship === 'string' && typeof p.noltbook === 'boolean' && (p.name === null || typeof p.name === 'string') && (p.avatar === null || typeof p.avatar === 'object');
  if (!Array.isArray(data?.moons) || !data.moons.every(ok)) throw new Error('Theseus returned invalid profiles.');
  return data;
}

export const catchingUp = moon => (moon?.desks || []).some(d => d.stage === 'catching-up');
const deskFailed = moon => (moon?.desks || []).some(d => d.stage === 'failed');

// A pool moon's state. The claim says what a visitor has done with it;
// Theseus says whether it can take a visitor. Only "free" moons go out.
export function moonStatus(row, moon, now = Date.now()) {
  if (!moon) return {key: 'missing', label: 'not in Theseus', tone: 'bad'};
  if (moon.recovery) {
    return moon.recovery.stage === 'failed'
      ? {key: 'failed', label: 'reset failed', tone: 'bad', detail: moon.recovery.reason || undefined}
      : {key: 'resetting', label: 'resetting', tone: 'busy'};
  }
  const claim = row.claim;
  if (claim?.entered) return {key: 'in-use', label: 'in use', tone: 'used', since: claim.entered};
  if (claim?.expires && claim.expires > now) return {key: 'link-sent', label: 'link sent', tone: 'used', until: claim.expires};
  if (moon.status !== 'healthy') return {key: 'down', label: 'not running', tone: 'bad'};
  if (moon.paused) return {key: 'paused', label: 'paused', tone: 'warn'};
  if (deskFailed(moon)) return {key: 'desk-failed', label: 'needs attention', tone: 'bad'};
  if (catchingUp(moon)) return {key: 'catching', label: 'catching up', tone: 'busy'};
  return {key: 'free', label: 'free', tone: 'ok'};
}

// Moons a visitor has had, or been sent a link to: reset these after a demo.
export const usedMoons = pool => pool.filter(row => row.claim).map(row => row.ship);

// The snapshots that can reset every moon of a fleet: a set holding a
// snapshot of each, or one moon's own. Newest first.
export function snapshotChoices(fleet, snapshots) {
  if (!fleet) return [];
  const sets = new Map();
  for (const snap of snapshots) {
    const key = snap.set || snap.path;
    const entry = sets.get(key) || {path: key, ships: new Set(), created: snap.created, compatible: true};
    snap.ships.forEach(ship => entry.ships.add(ship));
    if (!snap.compatible) entry.compatible = false;
    if ((daMs(snap.created) || 0) > (daMs(entry.created) || 0)) entry.created = snap.created;
    sets.set(key, entry);
  }
  return [...sets.values()]
    .filter(entry => fleet.ships.length > 0 && fleet.ships.every(ship => entry.ships.has(ship)))
    .sort((a, b) => (daMs(b.created) || 0) - (daMs(a.created) || 0));
}

// The public address moons hang off, e.g. 203-0-113-7.nip.io. Mirrors
// +valid-base in app/manor.hoon.
export function baseProblem(base) {
  if (base.length > 200) return 'Use at most 200 characters.';
  if (!/^[a-z0-9.-]*$/.test(base)) return 'Use lowercase letters, digits, dots and hyphens, like 203-0-113-7.nip.io.';
  return null;
}
// Where visitors land on their moon. Mirrors +valid-landing.
export function landingProblem(landing) {
  if (!landing.startsWith('/')) return 'Start with /, like /apps/glurff/.';
  if (landing.length > 200) return 'Use at most 200 characters.';
  if (/[^\x21-\x7e]/.test(landing)) return 'Use no spaces or special characters.';
  return null;
}
export const publicLink = base => base ? `https://join.${base}/` : null;

export function validateState(data) {
  const ok = data && Array.isArray(data.pool) && Array.isArray(data.log) && typeof data.settings?.base === 'string' && typeof data.settings?.landing === 'string';
  if (!ok) throw new Error('Manor returned an unexpected state.');
  return data;
}

// The front door: a Caddyfile for this ship. Caddy gives each moon its own
// HTTPS address and forwards only %manor's public paths and moon pages to
// the ship, never its own login, apps or scries.
export const FRONT_DEFAULTS = {httpsPort: 8443, localPort: 8090, admin: 'localhost:2020', staging: false};
export function frontProblem({httpsPort, localPort, admin}) {
  const port = p => Number.isInteger(p) && p > 0 && p < 65536;
  if (!port(httpsPort)) return 'Use an HTTPS port from 1 to 65535.';
  if (!port(localPort)) return 'Use a local test port from 1 to 65535.';
  if (httpsPort === localPort) return 'Use different HTTPS and test ports.';
  if (!/^[a-z0-9.-]+:\d{1,5}$/.test(admin)) return 'Give Caddy\'s admin address as host:port, like localhost:2020.';
  return null;
}
export function caddyfile({ship, eyre, base, httpsPort, localPort, admin, staging}) {
  const acme = staging ? 'https://acme-staging-v02.api.letsencrypt.org/directory' : 'https://acme-v02.api.letsencrypt.org/directory';
  return `# Manor's front door for ${ship}, made by its Manor page.
#
#   join.${base}    the lever page, served by %manor
#   <moon>.${base}  a visitor's moon: /~manor/enter logs them in, and the
#                   rest is the moon itself, through ${ship}'s /theseus/~<moon>
#
# Nothing else of ${ship} is reachable through here: not its login, apps or
# scries. Certificates are fetched as visitors arrive, only for names %manor
# approves (the join host and pool moons), over TLS-ALPN on port 443.
#
# Run it:  caddy run --config Caddyfile --adapter caddyfile
# Router:  forward public TCP 443 to this machine's port ${httpsPort}
# Test:    http://join.localhost:${localPort}/ on this machine
{
	admin ${admin}
	auto_https disable_redirects
	https_port ${httpsPort}
	# Eyre channels are long-lived streams; bound how long a reload waits.
	grace_period 10s
	servers {
		protocols h1 h2
		# a moon's certificate carries requests for that moon only
		strict_sni_host on
	}
	on_demand_tls {
		ask http://127.0.0.1:${eyre}/apps/manor/public/tls-ask
	}
}

(ship) {
	reverse_proxy 127.0.0.1:${eyre} {
		header_up Host localhost:${eyre}
		# only while ${ship} answers on this port; a busy ship can be slow,
		# so it counts as down only after three checks in a row go unanswered
		health_uri /~/host
		health_body "^${ship}$"
		health_interval 10s
		health_timeout 10s
		health_fails 3
	}
}

(routes) {
	# no climbing out of the paths below
	@escape path_regexp (^|/)\\.\\.(/|$)|%2[eE]
	handle @escape {
		respond 400
	}

	@join host {args[0]}
	handle @join {
		rewrite * /apps/manor/public{uri}
		import ship
	}

	# a moon's address starts with its name, e.g. ritdex-sorled-siglup-narwet
	@moon header_regexp moon Host ^(?P<ship>[a-z]{3,6}(?:-[a-z]{6})+)\\.
	handle @moon {
		handle /~manor/enter {
			rewrite * /apps/manor/public/enter/~{re.moon.ship}?{query}
			import ship
		}
		handle {
			rewrite * /theseus/~{re.moon.ship}{uri}
			import ship
		}
	}

	handle {
		respond 404
	}

	# the ship didn't answer for half a minute: say so, not a blank page
	handle_errors 502 503 504 {
		header Content-Type "text/html; charset=utf-8"
		header Cache-Control no-store
		respond <<HTML
			<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not answering</title>
			<body style="font-family:ui-sans-serif,-apple-system,sans-serif;text-align:center;padding:3rem 1.25rem;line-height:1.55;color:#1b1a17;background:#f6f5f1">
			<h2>Your moon isn't answering right now</h2>
			<p>Its ship is busy or restarting. Try again in a minute.</p>
			</body>
			HTML 503
	}
}

https:// {
	tls {
		on_demand
		issuer acme {
			dir ${acme}
			disable_http_challenge
		}
	}
	import routes join.${base}
}

http://:${localPort} {
	bind 127.0.0.1
	import routes join.localhost
}
`;
}
