#!/usr/bin/env node
// The manor broker: hands each visitor a free moon from the pool and logs
// them into it, without the visitor ever seeing the moon's +code.
//
//   join.<base>/gate/       the trolley page (Caddy serves it)
//   join.<base>/assign      claim a free moon and send the visitor to it
//   <moon>.<base>/broker    log in with the moon's +code, set only the moon's
//                           session cookie on the moon's own origin, and go
//                           to the landing page
//   /tls-ask?domain=        Caddy asks before fetching a certificate; only the
//                           join host and pool moons get one
//
// /assign hands out a one-time ticket that /broker requires, so knowing a
// moon's address is not enough to log into a moon given to someone else. A
// ticket nobody used within two minutes frees its moon again.
//
// The pool and claims files are read on every request, so changes made with
// pool.mjs (a new moon, a code refreshed by a recycle) apply at once.
import http from 'node:http';
import {settings, ship, label, readJson, updateJson, newTicket, digest, moonLogin} from './lib/manor.mjs';

const cfg = settings();
const TICKET_MS = 2 * 60_000;

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error('[broker] error:', error.message);
    if (!res.headersSent) page(res, 502, 'Something went wrong.', 'Try pulling the lever again in a moment.');
  });
});
server.listen(cfg.brokerPort, '127.0.0.1', () => {
  console.log(`[broker] :${cfg.brokerPort} host ${cfg.hostUrl} base ${cfg.base || '(none)'} landing ${cfg.landing}`);
});

async function handle(req, res) {
  const host = String(req.headers.host || '').toLowerCase();
  const url = new URL(req.url, 'http://broker');
  switch (url.pathname.replace(/\/$/, '')) {
    case '/health': return send(res, 200, 'ok');
    case '/tls-ask': return send(res, allowCertificate(url.searchParams.get('domain')) ? 200 : 403, '');
    case '/assign': return assign(req, res, host);
    case '/broker': return broker(req, res, host, url);
    default: return send(res, 404, 'not found');
  }
}

function allowCertificate(domain) {
  const name = String(domain || '').toLowerCase();
  if (!cfg.base) return false;
  if (name === `join.${cfg.base}`) return true;
  if (!name.endsWith(`.${cfg.base}`)) return false;
  try { return Object.hasOwn(readJson(cfg.poolFile), ship(name.slice(0, -cfg.base.length - 1))); }
  catch { return false; }
}

// A claim whose ticket ran out unused never reached its moon.
const free = (claim, now) => !claim || (Boolean(claim.expires) && claim.expires < now && !claim.entered);

function assign(req, res, host) {
  if (!host.startsWith('join.')) return send(res, 404, 'not found');
  const pool = readJson(cfg.poolFile);
  const ticket = newTicket();
  let moon = null;
  updateJson(cfg.claimsFile, claims => {
    const now = Date.now();
    moon = Object.keys(pool).find(m => pool[m]?.code && free(claims[m], now)) || null;
    if (moon) claims[moon] = {at: new Date(now).toISOString(), ticket: digest(ticket), expires: now + TICKET_MS};
  });
  if (!moon) return page(res, 503, 'All moons are taken right now.', 'Check back soon.');
  // The moon's address sits beside join's: join.<base> -> <moon>.<base>.
  const to = `${scheme(req)}://${label(moon)}.${host.slice('join.'.length)}/broker?ticket=${ticket}`;
  console.log(`[broker] assigned ${moon}`);
  res.writeHead(302, {location: to, 'cache-control': 'no-store'});
  res.end();
}

async function broker(req, res, host, url) {
  let moon;
  try { moon = ship(host.split('.')[0]); } catch { return send(res, 404, 'not found'); }
  const entry = readJson(cfg.poolFile)[moon];
  if (!entry?.code) return send(res, 404, `${moon} is not in the pool`);
  const gate = `${scheme(req)}://join.${host.slice(host.indexOf('.') + 1)}/gate/`;
  const claim = readJson(cfg.claimsFile)[moon];
  const ticket = url.searchParams.get('ticket') || '';
  const valid = Boolean(claim?.ticket) && claim.ticket === digest(ticket) && Date.now() < claim.expires;
  if (!valid) {
    // Someone already in can come back the same way.
    if (cookieNames(req).has(`urbauth-${moon}`)) return redirect(res, cfg.landing);
    return page(res, 403, 'This link has already been used.', `<a href="${gate}">Pull the lever again</a> to get a moon.`);
  }
  const cookie = await moonLogin(cfg.hostUrl, moon, entry.code);
  if (!cookie) {
    console.error(`[broker] ${moon} refused its login; refresh its code with: node pool.mjs refresh ${moon}`);
    return page(res, 502, 'Your moon is not ready yet.', 'Try again in a minute.');
  }
  updateJson(cfg.claimsFile, claims => {
    const c = claims[moon];
    if (!c) return;
    delete c.ticket;
    delete c.expires;
    c.entered = new Date().toISOString();
  });
  console.log(`[broker] ${moon} logged in -> ${cfg.landing}`);
  res.writeHead(303, {'set-cookie': cookie, location: cfg.landing, 'cache-control': 'no-store'});
  res.end();
}

// Caddy says how the visitor connected; the broker itself is plain HTTP.
const scheme = req => req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';

function cookieNames(req) {
  return new Set(String(req.headers.cookie || '').split(';').map(c => c.split('=')[0].trim()).filter(Boolean));
}
function redirect(res, location) {
  res.writeHead(303, {location, 'cache-control': 'no-store'});
  res.end();
}
function send(res, status, text) {
  res.writeHead(status, {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'});
  res.end(text);
}
function page(res, status, title, body) {
  res.writeHead(status, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>`
    + '<body style="font-family:ui-sans-serif,-apple-system,sans-serif;text-align:center;padding:3rem 1.25rem;line-height:1.55">'
    + `<h2>${title}</h2><p>${body}</p></body>`);
}
