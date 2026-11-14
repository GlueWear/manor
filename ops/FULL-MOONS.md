# Standalone Ship Supervisor

`./manor ship` manages independent Urbit piers: galaxies, stars, planets,
moons and already-existing comets. `./manor moon` remains an equivalent alias.
This is a standalone supervisor, not a pool or identity provisioning service.
Manor's existing Theseus pool continues to operate. Full-moon handout, session
revocation, activity tracking and profile controls require separate moon-agent
and Manor integration; this manager alone does not provide them.

Run commands from the Manor repository. Requires macOS and Python 3.9 or newer.
Vere is supplied explicitly, copied internally and pinned by SHA-256. It does
not need the Theseus fork. Do not choose an old release incompatible with the
ship's kernel.

## Names And Compatibility

Names accept an optional leading `~` and must be canonical, lower-case `@p`
identities, for example:

- Galaxy: `~zod`.
- Star: `~nolset`.
- Planet: `~siglup-narwet`.
- Moon: `~pilfep-sicted-mignes-magtel` (three-word moons also remain supported).
- Comet: `~tacput-forlur-mopweb-docled--pilfep-sicted-mignes-magtel`.

Dots, path separators, whitespace, uppercase and shell metacharacters are
rejected. The structural check bounds names to 128 bits' worth of syllables
and groups long names in fours from the right. `add` and `adopt` also require
the chosen, pinned Vere to parse the name and render it identically using
`slav` and `scot`. This uses [Vere's offline `eval`](https://docs.urbit.org/user-manual/running/vere#eval),
not a running ship, network request or Dojo command. An unavailable evaluator,
failure or unexpected result refuses registration. It validates spelling,
not ownership, keys or the identity inside an adopted pier; HTTP identity is
still checked at startup. Existing registrations do not need this check again.

Compatibility names deliberately remain unchanged: `moons.json`, registry
version 1 with its `moons` map, installed `bin/moons.py`, default `~/Moons/`
piers, logs and `io.gluewear.manor.moon.<name>` LaunchAgents. Both command
spellings share the same registry, port reservations and jobs. No migration,
registry reset, renaming or job reload is needed; existing metadata is retained.

## New Keyed Ship

Obtain a fresh, unused identity and its appropriate key outside this manager.
For a new moon, its parent creates it with `|moon ~<new-moon>` and supplies the
key file. Never reuse a running Theseus moon's name or key. Do not paste a key
or login code into a terminal command or chat.

```sh
./manor ship add '~<new-ship>' /path/to/ship.key \
  --vere /path/to/compatible/urbit \
  --http-port 8101 --ames-port 42001 --loom 31
./manor ship status
./manor ship logs '~<new-ship>'
```

`add` registers and starts one new keyed ship via launchd using the existing
Vere `--name <name> --key-file <file>` boot path. It does not mint identities,
generate comets or introduce another provisioning path. Use `adopt` below for
an already-existing comet. `--no-start` stages a registration without booting.
It refuses an existing pier and ports reserved by another
managed ship or already bound by another process. Piers default to `~/Moons/`.
The default ports for successive ships are 8101 onward (web) and 42001 onward
(Ames UDP). Web listeners bind to loopback; future public access goes through
Caddy. Vere's separate Lens loopback listener is not a browser port.

The key file is protected as mode 600. A private bootstrap copy is retained
until the ship answers `/~/host` with its expected identity on its fixed web
port. **Successful verification deletes both the bootstrap copy and the
supplied key file**, provided the original file has not changed. Do not supply
a shared backup file. A failed or interrupted first boot retains the key and
pier for inspection and refuses to replay the boot automatically.

`HTTP ready` means that Vere and Eyre respond. It does not mean Glurff is
installed or that Manor may hand out a moon. From a browser, use the port
explicitly: `http://localhost:8101/apps/glurff/`.

## Lifecycle

An existing **stopped**, initialized pier of any ship class on the internal
disk can be adopted without a key, rekey or new boot. This is the supported
route for already-existing comets; create a comet outside this manager first.
Adoption keeps the pier's state and uses its existing `.run` unless a
compatible `--vere` is explicitly supplied. Exit it in its original launcher
first and prevent that launcher from starting it again. `--no-start` records
the adoption without loading a job.

```sh
./manor ship adopt '~<ship>' /Users/you/existing-pier \
  --http-port 8101 --ames-port 42001 --loom 31
```

Adoption refuses a running pier. The wrapper verifies the HTTP identity at
startup and stops if the supplied name is wrong. No ship class gets special
rekey handling. Moons of a different planet can run under this manager, but
the future moon-agent integration must pair
their Manor controller explicitly; they do not implicitly trust this host.

```sh
./manor ship plan                 # generated launchd settings; no job is loaded
./manor ship start '~<ship>'       # or all
./manor ship stop '~<ship>'        # or all
./manor ship restart '~<ship>'     # or all
./manor ship install              # write LaunchAgents for next login
./manor ship uninstall '~<ship>'   # stop and remove job; retain pier and registry
./manor ship logs '~<ship>' --follow
./manor ship runtime '~<ship>' --vere /path/to/compatible/urbit  # stopped only
./manor ship code '~<ship>'        # clipboard only; not printed
./manor ship dojo '~<ship>' '+vats'
```

Each ship has its own `io.gluewear.manor.moon.<name>` LaunchAgent, RunAtLoad,
KeepAlive and a 30-second restart throttle. `stop` unloads it for this login;
its plist still starts it at the next login. `uninstall` also removes the
plist. A manual `|exit` is restarted by launchd while its job is loaded.

The wrapper handles SIGTERM by requesting the ship's normal `|exit` over its
loopback Lens API, and falls back to forwarding SIGTERM if the control request
fails. In the first Vere 4.3 handoff, SIGTERM alone did not finish shutdown;
`|exit` completed normally. It never sends SIGKILL. A live `.vere.lock` or
another manager's lock blocks a duplicate start. Do not let Orraah or a
terminal run any managed pier independently.

`dojo` returns the ship's Dojo result through its loopback-only Lens API,
which works without a terminal. A command such as `|install` may start work
that finishes later; inspect `+vats` before declaring an app ready.
For live, asynchronous output, open `http://localhost:8101/apps/webterm/`
(using the ship's registered HTTP port), and use `ship code` to copy its
login code privately. The one-shot command's `>=` confirms acceptance, not
remote success; Webterm shows later messages such as `hi ~zod successful`.
Control-socket clients wait for the complete framed response, with a
300-second request limit.

## Files and logs

- Registry, pinned runtime and installed wrapper:
  `~/Library/Application Support/Manor/` (private).
- Piers: `~/Moons/<ship>/` (legacy directory name retained).
- Logs: `~/Library/Logs/manor/<ship>.log`, rotated at 10 MiB with two backups.
- Wrapper failures: `<ship>.log.supervisor` in the same folder.
- LaunchAgents: `~/Library/LaunchAgents/io.gluewear.manor.moon.<ship>.plist`.

No launchd argument or working directory refers to the external repository.
Captured Vere output passes through a redactor before it reaches disk. It
redacts login-code-shaped names conservatively, so some long ship names are
also hidden in runtime logs. The registry and status output contain names and
ports, never key contents or session cookies. Treat piers as private state.

Changing this source does not update the deployed wrapper or running jobs.
During operator-planned maintenance, `ship install` (also `moon install`)
refreshes the installed wrapper without reloading existing jobs. LaunchAgent
settings take effect after the operator's next restart or login.

## Verification

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s ops -p 'test_moons.py' -v
```

Tests use a fake Vere for offline name validation and temporary fixture piers.
They cover every ship class, both CLI spellings, legacy registry/job names,
metadata retention, keyless adoption, private staging, port conflicts,
duplicate-pier refusal, first-boot replay refusal, key retirement, generated
plists, graceful-stop calls, secret redaction, and fragmented/truncated
control-socket frames. The lifecycle fixture opens loopback TCP and UDP sockets;
in a restricted sandbox, request the required escalation before running it.
Tests do not boot or stop a real ship, load launchd jobs or update the deployed
manager. They do not prove real Vere/kernel compatibility or comet provisioning.
Live acceptance remains a separate operator task, including fixed ports,
app install from a public distributor, code clipboard/login, graceful restart,
crash recovery, and logout/login of the macOS user. A LaunchAgent starts at
user login, not at machine boot before login.
