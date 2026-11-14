#!/usr/bin/env python3
"""Manor's macOS Urbit ship supervisor. Uses only the Python standard library."""

import argparse
import contextlib
import fcntl
import hashlib
import http.client
import json
import logging
import logging.handlers
import os
from pathlib import Path
import plistlib
import re
import selectors
import signal
import socket
import stat
import struct
import subprocess
import sys
import tempfile
import threading
import time


class ManagerError(Exception):
    pass


def ship_name(value):
    if not isinstance(value, str):
        raise ManagerError("expected a canonical lower-case Urbit ship name")
    name = value.removeprefix("~")
    # At most 128 bits: one suffix, or 1-8 words grouped in fours from the right.
    if not re.fullmatch(r"(?:[a-z]{3}|[a-z]{6}(?:-[a-z]{6}){0,3}"
                        r"(?:--[a-z]{6}(?:-[a-z]{6}){3})?)", name):
        raise ManagerError("expected a canonical lower-case Urbit ship name, such as ~zod or ~siglup-narwet")
    return name


def moon_name(value):
    # Moon-agent helpers still require a moon, not just any supervised ship.
    name = ship_name(value)
    if len(name.split("-")) not in (3, 4):
        raise ManagerError("expected a moon name, such as ~sampel-palnet-siglup-narwet")
    return name


def validate_ship_name(name, runtime):
    name = ship_name(name)
    # A lexical allowlist above makes the cord safe; Vere checks syllables and spelling.
    source = f"=('~{name}' (scot %p (slav %p '~{name}')))\n"
    answer = run_checked([str(runtime), "eval"], input=source.encode(), sensitive=True)
    answer = re.sub(rb"\x1b\[[0-?]*[ -/]*[@-~]", b"", answer).strip()
    if answer != b"%.y":
        raise ManagerError("selected Vere could not validate a canonical ship name offline; check the name and runtime")


def internal(path):
    path = Path(path).expanduser().resolve()
    if str(path).startswith("/Volumes/"):
        raise ManagerError("ship piers, manager files and logs must be on the internal disk")
    return path


def private_dir(path):
    if path.is_symlink():
        raise ManagerError("refusing a symbolic-link state directory")
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(path, 0o700)


