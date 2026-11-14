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
  const url = typeof avatar === 'string' ? avatar.trim() : typeof avatar?.url === 'string' ? avatar.url.trim() : '';
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

// A reset request is asynchronous. Count only moons that Theseus reports
// ready, and surface both recovery failures and refusals from Manor's log.
export function resetProgress(run, rows, log = []) {
  if (!run) return null;
  const byShip = new Map(rows.map(row => [row.ship, row.status.key]));
  const refusals = new Set(log
    .filter(entry => !run.priorLogKeys.includes(`${entry.at}:${entry.text}`))
    .filter(entry => entry.text.startsWith('Theseus refused to reset '))
    .map(entry => entry.text.slice('Theseus refused to reset '.length).split('.')[0]));
  const total = run.ships.length;
  let ready = 0, restoring = 0, catching = 0, failed = 0;
  if (run.phase === 'tracking') for (const ship of run.ships) {
    const status = byShip.get(ship);
    if (refusals.has(ship) || status === 'failed' || status === 'missing') failed++;
    else if (status === 'free') ready++;
    else if (status === 'resetting') restoring++;
    else if (status === 'catching') catching++;
  }
  return {total, ready, restoring, catching, failed, waiting: total - ready - restoring - catching - failed,
    complete: run.phase === 'tracking' && ready + failed === total};
}

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
  if (data.pairRequests !== undefined && (!Array.isArray(data.pairRequests) || !data.pairRequests.every(row => row && !shipProblem(row.ship) && Number.isSafeInteger(row.at) && row.at >= 0 && row.at <= 8.64e15))) throw new Error('Manor returned invalid connection requests.');
  const validApps = apps => apps == null || (Array.isArray(apps) && apps.every(app => app && typeof app.desk === 'string' && /^[a-z][a-z0-9-]*$/.test(app.desk) && typeof app.running === 'boolean' && typeof app.web === 'boolean'));
  if (!validApps(data.controlled?.apps) || !(data.managed?.ships || []).every(row => validApps(row.apps))) throw new Error('Manor returned an invalid app list.');
  return data;
}

// Structural filtering only; %manor's /%p parser is authoritative.
export const shipProblem = ship => typeof ship === 'string' && /^~[a-z]{3,6}(?:-{1,2}[a-z]{3,6}){0,7}$/.test(ship) ? null : 'Enter an Urbit ship name, like ~zod or ~siglup-narwet.';
export const normalizeShip = value => `~${value.trim().replace(/^~/, '')}`;
export const validPort = port => Number.isInteger(port) && port > 0 && port <= 65535;
export function appConfigProblem({landing, required}) {
  const term = value => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
  if (!term(landing)) return 'Use an app name for the landing app, like landscape or glurff.';
  if (!Array.isArray(required) || !required.every(term)) return 'Use app names separated by commas for required apps.';
  if (new Set(required).size !== required.length) return 'List each required app only once.';
  return null;
}
export function externalAvatarProblem(value) {
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password && !/\s/.test(value)) return null;
  } catch { /* not a URL */ }
  return 'Use an external picture address starting with https:// or http://.';
}

export function managedShipStatus(row) {
  if (row.pending) return {key: 'working', label: {revoke: 'unlocking', session: 'logging in', profile: 'saving profile'}[row.pending] || 'working', tone: 'busy'};
  if (row.fault) return {key: 'failed', label: row.blocked ? 'unlock needed' : 'needs attention', tone: 'bad', detail: row.fault};
  if (!row.online) return {key: 'offline', label: 'not connected', tone: 'warn'};
  if (row.blocked) return {key: 'blocked', label: 'unlock needed', tone: 'warn'};
  if (row.claim && row.autoUnlockAt) return {key: 'closing', label: 'closing', tone: 'busy'};
  if (row.claim?.entered) return {key: 'in-use', label: 'in use', tone: 'used'};
  if (row.claim) return {key: 'link-sent', label: 'reserved', tone: 'used'};
  return row.ready ? {key: 'free', label: 'free', tone: 'ok'} : {key: 'starting', label: 'getting ready', tone: 'busy'};
}
export const fullMoonStatus = managedShipStatus;
export const managedRemovalKind = row => row.claim || row.pending ? 'ship-forget' : 'ship-remove';

// Only literal hostnames/IPs reach the Caddyfile, never URLs or directives.
export function managedEndpoint(row) {
  const endpoint = row.endpoint ?? {host: '127.0.0.1', port: row.port, secure: false};
  const {host, port, secure} = endpoint;
  const labels = typeof host === 'string' ? host.split('.') : [];
  const validHost = labels.length && host.length <= 253 && labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
  const validIp = !/^[0-9.]+$/.test(host) || (labels.length === 4 && labels.every(label => /^(0|[1-9][0-9]{0,2})$/.test(label) && +label <= 255));
  if (!validHost || !validIp || !validPort(port) || typeof secure !== 'boolean') throw new Error('Use a valid endpoint hostname and port (1-65535). Do not include a URL or path.');
  const normalized = host.toLowerCase();
  const loopback = ['localhost', '127.0.0.1'].includes(normalized);
  if (!secure && !loopback) throw new Error('Remote endpoints require HTTPS. HTTP is allowed only for localhost or 127.0.0.1 tunnels.');
  return {host: normalized, port, secure, key: `${loopback ? '127.0.0.1' : normalized}:${port}`};
}

