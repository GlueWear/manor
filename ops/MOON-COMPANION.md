# Legacy Companion Checkpoint

New installations use the single `%manor` agent described in
[MANAGED-SHIPS.md](MANAGED-SHIPS.md). This is the frozen pre-unification
checkpoint. Keep an existing companion running until its replacement is
installed, paired and selected by the controller.

`moon-desk/` is a separate `%manor-moon` desk for a **full moon**, not a
Theseus virtual moon and not the Manor host. It does not change Manor's
existing Theseus pool, public routes, Caddy configuration or state version.
Public handout of full moons is a later milestone.

## Install and pair

Create and mount `%manor-moon` on the moon, then copy `moon-desk/` into its
mount. The first test moon is already mounted and staged by the operator's
development session. In that moon's Dojo:

```hoon
|commit %manor-moon
|install our %manor-moon
:manor-moon|pair ~siglup-narwet
```

The test moon belongs to ~mignes-magtel, while Manor runs on ~siglup-narwet.
Pairing explicitly authorizes that controller. The agent starts **unpaired**.
Only a local action can pair, change or clear the controller; an incoming
network request cannot appoint itself. `:manor-moon|unpair` clears it and
kicks existing control subscriptions. Finish any pending request first.
Unpairing alone does **not** revoke existing browser sessions.

## Protocol

Use mark `%manor-moon-action`, as defined in `sur/manor-moon.hoon`.
Remote requests and watches require the paired controller's ship identity;
local agents are trusted as the moon's owner. There are no HTTP endpoints.
Cross-ship requests use ordinary `%poke` with a typed action vase. `%poke-as`
is local-only on this kernel and must not be used for a remote controller.

| Action | Result |
| --- | --- |
| `[%pair (unit ship)]` | Local-only controller change; kicks subscriptions |
| `[%configure landing required]` | Landing desk and required live desks |
| `[%report ~]` | Push a fresh status to existing `/status` subscribers |
| `[%session rid]` | Open a moon owner session using its own loopback Eyre |
| `[%revoke rid]` | Log out **all** owner sessions, then verify none remain |
| `[%profile rid name avatar]` | Update the local Noltbook profile |

Watch `/status` for the typed status noun, initially and on updates. A local
scry of `/status` returns the same noun, without credentials. Status reports
the moon's identity, Eyre port, pairing, required-desk readiness, pending work,
revocation generation and Noltbook profile. It does not yet distinguish
every in-flight Clay synchronization stage; pool readiness must not assume
that this replaces the later Manor integration's installation checks.

For a request with `rid`, **watch `/result/<rid>` first**, then poke. The
agent emits one `[rid result]` noun fact and kicks that path. Request IDs are
1-80 lowercase letters, digits or hyphens. One operation runs at a time.
Late responses are ignored using a separate, monotonically increasing serial.
HTTP requests use only the moon's reported loopback port, with redirects and
retries disabled. A 30-second control timeout reports an indeterminate failure;
do not treat it as proof that the requested side effect did not happen.

Results are `%session` (a cookie), `%revoked` (a generation), `%profile` (the
profile), or `%error` (a generic reason). **Never print a session result in
Dojo or logs.** The receiver must consume it privately. Codes never leave the
moon; neither codes nor returned session cookies are retained in this agent's
state. Eyre itself necessarily maintains the live sessions.

Names and avatar URLs use Theseus's Noltbook convention: `~` keeps a field,
`[~ ~]` clears it and `[~ ~ value]` sets it. Uploaded image bytes are not yet
supported by this companion; use a picture URL for this milestone.

Revocation uses Eyre's authenticated `POST /~/logout` with `all=1`, not a
breach, key change or restore. It also logs the operator out of this moon's
browser pages. All apps, files and networking keys remain in place. A failed
or timed-out revocation must never make a claim available in Manor.
This revokes cookies, not the web login code. A full owner could read and
retain that code; untrusted visitor reuse needs web-code rotation as well
before the full-moon pool can be considered production-ready.

## Verification

```sh
python3 -m unittest discover -s ops -p 'test_*.py'
python3 ops/check_companion.py '~<managed-test-moon>'
python3 ops/check_companion.py '~<managed-test-moon>' --tests
python3 ops/check_companion.py '~<managed-test-moon>' --generators
```

The first probe compiles the real agent in memory on the managed test moon;
it neither installs an agent nor emits its cards. The behavioral tests use
synthetic event bowls and mocked live scries and login codes. No computed
HTTP, profile or timer cards are delivered. These tests are not proof of the
live Iris login round trip, session revocation or cross-ship delivery.
The generator test invokes the actual pair/unpair/report gates with Dojo's
system arguments, positional-argument list and options slot, without sending
their resulting actions.

Live checks passed on 2026-11-12: installed-agent status, paired-controller
delivery over Ames, a session granting owner-only HTTP access, that same
cookie being rejected after revocation, and temporary Noltbook name/picture
updates with verified restoration. Browser handout through Manor is still a
later milestone. Ask before running a host Dojo command, compiling on a
host, or revoking active sessions. Do not put it in the public pool yet.

### Live probes

The private probe runs a short inline Khan thread. Its cookies stay inside
Urbit; only a boolean result or a whitelisted error stage returns to the
client. It checks an owner-only HTTP scry, with redirects disabled and the
port pinned to the manager registry. Ports in URLs must use ungrouped decimal
digits (`8101`, not Hoon's display form `8.101`).

```sh
python3 ops/live_companion.py '~<managed-test-moon>' status
python3 ops/live_companion.py '~<managed-test-moon>' baseline
python3 ops/live_companion.py '~<managed-test-moon>' session
python3 ops/live_companion.py '~<managed-test-moon>' revoke --confirm-revoke
python3 ops/live_companion.py '~<managed-test-moon>' profile --confirm-profile
```

`baseline` verifies unauthenticated HTTP access is refused, without opening
a session. `session` opens a temporary session, verifies authenticated HTTP
access, logs out only that session, and verifies it no longer works. `revoke`
verifies a session, asks the agent to revoke **all** owner sessions, then
checks that the old cookie fails. The last test signs out the operator too;
get approval first. `--compile-only` constructs the form without executing
it. `--from-pier /path/to/approved/controller` runs the probe from that
controller instead of the moon; get approval before using a live host.

`profile` saves a private, mode-600 backup of the current visible name and
avatar reference, checks that the fields are restorable, changes both, checks
the actual Noltbook readback, then restores and checks the original fields.
It refuses an uploaded/Urbit, S3 or IPFS avatar that the URL-only protocol
cannot restore exactly. If a test fails, it attempts restoration again and
retains the backup for recovery. A saved backup can be restored explicitly:

```sh
python3 ops/live_companion.py '~<managed-test-moon>' profile-restore \
  --confirm-profile --profile-backup /path/to/private-backup.json
```

The first live test exposed and fixed grouped ports in URLs and a local-only
card in the test client. Ordinary remote pokes, ungrouped URL ports, and the
private backup transport now have regression coverage. No cookies or codes
are printed or saved by these probes.