def write_atomic(path, data, mode=0o600):
    private_dir(path.parent)
    fd, tmp = tempfile.mkstemp(prefix=".manor-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as out:
            os.fchmod(out.fileno(), mode)
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as src:
        for block in iter(lambda: src.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def redact(value):
    # Codes have the same shape as long @p names. Conservatively hide both in logs.
    value = re.sub(r"(?i)(set-cookie\s*:).*", r"\1 [redacted]", value)
    value = re.sub(r"urbauth-[^\s=;]+=[^\s;]+", "[session redacted]", value)
    value = re.sub(r"(?<![\w])0[wvb][A-Za-z0-9.~\-]{12,}", "[key redacted]", value)
    value = re.sub(r"(?<![a-z])~?[a-z]{6}(?:-{1,2}[a-z]{6}){2,}", "[code/name redacted]", value)
    return re.sub(r"(?i)((?:password|ticket|access_token|refresh_token)=)[^&\s]+", r"\1[redacted]", value)


def parse_login_code(value):
    value = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", value).strip()
    match = re.fullmatch(r"(?:'~([a-z-]+)'|~\.~([a-z-]+))", value)
    if not match:
        raise ManagerError("ship returned an invalid login code")
    return match[1] or match[2]


def canonical_atom(value):
    # Vere's noun pretty-printer pads hex groups; Hoon source rejects leading zeros.
    if re.fullmatch(r"0x[0-9a-f.]+", value):
        return format(int(value[2:].replace(".", ""), 16), ",").replace(",", ".")
    if re.fullmatch(r"[0-9.]+", value):
        return format(int(value.replace(".", "")), ",").replace(",", ".")
    return value


def run_checked(argv, timeout=20, sensitive=False, **kwargs):
    try:
        result = subprocess.run(argv, capture_output=True, timeout=timeout, **kwargs)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ManagerError(f"{Path(argv[0]).name} did not finish; no further lifecycle action taken") from exc
    if result.returncode:
        if sensitive:
            raise ManagerError(f"{Path(argv[0]).name} failed during a private control request")
        raise ManagerError(f"{Path(argv[0]).name} failed: " + redact(result.stderr.decode(errors="replace")[-1200:]))
    return result.stdout


def live_pid(pier):
    try:
        pids = [int(value) for value in (Path(pier) / ".vere.lock").read_text().split()]
        if not pids or any(pid <= 1 for pid in pids):
            raise ValueError()
        # An older PID entry must not hide a live Vere after a runtime restart.
        for pid in reversed(pids):
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                continue
            return pid
        return None
    except FileNotFoundError:
        return None
    except (ValueError, OverflowError, PermissionError) as exc:
        raise ManagerError("cannot establish whether the pier's Vere lock is live; refusing to start") from exc


def assert_port_free(port, kind):
    with socket.socket(socket.AF_INET, kind) as probe:
        try:
            if kind == socket.SOCK_STREAM:
                probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            probe.bind(("127.0.0.1" if kind == socket.SOCK_STREAM else "0.0.0.0", port))
            if kind == socket.SOCK_STREAM:
                probe.listen(1)
        except OSError as exc:
            raise ManagerError(f"port {port} is already occupied") from exc


def host_at(port):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=1)
    try:
        conn.request("GET", "/~/host")
        response = conn.getresponse()
        data = response.read(256)
        return data.decode().strip() if response.status == 200 else None
    except (OSError, http.client.HTTPException, UnicodeError):
        return None
    finally:
        conn.close()


def receive_frame(sock):
    def exact(size):
        out = bytearray()
        while len(out) < size:
            block = sock.recv(size - len(out))
            if not block:
                raise ManagerError("control socket closed before its complete reply")
            out.extend(block)
        return bytes(out)
    header = exact(5)
    size = struct.unpack("<I", header[1:])[0]
    if header[0] != 0 or not 0 < size <= 16 * 1024 * 1024:
        raise ManagerError("invalid control-socket frame")
    return header + exact(size)


def eval_output(runtime, flags, data, timeout=20):
    # Vere can drop the tail of a large stdout write when it targets a pipe.
    # An anonymous mode-600 regular file also keeps private reply bodies quiet.
    with tempfile.TemporaryFile() as output:
        try:
            result = subprocess.run([runtime, "eval", *flags], input=data,
                                    stdout=output, stderr=subprocess.PIPE, timeout=timeout)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise ManagerError("offline control encoding did not finish") from exc
        if result.returncode:
            raise ManagerError("offline control encoding failed")
        output.seek(0)
        encoded = output.read(64 * 1024 * 1024 + 1)
        if len(encoded) > 64 * 1024 * 1024:
            raise ManagerError("offline control output exceeded its size limit")
        return encoded


def validate_frame(frame):
    if len(frame) < 5 or frame[0] != 0:
        raise ManagerError("offline encoder returned an invalid control frame")
    size = struct.unpack("<I", frame[1:5])[0]
    if not 0 < size <= 16 * 1024 * 1024 or len(frame) != size + 5:
        raise ManagerError("offline encoder returned an incomplete control frame; nothing sent")


def exchange(row, noun, timeout=300):
    runtime = row["runtime"]
    try:
        framed = eval_output(runtime, ["--jam", "-n"], noun.encode())
        validate_frame(framed)
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout)
            sock.connect(str(Path(row["pier"]) / ".urb/conn.sock"))
            sock.sendall(framed)
            reply = receive_frame(sock)
        return eval_output(runtime, ["--cue", "-n"], reply).decode().strip()
    except (OSError, UnicodeError) as exc:
        raise ManagerError("control request failed; do not assume the requested action failed or retry it blindly") from exc


def lens_command(text):
    text = text.strip()
    if re.match(r"^\|[a-z][a-z0-9-]*(?:\s|$)", text):
        return {"source": {"dojo": "+hood/" + text[1:]}, "sink": {"app": "hood"}}
    app = re.fullmatch(r":([a-z][a-z0-9-]*)\s+(.+)", text)
    if app:
        return {"source": {"dojo": app[2]}, "sink": {"app": app[1]}}
    return {"source": {"dojo": text}, "sink": {"stdout": None}}