function managedTargets({ship, eyre, ships, ports}) {
  if (shipProblem(ship) || !validPort(eyre)) throw new Error('Invalid controller address.');
  const endpoints = new Set([`127.0.0.1:${eyre}`, ...ports.map(port => `127.0.0.1:${port}`)]);
  const identities = new Set([ship]);
  return ships.map(row => {
    if (shipProblem(row.ship) || identities.has(row.ship)) throw new Error('Use a unique Urbit identity for each managed ship.');
    identities.add(row.ship);
    const endpoint = managedEndpoint(row);
    if (endpoints.has(endpoint.key)) throw new Error('Each ship needs a unique effective endpoint, distinct from the controller and preview listener.');
    endpoints.add(endpoint.key);
    return {...row, target: endpoint};
  });
}
// Keep controller requests off stale pooled Eyre connections after agent reloads.
const controllerTransport = `transport http {
          keepalive off
        }`;
function managedShipRoutes(targets, eyre, suffix) {
  const proxy = (row, cookie) => {
    const {host, port, secure} = row.target;
    return `reverse_proxy ${secure ? 'https://' : ''}${host}:${port} {
          header_up Host ${host}:${port}
          header_up X-Forwarded-Host {hostport}
          header_up -Authorization
          header_up -Proxy-Authorization
          ${cookie ? `header_up Cookie ${cookie}` : 'header_up -Cookie'}
          health_uri /~/host
          health_body "^${row.ship}$"
          health_interval 10s
          health_timeout 10s
          health_fails 3
        }`;
  };
  const visitor = (row, i) => [
    {name: 'Open', path: '/~manor/visit/open', tail: '/open'},
    {name: 'Close', path: '/~manor/visit/close', tail: '/close'},
    {name: 'Activity', path: '/~manor/visit/activity', tail: '/activity'},
    {name: 'Events', path: '/~manor/visit/events', tail: '/events'},
    {name: 'State', path: '/~manor/visit/state', tail: '/state'},
    {name: 'Page', tail: ''},
  ].map(({name, path, tail}) => `
    @visit${i}${name} {
      ${path ? `path ${path}` : 'method GET\n      path / /apps/*\n      header Sec-Fetch-Dest document'}
      header_regexp visit${i}${name} Cookie "(?:^|;[ ]*)(manor-visit=[^;]+)(?:;|$)"
    }
    handle @visit${i}${name} {
      rewrite * /apps/manor/public/managed/visit/${row.ship}${tail}
      reverse_proxy 127.0.0.1:${eyre} {
        header_up Host localhost:${eyre}
        header_up X-Forwarded-Host {hostport}
        header_up Cookie {re.visit${i}${name}.1}
        header_up -Authorization
        header_up -Proxy-Authorization
        ${controllerTransport}
        ${name === 'Page' ? 'header_down Cache-Control no-store\n        header_down Vary "Sec-Fetch-Dest, Cookie"' : ''}
      }
    }`).join('\n');
  return targets.map((row, i) => `
  @ship${i} host ${row.ship.slice(1)}.${suffix}
  handle @ship${i} {
    handle /~manor/enter {
      rewrite * /apps/manor/public/managed/enter/${row.ship}?{query}
      reverse_proxy 127.0.0.1:${eyre} {
        header_up Host localhost:${eyre}
        header_up X-Forwarded-Host {hostport}
        header_up -Cookie
        header_up -Authorization
        header_up -Proxy-Authorization
        ${controllerTransport}
      }
    }
${visitor(row, i)}
    handle {
      @cookie${i} header_regexp own${i} Cookie "(?:^|;[ ]*)(urbauth-${row.ship}=[^;]+)(?:;|$)"
      handle @cookie${i} {
        ${proxy(row, `{re.own${i}.1}`)}
      }
      handle {
        ${proxy(row)}
      }
    }
  }`).join('\n');
}
const privateLogs = `log default {
    format filter {
      wrap json
      fields {
        request>uri delete
        request>headers delete
        resp_headers delete
      }
    }
  }`;

// This config has no public listener and never routes through Theseus.
export function managedLocalCaddyfile({ship, eyre, ships, port = 8091}) {
  if (!validPort(port) || port < 1024 || port === eyre) throw new Error('Invalid local preview address. Use a test port from 1024 to 65535.');
  const targets = managedTargets({ship, eyre, ships, ports: [port]});
  const routes = managedShipRoutes(targets, eyre, 'localhost');
  return `# Manor managed ships LOCAL trial. No public listener, inbound TLS or admin port.
# Does not replace the production Caddyfile or public Theseus pool.
# http://join.localhost:${port}/
{
  admin off
  auto_https off
  grace_period 5s
  ${privateLogs}
}
http://:${port} {
  bind 127.0.0.1
  @escape path_regexp (^|/)\\.\\.(/|$)|%2[eE]
  handle @escape {
    respond 400
  }
  @join host join.localhost
  handle @join {
    handle /assign {
      rewrite * /apps/manor/public/managed/assign
      reverse_proxy 127.0.0.1:${eyre} {
        header_up Host localhost:${eyre}
        header_up X-Forwarded-Host {hostport}
        header_up -Cookie
        ${controllerTransport}
      }
    }
    @gate path / /gate/ /trolley.png
    handle @gate {
      rewrite * /apps/manor/public{uri}
      reverse_proxy 127.0.0.1:${eyre} {
        header_up Host localhost:${eyre}
        header_up X-Forwarded-Host {hostport}
        header_up -Cookie
        ${controllerTransport}
      }
    }
    handle {
      respond 404
    }
  }
${routes}
  handle {
    respond 404
  }
  handle_errors 502 503 504 {
    header Cache-Control no-store
    respond "Your ship is busy or restarting. Try again shortly." 503
  }
}
`;
}
// Compatibility for callers of the previous local-only generator.
export const fullLocalCaddyfile = options => managedLocalCaddyfile({...options, ships: options.ships ?? options.moons});

export function managedCaddyfile({ship, eyre, ships, base, httpsPort = 8443, localPort = 8091, admin = 'localhost:2020', staging = false}) {
  const problem = baseProblem(base) || frontProblem({httpsPort, localPort, admin});
  if (problem || !base) throw new Error(problem || 'Save a public address first.');
  if (!ships.length) throw new Error('No managed ships connected.');
  if (localPort < 1024) throw new Error('Use a local test port from 1024 to 65535.');
  const ports = [httpsPort, localPort, Number(admin.split(':')[1])];
  if (ports.includes(eyre)) throw new Error('The controller Eyre port must differ from Caddy listener ports.');
  const targets = managedTargets({ship, eyre, ships, ports});
  const controller = `reverse_proxy 127.0.0.1:${eyre} {
        header_up Host localhost:${eyre}
        header_up X-Forwarded-Host {hostport}
        header_up -Cookie
        header_up -Authorization
        header_up -Proxy-Authorization
        ${controllerTransport}
        health_uri /~/host
        health_body "^${ship}$"
        health_interval 10s
        health_timeout 10s
        health_fails 3
      }`;
  const routes = (joinHost, suffix) => `
  @escape path_regexp (^|/)\\.\\.(/|$)|%2[eE]
  handle @escape {
    respond 400
  }
  @join host ${joinHost}
  handle @join {
    handle /assign {
      rewrite * /apps/manor/public/managed/assign
      ${controller}
    }
    @gate path / /gate/ /trolley.png
    handle @gate {
      rewrite * /apps/manor/public{uri}
      ${controller}
    }
    handle {
      respond 404
    }
  }
${managedShipRoutes(targets, eyre, suffix)}
  handle {
    respond 404
  }
  handle_errors 502 503 504 {
    header Cache-Control no-store
    respond "Your ship is busy or restarting. Try again shortly." 503
  }`;
  const acme = staging ? 'https://acme-staging-v02.api.letsencrypt.org/directory' : 'https://acme-v02.api.letsencrypt.org/directory';
  return `# Manor managed ships for ${ship}. Only explicitly registered ships are routed.
# Public: https://join.${base}/
# Router: forward public TCP 443 to this machine's port ${httpsPort}
# Test: http://join.localhost:${localPort}/
{
  admin ${admin}
  auto_https disable_redirects
  https_port ${httpsPort}
  grace_period 10s
  servers {
    protocols h1 h2
    strict_sni_host on
  }
  on_demand_tls {
    ask http://127.0.0.1:${eyre}/apps/manor/public/tls-ask
  }
  ${privateLogs}
}
https:// {
  tls {
    on_demand
    issuer acme {
      dir ${acme}
      disable_http_challenge
    }
  }
${routes(`join.${base}`, base)}
}
http://:${localPort} {
  bind 127.0.0.1
${routes('join.localhost', 'localhost')}
}
`;
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
  const address = /^(localhost|127\.0\.0\.1):(\d{1,5})$/.exec(admin);
  if (!address || !port(Number(address[2]))) return 'Give Caddy\'s local admin address as localhost:port or 127.0.0.1:port.';
  if ([httpsPort, localPort].includes(Number(address[2]))) return 'The admin port must differ from the HTTPS and test ports.';
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