def dojo_input(row, text):
    if not text or len(text) > 4096 or any(ord(c) < 32 for c in text):
        raise ManagerError("Dojo command must be a single line, at most 4096 characters")
    ports = (Path(row["pier"]) / ".http.ports").read_text()
    local = re.findall(r"^(\d+) insecure loopback$", ports, re.M)
    if len(local) != 1:
        raise ManagerError("ship has no unambiguous local Lens port")
    conn = http.client.HTTPConnection("127.0.0.1", int(local[0]), timeout=300)
    try:
        body = json.dumps(lens_command(text)).encode()
        conn.request("POST", "/", body=body, headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        payload = response.read(8 * 1024 * 1024 + 1)
        if response.status != 200 or len(payload) > 8 * 1024 * 1024:
            raise ManagerError("ship command failed or exceeded the output limit; check its log before retrying")
        value = json.loads(payload)
        return value if isinstance(value, str) else json.dumps(value)
    except (OSError, http.client.HTTPException, ValueError) as exc:
        raise ManagerError("ship command connection ended; the command may still have run") from exc
    finally:
        conn.close()


class Manager:
    def __init__(self, root=None, home=None):
        self.home = Path(home) if home else Path.home()
        self.root = internal(root or self.home / "Library/Application Support/Manor")
        # Keep the on-disk schema and launchd names stable for existing managed piers.
        self.registry = self.root / "moons.json"
        self.agents = self.home / "Library/LaunchAgents"
        self.gui = f"gui/{os.getuid()}"

    @contextlib.contextmanager
    def locked(self):
        private_dir(self.root)
        fd = os.open(self.root / "registry.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            try:
                data = json.loads(self.registry.read_text()) if self.registry.exists() else {"version": 1, "moons": {}}
                if data.get("version") != 1 or not isinstance(data.get("moons"), dict):
                    raise ManagerError("unsupported ship registry")
                yield data
            except (ValueError, KeyError, TypeError) as exc:
                raise ManagerError("invalid ship registry") from exc

    def save(self, data):
        write_atomic(self.registry, (json.dumps(data, indent=2) + "\n").encode())

    def rows(self, name="all"):
        with self.locked() as data:
            for registered, row in data["moons"].items():
                if (registered != ship_name(registered) or row.get("name") != registered
                        or row.get("keyfile") != str(self.root / "keys" / (registered + ".key"))
                        or not isinstance(row.get("boot_started"), bool)
                        or not isinstance(row.get("booted"), bool)):
                    raise ManagerError("invalid ship registry entry")
                for field in ("pier", "runtime", "log"):
                    if str(internal(row[field])) != row[field]:
                        raise ManagerError("ship registry paths must be absolute and internal")
                if not Path(row["runtime"]).is_relative_to(self.root / "runtimes"):
                    raise ManagerError("ship runtime is outside the manager's runtime directory")
                if any(type(row.get(field)) is not int or not 1024 <= row[field] <= 65535
                       for field in ("http_port", "ames_port")):
                    raise ManagerError("invalid registered ship port")
            if name == "all":
                return list(data["moons"].values())
            name = ship_name(name)
            if name not in data["moons"]:
                raise ManagerError("ship is not registered")
            return [data["moons"][name]]

    def label(self, row):
        return "io.gluewear.manor.moon." + row["name"]

    def plist_path(self, row):
        return self.agents / (self.label(row) + ".plist")

    def loaded(self, row):
        return subprocess.run(["launchctl", "print", f"{self.gui}/{self.label(row)}"],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0

    def plist(self, row):
        return {
            "Label": self.label(row),
            "ProgramArguments": ["/usr/bin/env", "python3", str(self.root / "bin/moons.py"),
                                 "--state-dir", str(self.root), "_run", row["name"]],
            "WorkingDirectory": str(self.root),
            "RunAtLoad": True, "KeepAlive": True, "ThrottleInterval": 30,
            "ExitTimeOut": 240, "ProcessType": "Background", "Umask": 0o077,
            "StandardOutPath": row["log"] + ".supervisor", "StandardErrorPath": row["log"] + ".supervisor",
            "EnvironmentVariables": {"PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"},
        }

    def runtime_copy(self, binary):
        binary = Path(binary).expanduser().resolve()
        if not binary.is_file() or not os.access(binary, os.X_OK):
            raise ManagerError("--vere must name an executable Vere binary")
        sha = digest(binary)
        runtime = self.root / "runtimes" / sha / "urbit"
        if not runtime.exists():
            write_atomic(runtime, binary.read_bytes(), 0o700)
        if digest(runtime) != sha:
            raise ManagerError("internal runtime hash does not match --vere")
        return runtime, sha

    def ports(self, rows, args):
        used_tcp = {r["http_port"] for r in rows}
        used_udp = {r["ames_port"] for r in rows}
        http = args.http_port or next((p for p in range(8101, 8201) if p not in used_tcp), None)
        ames = args.ames_port or next((p for p in range(42001, 42101) if p not in used_udp), None)
        if http is None or ames is None or http in used_tcp or ames in used_udp:
            raise ManagerError("requested port is already reserved by a registered ship")
        assert_port_free(http, socket.SOCK_STREAM)
        assert_port_free(ames, socket.SOCK_DGRAM)
        return http, ames

    def add(self, args):
        name = ship_name(args.name)
        key_source = Path(args.keyfile).expanduser().absolute()
        info = key_source.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_size > 16384:
            raise ManagerError("key must be a regular file owned by you, at most 16 KiB")
        key = key_source.read_bytes().strip()
        if not re.fullmatch(rb"0w[A-Za-z0-9.~\-]+", key):
            raise ManagerError("key file must contain only the ship's @uw key")
        pier = internal(args.pier or self.home / "Moons" / name)
        log = internal(self.home / "Library/Logs/manor" / (name + ".log"))
        with self.locked() as data:
            if name in data["moons"] or pier.exists():
                raise ManagerError("ship or pier already exists; add only a fresh, unused ship")
            runtime, sha = self.runtime_copy(args.vere)
            validate_ship_name(name, runtime)
            http, ames = self.ports(data["moons"].values(), args)
            private_dir(pier.parent)
            private_dir(log.parent)
            os.chmod(key_source, 0o600)
            keyfile = self.root / "keys" / (name + ".key")
            write_atomic(keyfile, key + b"\n")
            row = {"name": name, "pier": str(pier), "http_port": http, "ames_port": ames,
                   "loom": args.loom, "runtime": str(runtime), "runtime_sha256": sha,
                   "log": str(log), "keyfile": str(keyfile), "key_source": str(key_source),
                   "key_source_sha256": digest(key_source), "boot_started": False, "booted": False}
            data["moons"][name] = row
            self.save(data)
        print(f"registered ~{name}: HTTP {http}, Ames {ames}, loom {args.loom}")
        if not args.no_start:
            self.start(row)

    def adopt(self, args):
        name = ship_name(args.name)
        pier = internal(args.pier)
        if not (pier / ".urb/log/data.mdb").is_file():
            raise ManagerError("adopt requires an existing initialized ship pier")
        if live_pid(pier):
            raise ManagerError("exit this ship in its current launcher before adopting it")
        log = internal(self.home / "Library/Logs/manor" / (name + ".log"))
        with self.locked() as data:
            if name in data["moons"] or any(r["pier"] == str(pier) for r in data["moons"].values()):
                raise ManagerError("ship or pier is already registered")
            runtime, sha = self.runtime_copy(args.vere or pier / ".run")
            validate_ship_name(name, runtime)
            http, ames = self.ports(data["moons"].values(), args)
            private_dir(log.parent)
            row = {"name": name, "pier": str(pier), "http_port": http, "ames_port": ames,
                   "loom": args.loom, "runtime": str(runtime), "runtime_sha256": sha,
                   "log": str(log), "keyfile": str(self.root / "keys" / (name + ".key")),
                   "boot_started": True, "booted": True, "adopted": True}
            data["moons"][name] = row
            self.save(data)
        print(f"adopted ~{name}: HTTP {http}, Ames {ames}, existing state retained")
        if not args.no_start:
            self.start(row)

    def set_runtime(self, args):
        row = self.rows(args.name)[0]
        if live_pid(row["pier"]) or self.loaded(row):
            raise ManagerError("stop the ship before changing its pinned runtime")
        with self.locked() as data:
            runtime, sha = self.runtime_copy(args.vere)
            current = data["moons"][row["name"]]
            history = current.setdefault("runtime_history", [])
            history.append({"runtime": current["runtime"], "sha256": current["runtime_sha256"]})
            current["runtime"], current["runtime_sha256"] = str(runtime), sha
            self.save(data)
        print(f"~{row['name']}: runtime pinned; start it when ready")

    def install(self, row):
        private_dir(self.agents)
        private_dir(Path(row["log"]).parent)
        write_atomic(self.root / "bin/moons.py", Path(__file__).read_bytes(), 0o700)
        write_atomic(self.plist_path(row), plistlib.dumps(self.plist(row)))

    def start(self, row):
        if self.loaded(row):
            print(f"~{row['name']}: launchd job already loaded; use status")
            return
        if live_pid(row["pier"]):
            raise ManagerError("pier is already running outside this launchd job; refusing a second Vere")
        if row["boot_started"] and not row["booted"]:
            raise ManagerError("first boot was interrupted before verification; inspect the pier and logs before recovery")
        assert_port_free(row["http_port"], socket.SOCK_STREAM)
        assert_port_free(row["ames_port"], socket.SOCK_DGRAM)
        self.install(row)
        run_checked(["launchctl", "enable", f"{self.gui}/{self.label(row)}"])
        run_checked(["launchctl", "bootstrap", self.gui, str(self.plist_path(row))])
        print(f"~{row['name']}: started by launchd; check ./manor ship status")

    def stop(self, row):
        if not self.loaded(row):
            if live_pid(row["pier"]):
                raise ManagerError("ship is running outside this launchd job; refusing to stop an unmanaged Vere")
            print(f"~{row['name']}: already stopped")
            return
        print(f"~{row['name']}: requesting graceful shutdown", flush=True)
        run_checked(["launchctl", "bootout", f"{self.gui}/{self.label(row)}"], timeout=250)
        deadline = time.monotonic() + 180
        while live_pid(row["pier"]):
            if time.monotonic() > deadline:
                raise ManagerError("Vere is still shutting down; refusing to restart or force-kill it")
            time.sleep(1)
        print(f"~{row['name']}: stopped (will start at the next login unless uninstalled)")

    def status(self, row):
        pid = live_pid(row["pier"])
        owner = host_at(row["http_port"]) if pid else None
        state = "HTTP ready" if owner == "~" + row["name"] else "starting" if pid else "stopped"
        if owner and owner != "~" + row["name"]:
            state = "wrong ship on HTTP port"
        if not pid and row["boot_started"] and not row["booted"]:
            state = "first boot needs review"
        rss = "-"
        if pid:
            out = run_checked(["ps", "-p", str(pid), "-o", "rss="]).decode().strip()
            if out.isdigit():
                rss = f"{int(out) / 1024:.1f} MiB RSS (Vere lock PID)"
        print(f"~{row['name']}  {state}  http={row['http_port']} udp={row['ames_port']}  {rss}")

    def boot_command(self, row):
        command = [row["runtime"], "--loom", str(row["loom"]), "--http-port", str(row["http_port"]),
                   "--ames-port", str(row["ames_port"]), "--http-ip", "127.0.0.1", "-t"]
        if not row["booted"]:
            command += ["--name", row["name"], "--key-file", row["keyfile"]]
        return command + [row["pier"]]

    def mark_booted(self, row):
        # Only retire keys after the running ship identifies itself on its pinned port.
        with self.locked() as data:
            current = data["moons"][row["name"]]
            current["booted"] = True
            # Persist verification before deleting any key, including across a power loss.
            self.save(data)
            keys = [Path(current["keyfile"])]
            if current.get("key_source"):
                keys.append(Path(current["key_source"]))
            for key in keys:
                if key.exists() and not key.is_symlink():
                    if key == Path(current["keyfile"]) or digest(key) == current["key_source_sha256"]:
                        key.unlink()
            current.pop("key_source", None)
            current.pop("key_source_sha256", None)
            self.save(data)

    def supervise(self, row):
        private_dir(self.root / "locks")
        fd = os.open(self.root / "locks" / row["name"], os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise ManagerError("another manager owns this ship") from exc
            if live_pid(row["pier"]):
                raise ManagerError("pier already has a running Vere; refusing a duplicate")
            if digest(Path(row["runtime"])) != row["runtime_sha256"]:
                raise ManagerError("internal runtime was changed; refusing to run it")
            if row["boot_started"] and not row["booted"]:
                raise ManagerError("unverified first boot needs operator review; no automatic key replay")
            if not row["booted"] and Path(row["pier"]).exists():
                raise ManagerError("first-boot pier already exists; refusing to overwrite it")
            assert_port_free(row["http_port"], socket.SOCK_STREAM)
            assert_port_free(row["ames_port"], socket.SOCK_DGRAM)
            if not row["booted"]:
                with self.locked() as data:
                    data["moons"][row["name"]]["boot_started"] = True
                    self.save(data)
            self.run_child(row)

    def run_child(self, row):
        child = None
        stopping = False
        def request_exit():
            try:
                dojo_input(row, "|exit")
            except (ManagerError, OSError):
                if child is not None and child.poll() is None:
                    child.terminate()
        def terminate(_signum, _frame):
            nonlocal stopping
            if stopping:
                return
            stopping = True
            if child is not None and child.poll() is None:
                threading.Thread(target=request_exit, daemon=True).start()
        signal.signal(signal.SIGTERM, terminate)
        signal.signal(signal.SIGINT, terminate)
        os.umask(0o077)
        logger = logging.getLogger("manor-moon." + row["name"])
        logger.setLevel(logging.INFO)
        logger.propagate = False
        handler = logging.handlers.RotatingFileHandler(row["log"], maxBytes=10 * 1024 * 1024, backupCount=2)
        logger.addHandler(handler)
        def record(line):
            logger.info(redact(line))
        child = subprocess.Popen(self.boot_command(row), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                 stdin=subprocess.DEVNULL, start_new_session=True)
        if stopping:
            threading.Thread(target=request_exit, daemon=True).start()
        confirmed = False
        pending = b""
        try:
            with selectors.DefaultSelector() as sel:
                os.set_blocking(child.stdout.fileno(), False)
                sel.register(child.stdout, selectors.EVENT_READ)
                while sel.get_map():
                    for key, _ in sel.select(timeout=2):
                        chunk = os.read(key.fd, 16384)
                        if not chunk:
                            sel.unregister(key.fileobj)
                            continue
                        pending += chunk
                        while b"\n" in pending or b"\r" in pending:
                            line, pending = re.split(b"[\r\n]", pending, maxsplit=1)
                            record(line.decode(errors="replace"))
                        if len(pending) > 65536:
                            pending = b""
                            record("manor: oversized log line omitted")
                    if not stopping:
                        ports = Path(row["pier"]) / ".http.ports"
                        if ports.exists():
                            public = re.findall(r"^(\d+) insecure public$", ports.read_text(), re.M)
                            if public and int(public[0]) != row["http_port"]:
                                raise ManagerError("Vere chose an unexpected HTTP port; stopping it")
                        if not confirmed:
                            identity = host_at(row["http_port"])
                            if identity and identity != "~" + row["name"]:
                                raise ManagerError("ship HTTP identity does not match the registered name; stopping it")
                            if identity:
                                self.mark_booted(row)
                                confirmed = True
                                record("manor: ship HTTP identity verified; bootstrap keys retired")
            if pending:
                record(pending.decode(errors="replace"))
            code = child.wait()
            if code and not stopping:
                raise ManagerError(f"Vere exited with status {code}; launchd will retry verified piers")
        finally:
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=180)
                except subprocess.TimeoutExpired:
                    record("manor: Vere still shutting down; no forced kill was sent")
            logger.removeHandler(handler)
            handler.close()
            child.stdout.close()


def positive_port(value):
    value = int(value)
    if not 1024 <= value <= 65535:
        raise argparse.ArgumentTypeError("use a port between 1024 and 65535")
    return value


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-dir", type=Path)
    sub = parser.add_subparsers(dest="command", required=True)
    add = sub.add_parser("add", help="boot a fresh keyed ship with Vere; adopt already-existing comets")
    add.add_argument("name")
    add.add_argument("keyfile")
    add.add_argument("--vere", required=True)
    add.add_argument("--pier", type=Path)
    add.add_argument("--http-port", type=positive_port)
    add.add_argument("--ames-port", type=positive_port)
    add.add_argument("--loom", type=int, choices=range(30, 35), default=31)
    add.add_argument("--no-start", action="store_true", help="stage privately without loading launchd")
    adopt = sub.add_parser("adopt", help="take over any stopped, initialized ship pier without changing its state")
    adopt.add_argument("name")
    adopt.add_argument("pier", type=Path)
    adopt.add_argument("--vere", help="defaults to the pier's current .run")
    adopt.add_argument("--http-port", type=positive_port)
    adopt.add_argument("--ames-port", type=positive_port)
    adopt.add_argument("--loom", type=int, choices=range(30, 35), default=31)
    adopt.add_argument("--no-start", action="store_true")
    runtime = sub.add_parser("runtime", help="change a stopped ship's pinned runtime, retaining the previous binary")
    runtime.add_argument("name")
    runtime.add_argument("--vere", required=True)
    for command in ("start", "stop", "restart", "status", "install", "uninstall", "plan", "logs", "code", "dojo", "_run"):
        cmd = sub.add_parser(command)
        cmd.add_argument("name", nargs="?" if command in ("status", "install", "uninstall", "plan") else None,
                         default="all")
        if command == "dojo":
            cmd.add_argument("text")
        if command == "logs":
            cmd.add_argument("--follow", action="store_true")
    args = parser.parse_args(argv)
    if sys.platform != "darwin":
        raise ManagerError("the ship manager requires macOS launchd")
    manager = Manager(args.state_dir)
    if args.command == "runtime":
        manager.set_runtime(args)
        return
    if args.command in ("add", "adopt"):
        getattr(manager, args.command)(args)
        return
    rows = manager.rows(args.name)
    if not rows:
        print("No ships registered.")
    if args.command in ("logs", "code", "dojo", "_run") and len(rows) != 1:
        raise ManagerError("this command requires exactly one ship")
    for row in rows:
        if args.command == "plan":
            print(plistlib.dumps(manager.plist(row)).decode())
        elif args.command in ("start", "stop", "status"):
            getattr(manager, args.command)(row)
        elif args.command == "restart":
            manager.stop(row)
            manager.start(manager.rows(row["name"])[0])
        elif args.command == "install":
            manager.install(row)
            print(f"~{row['name']}: installed for next login; use start to load now")
        elif args.command == "uninstall":
            manager.stop(row)
            manager.plist_path(row).unlink(missing_ok=True)
            print(f"~{row['name']}: launchd agent removed; pier and registry retained")
        elif args.command == "logs":
            logfile = Path(row["log"])
            if not logfile.exists():
                print("No ship log yet.")
            else:
                os.execv("/usr/bin/tail", ["tail", "-n", "60"] + (["-f"] if args.follow else []) + [str(logfile)])
        elif args.command == "code":
            answer = exchange(row, "[1 %fyrd [%base %code %noun [%noun ~]]]")
            match = re.fullmatch(r"\[1 %avow 0 %noun ([0-9.]+|0x[0-9a-f.]+|0v[0-9a-v.]+|0w[0-9A-Za-z.~\-]+|~[a-z-]+)\]", answer)
            if not match:
                raise ManagerError("ship did not return a login code")
            value = run_checked([row["runtime"], "eval"], input=f"(scot %p {canonical_atom(match[1])})".encode(), sensitive=True).decode()
            run_checked(["/usr/bin/pbcopy"], input=parse_login_code(value).encode(), sensitive=True)
            print("Login code copied to clipboard. It was not printed or saved.")
        elif args.command == "dojo":
            if args.text.strip() == "+code":
                raise ManagerError("use ./manor ship code <ship> to copy the code privately")
            print(redact(dojo_input(row, args.text)))
        elif args.command == "_run":
            manager.supervise(row)


if __name__ == "__main__":
    try:
        main()
    except (ManagerError, OSError) as exc:
        print("manor ship: " + redact(str(exc)), file=sys.stderr)
        sys.exit(1)
