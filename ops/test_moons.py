import argparse
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import plistlib
import socket
import stat
import struct
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("moons", Path(__file__).with_name("moons.py"))
moons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(moons)


SHIP_NAMES = (
    "zod", "nolset", "siglup-narwet", "pilfep-sicted-mignes-magtel",
    "tacput-forlur-mopweb-docled--pilfep-sicted-mignes-magtel",
)
FIXTURE_NAMES = SHIP_NAMES + (
    "sampel-siglup-narwet", "sampel-palnet-siglup-narwet", "sampel-palnet-disden-talhes",
)

# Only recognizes the offline validation contract, then delegates fixture boots.
FAKE_VERE = """#!/usr/bin/env python3
import os
import sys
if sys.argv[1:] == ["eval"]:
    source = sys.stdin.read()
    expected = {"=('~" + name + "' (scot %p (slav %p '~" + name + "')))\\n"
                for name in __NAMES__}
    print("%.y" if source in expected else "%.n")
else:
    os.execv(sys.executable, [sys.executable, __BOOT_FIXTURE__] + sys.argv[1:])
"""


class MoonTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name).resolve()
        self.manager = moons.Manager(self.home / "state", home=self.home)
        self.binary = self.home / "vere"
        self.binary.write_text(FAKE_VERE.replace("__NAMES__", repr(FIXTURE_NAMES)).replace(
            "__BOOT_FIXTURE__", repr(str(Path(__file__).parent / "fixtures/vere.py"))))
        self.binary.chmod(0o700)
        self.key = self.home / "moon.key"
        self.secret = b"0w123456789abcdefghijk.lmnopqrstuvwxyz"
        self.key.write_bytes(self.secret)
        self.args = argparse.Namespace(name="~sampel-palnet-siglup-narwet", keyfile=str(self.key),
            vere=str(self.binary), pier=None, http_port=8101, ames_port=42001, loom=31, no_start=True)

    def add(self):
        with patch.object(moons, "assert_port_free"), contextlib.redirect_stdout(io.StringIO()):
            self.manager.add(self.args)
        return self.manager.rows(self.args.name)[0]

    def test_ship_names_accept_all_classes_with_optional_sigil(self):
        for name in FIXTURE_NAMES:
            for value in (name, "~" + name):
                with self.subTest(name=value):
                    self.assertEqual(moons.ship_name(value), name)
        # Comets can have fewer than eight words, still grouped from the right.
        for words in range(1, 5):
            name = "-".join(["tacput"] * words) + "--pilfep-sicted-mignes-magtel"
            self.assertEqual(moons.ship_name("~" + name), name)

    def test_moon_companion_name_helper_keeps_its_moon_only_contract(self):
        for name in FIXTURE_NAMES:
            with self.subTest(name=name):
                if len(name.split("-")) in (3, 4):
                    self.assertEqual(moons.moon_name("~" + name), name)
                else:
                    with self.assertRaises(moons.ManagerError):
                        moons.moon_name("~" + name)

    def test_ship_names_reject_unsafe_non_lowercase_and_malformed_values(self):
        for name in ("", "~", ".", "..", "../moon", "~zod/", "/zod", "~Zod", "~~zod",
                     "~zod ", " ~zod", "~zod\n", "~zod\t", "~zod\0", "~zod\\moon", "~zod;id",
                     "~zod'", "~zod$(id)", "~zod_", "~z\u00f8d", "~123", "~abcd", "~zod--nolset",
                     "~siglup--narwet", "~pilfep-sicted--mignes-magtel",
                     "-".join(["pilfep"] * 8), "--".join(["pilfep-sicted-mignes-magtel"] * 3),
                     None, 123):
            with self.subTest(name=name), self.assertRaises(moons.ManagerError):
                moons.ship_name(name)

    def test_offline_name_validation_uses_only_chosen_runtime_and_fixed_source(self):
        for name in FIXTURE_NAMES:
            with self.subTest(name=name):
                moons.validate_ship_name(name, self.binary)
        with patch.object(moons, "run_checked", return_value=b"\x1b[32m%.y\x1b[0m\n") as run:
            moons.validate_ship_name("~zod", self.binary)
        run.assert_called_once_with([str(self.binary), "eval"],
            input=b"=('~zod' (scot %p (slav %p '~zod')))\n", sensitive=True)
        with patch.object(moons, "run_checked") as run, self.assertRaises(moons.ManagerError):
            moons.validate_ship_name("zod'", self.binary)
        run.assert_not_called()

    def test_offline_validation_fails_closed_without_exposing_output(self):
        for answer in (b"%.n\n", b"", b"private runtime output", b"%.y\nextra", b"0\n"):
            with self.subTest(answer=answer), patch.object(moons, "run_checked", return_value=answer):
                with self.assertRaises(moons.ManagerError) as caught:
                    moons.validate_ship_name("zod", self.binary)
                self.assertNotIn("private runtime output", str(caught.exception))
        with patch.object(moons, "run_checked", side_effect=moons.ManagerError("offline failure")):
            with self.assertRaises(moons.ManagerError):
                moons.validate_ship_name("zod", self.binary)

    def test_rejected_offline_name_does_not_register_stage_keys_or_start(self):
        self.args.name = "~aaaaaa"  # Safe shape, not a canonical identity in the fixture.
        with patch.object(self.manager, "start") as start, patch.object(moons, "assert_port_free") as ports:
            with self.assertRaises(moons.ManagerError):
                self.manager.add(self.args)
        start.assert_not_called()
        ports.assert_not_called()
        self.assertFalse(self.manager.registry.exists())
        self.assertFalse((self.manager.root / "keys").exists())
        self.assertFalse((self.home / "Moons").exists())
        self.assertEqual(self.key.read_bytes(), self.secret)

    def test_key_boot_of_each_class_keeps_existing_vere_flags(self):
        for name in SHIP_NAMES:
            with self.subTest(name=name):
                self.args.name = "~" + name
                self.args.http_port = self.args.ames_port = None
                row = self.add()
                command = self.manager.boot_command(row)
                self.assertEqual(command, [row["runtime"], "--loom", "31", "--http-port",
                    str(row["http_port"]), "--ames-port", str(row["ames_port"]),
                    "--http-ip", "127.0.0.1", "-t", "--name", name, "--key-file", row["keyfile"], row["pier"]])
                self.assertEqual(Path(row["pier"]), self.home / "Moons" / name)

    def test_ship_and_moon_cli_aliases_share_registry_and_launchagent_plan(self):
        row = self.add()
        registry = self.manager.registry.read_bytes()
        script = Path(__file__).resolve().parent.parent / "manor"
        for alias in ("ship", "moon"):
            with self.subTest(alias=alias):
                result = subprocess.run([str(script), alias, "--state-dir", str(self.manager.root),
                    "plan", "~" + row["name"]], capture_output=True, timeout=10,
                    env={**os.environ, "HOME": str(self.home)})
                self.assertEqual(result.returncode, 0, result.stderr.decode())
                self.assertEqual(plistlib.loads(result.stdout), self.manager.plist(row))
        self.assertEqual(self.manager.registry.read_bytes(), registry)
        self.assertFalse(self.manager.agents.exists())

    def test_legacy_registry_labels_wrapper_paths_and_owned_metadata_are_preserved(self):
        row = self.add()
        row["operator_metadata"] = {"owner": "existing", "tags": ["keep"]}
        with self.manager.locked() as data:
            data["operator_metadata"] = {"version": "keep"}
            data["moons"][row["name"]] = row
            self.manager.save(data)
        with patch.object(moons, "validate_ship_name") as validate:
            self.assertEqual(self.manager.rows("~" + row["name"]), [row])
            validate.assert_not_called()
        self.args.name = "~zod"
        self.args.http_port = self.args.ames_port = None
        self.add()
        data = json.loads(self.manager.registry.read_text())
        self.assertEqual(data["version"], 1)
        self.assertEqual(data["operator_metadata"], {"version": "keep"})
        self.assertEqual(data["moons"][row["name"]], row)
        self.assertEqual(self.manager.registry.name, "moons.json")
        label = "io.gluewear.manor.moon." + row["name"]
        self.assertEqual(self.manager.label(row), label)
        self.assertEqual(self.manager.plist_path(row).name, label + ".plist")
        self.assertIn(str(self.manager.root / "bin/moons.py"), self.manager.plist(row)["ProgramArguments"])

    def test_unsafe_registered_name_is_rejected_before_lifecycle_actions(self):
        row = self.add()
        with self.manager.locked() as data:
            data["moons"] = {"../zod": {**row, "name": "../zod"}}
            self.manager.save(data)
        with self.assertRaises(moons.ManagerError):
            self.manager.rows()

    def test_registration_stages_private_keys_and_pins_runtime_without_creating_pier(self):
        row = self.add()
        for path in (Path(row["keyfile"]), self.key, self.manager.registry):
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        self.assertEqual(Path(row["runtime"]).read_bytes(), self.binary.read_bytes())
        self.assertFalse(Path(row["pier"]).exists())
        self.assertNotIn(self.secret.decode(), self.manager.registry.read_text())

    def test_rejects_duplicate_registration_or_preexisting_pier_without_replacing_keys(self):
        row = self.add()
        with self.assertRaises(moons.ManagerError):
            self.manager.add(self.args)
        self.assertEqual(Path(row["keyfile"]).read_bytes().strip(), self.secret)
        self.args.name = "~sampel-palnet-disden-talhes"
        self.args.pier = self.home / "already-a-pier"
        self.args.pier.mkdir()
        with self.assertRaises(moons.ManagerError):
            self.manager.add(self.args)

    def test_external_volume_and_key_symlink_are_rejected(self):
        with self.assertRaises(moons.ManagerError):
            moons.internal("/Volumes/DEV/pier")
        self.args.keyfile = self.home / "link.key"
        self.args.keyfile.symlink_to(self.key)
        with self.assertRaises(moons.ManagerError):
            self.manager.add(self.args)

    def test_reserved_ports_cannot_be_reused(self):
        self.add()
        self.args.name = "~zod"
        with patch.object(moons, "assert_port_free"), self.assertRaises(moons.ManagerError):
            self.manager.add(self.args)

    def test_adoption_preserves_initialized_pier_and_uses_no_boot_key(self):
        pier = self.home / "existing"
        (pier / ".urb/log").mkdir(parents=True)
        (pier / ".urb/log/data.mdb").write_bytes(b"existing state")
        args = argparse.Namespace(name=self.args.name, pier=pier, vere=str(self.binary),
            http_port=8101, ames_port=42001, loom=31, no_start=True)
        with patch.object(moons, "assert_port_free"), contextlib.redirect_stdout(io.StringIO()):
            self.manager.adopt(args)
        row = self.manager.rows(args.name)[0]
        self.assertTrue(row["adopted"])
        self.assertEqual((pier / ".urb/log/data.mdb").read_bytes(), b"existing state")
        self.assertNotIn("--key-file", self.manager.boot_command(row))
        self.assertNotIn("--name", self.manager.boot_command(row))

    def test_adoption_of_each_ship_class_keeps_state_and_current_runtime_without_rekey(self):
        for name in SHIP_NAMES:
            with self.subTest(name=name):
                pier = self.home / "existing" / name
                (pier / ".urb/log").mkdir(parents=True)
                state = pier / ".urb/log/data.mdb"
                state.write_bytes(b"existing state, including existing identity and keys")
                (pier / ".run").symlink_to(self.binary)
                args = argparse.Namespace(name="~" + name, pier=pier, vere=None,
                    http_port=None, ames_port=None, loom=31, no_start=True)
                with patch.object(moons, "assert_port_free"), patch.object(self.manager, "start") as start:
                    with contextlib.redirect_stdout(io.StringIO()):
                        self.manager.adopt(args)
                start.assert_not_called()
                row = self.manager.rows(name)[0]
                self.assertTrue(row["adopted"] and row["booted"] and row["boot_started"])
                self.assertEqual(state.read_bytes(), b"existing state, including existing identity and keys")
                self.assertTrue((pier / ".run").is_symlink())
                self.assertEqual(Path(row["runtime"]).read_bytes(), self.binary.read_bytes())
                self.assertFalse(Path(row["keyfile"]).exists())
                self.assertNotIn("key_source", row)
                self.assertEqual(self.manager.boot_command(row), [row["runtime"], "--loom", "31",
                    "--http-port", str(row["http_port"]), "--ames-port", str(row["ames_port"]),
                    "--http-ip", "127.0.0.1", "-t", str(pier)])

    def test_adoption_rejects_noncanonical_name_without_touching_pier(self):
        pier = self.home / "existing"
        (pier / ".urb/log").mkdir(parents=True)
        state = pier / ".urb/log/data.mdb"
        state.write_bytes(b"existing state")
        args = argparse.Namespace(name="~aaaaaa", pier=pier, vere=str(self.binary),
            http_port=None, ames_port=None, loom=31, no_start=False)
        with patch.object(self.manager, "start") as start, self.assertRaises(moons.ManagerError):
            self.manager.adopt(args)
        start.assert_not_called()
        self.assertEqual(state.read_bytes(), b"existing state")
        self.assertFalse(self.manager.registry.exists())
        self.assertFalse((self.manager.root / "keys").exists())

    def test_adoption_cannot_register_same_pier_under_another_ship_class(self):
        row = self.add()
        pier = Path(row["pier"])
        (pier / ".urb/log").mkdir(parents=True)
        (pier / ".urb/log/data.mdb").write_bytes(b"existing state")
        with self.assertRaises(moons.ManagerError):
            self.manager.adopt(argparse.Namespace(name="~zod", pier=pier))

    def test_adoption_rejects_an_existing_live_pier(self):
        pier = self.home / "existing"
        (pier / ".urb/log").mkdir(parents=True)
        (pier / ".urb/log/data.mdb").write_bytes(b"existing state")
        (pier / ".vere.lock").write_text(str(os.getpid()))
        args = argparse.Namespace(name=self.args.name, pier=pier)
        with self.assertRaises(moons.ManagerError):
            self.manager.adopt(args)

    def test_lock_with_stale_and_live_pids_reports_newest_live_pid(self):
        pier = self.home / "existing"
        pier.mkdir()
        (pier / ".vere.lock").write_text("12345\n23456\n")
        with patch.object(moons.os, "kill") as kill:
            self.assertEqual(moons.live_pid(pier), 23456)
            kill.assert_called_once_with(23456, 0)

    def test_lock_checks_older_pids_before_allowing_a_second_vere(self):
        pier = self.home / "existing"
        pier.mkdir()
        (pier / ".vere.lock").write_text("12345\n23456\n")
        with patch.object(moons.os, "kill", side_effect=[ProcessLookupError(), None]) as kill:
            self.assertEqual(moons.live_pid(pier), 12345)
            self.assertEqual(kill.call_args_list[1].args, (12345, 0))
        with patch.object(moons.os, "kill", side_effect=ProcessLookupError()):
            self.assertIsNone(moons.live_pid(pier))

    def test_invalid_or_inaccessible_lock_remains_a_hard_refusal(self):
        pier = self.home / "existing"
        pier.mkdir()
        for contents in ("", "0", "-1", "12345\nnot-a-pid\n"):
            (pier / ".vere.lock").write_text(contents)
            with self.subTest(contents=contents), self.assertRaises(moons.ManagerError):
                moons.live_pid(pier)
        (pier / ".vere.lock").write_text("12345\n23456\n")
        with patch.object(moons.os, "kill", side_effect=PermissionError()), self.assertRaises(moons.ManagerError):
            moons.live_pid(pier)

    def test_runtime_change_retains_previous_binary_and_requires_stopped_job(self):
        row = self.add()
        other = self.home / "new-vere"
        other.write_bytes(b"a different test binary")
        other.chmod(0o700)
        args = argparse.Namespace(name=row["name"], vere=str(other))
        with patch.object(self.manager, "loaded", return_value=True), self.assertRaises(moons.ManagerError):
            self.manager.set_runtime(args)
        with patch.object(self.manager, "loaded", return_value=False), patch.object(moons, "live_pid", return_value=123), self.assertRaises(moons.ManagerError):
            self.manager.set_runtime(args)
        with patch.object(self.manager, "loaded", return_value=False), contextlib.redirect_stdout(io.StringIO()):
            self.manager.set_runtime(args)
        current = self.manager.rows(row["name"])[0]
        self.assertNotEqual(current["runtime"], row["runtime"])
        self.assertEqual(current["runtime_history"][0]["runtime"], row["runtime"])
        self.assertTrue(Path(row["runtime"]).exists())

    def test_bound_tcp_and_udp_ports_are_rejected(self):
        for kind in (socket.SOCK_STREAM, socket.SOCK_DGRAM):
            with socket.socket(socket.AF_INET, kind) as sock:
                sock.bind(("127.0.0.1", 0))
                with self.assertRaises(moons.ManagerError):
                    moons.assert_port_free(sock.getsockname()[1], kind)

    def test_plist_is_internal_pinned_and_parseable_even_with_special_path_characters(self):
        row = self.add()
        self.manager.root = self.home / "spaces & <xml>"
        plist = plistlib.loads(plistlib.dumps(self.manager.plist(row)))
        self.assertTrue(plist["KeepAlive"])
        self.assertTrue(plist["RunAtLoad"])
        self.assertEqual(plist["ExitTimeOut"], 240)
        self.assertIn(str(self.manager.root), plist["ProgramArguments"])
        self.assertFalse(any("/Volumes/" in a for a in plist["ProgramArguments"]))
        command = self.manager.boot_command(row)
        self.assertEqual(command[command.index("--http-port") + 1], "8101")
        self.assertEqual(command[command.index("--ames-port") + 1], "42001")
        self.assertNotIn(self.secret.decode(), " ".join(command))

    def test_start_refuses_a_pier_running_outside_launchd(self):
        row = self.add()
        pier = Path(row["pier"])
        pier.mkdir()
        (pier / ".vere.lock").write_text(str(os.getpid()))
        with patch.object(self.manager, "loaded", return_value=False), patch.object(self.manager, "install") as install:
            with self.assertRaises(moons.ManagerError):
                self.manager.start(row)
            install.assert_not_called()

    def test_stop_refuses_to_signal_unmanaged_pier(self):
        row = self.add()
        with patch.object(self.manager, "loaded", return_value=False), patch.object(moons, "live_pid", return_value=123), patch.object(moons, "run_checked") as run:
            with self.assertRaises(moons.ManagerError):
                self.manager.stop(row)
            run.assert_not_called()

    def test_stop_uses_bootout_and_does_not_send_sigkill(self):
        row = self.add()
        with patch.object(self.manager, "loaded", return_value=True), patch.object(moons, "live_pid", return_value=None), patch.object(moons, "run_checked") as run, contextlib.redirect_stdout(io.StringIO()):
            self.manager.stop(row)
            self.assertEqual(run.call_args.args[0][:2], ["launchctl", "bootout"])
            self.assertGreater(run.call_args.kwargs["timeout"], 180)

    def test_boot_verification_retires_keys_and_restart_drops_boot_flags(self):
        row = self.add()
        self.manager.mark_booted(row)
        self.assertFalse(Path(row["keyfile"]).exists())
        self.assertFalse(self.key.exists())
        ready = self.manager.rows(row["name"])[0]
        self.assertTrue(ready["booted"])
        self.assertNotIn("--key-file", self.manager.boot_command(ready))
        self.manager.mark_booted(ready)  # idempotent on subsequent restarts

    def test_changed_source_key_is_preserved(self):
        row = self.add()
        self.key.write_bytes(b"replacement key contents")
        self.manager.mark_booted(row)
        self.assertEqual(self.key.read_bytes(), b"replacement key contents")

    def test_interrupted_boot_cannot_replay_key_or_overwrite_pier(self):
        row = self.add()
        row["boot_started"] = True
        with patch.object(self.manager, "loaded", return_value=False), self.assertRaises(moons.ManagerError):
            self.manager.start(row)
        with self.assertRaises(moons.ManagerError):
            self.manager.supervise(row)

    def test_second_supervisor_is_rejected(self):
        row = self.add()
        moons.private_dir(self.manager.root / "locks")
        with (self.manager.root / "locks" / row["name"]).open("w") as lock:
            moons.fcntl.flock(lock, moons.fcntl.LOCK_EX | moons.fcntl.LOCK_NB)
            with self.assertRaises(moons.ManagerError):
                self.manager.supervise(row)

    def test_secrets_are_redacted_before_logging(self):
        code = "~lidlut-tabwed-pillex-ridrup"
        cookie = "urbauth-~sampel-palnet=session-secret"
        text = f"{code} {cookie} {self.secret.decode()} password=topsecret&ok=1"
        out = moons.redact(text)
        for secret in (code, "session-secret", self.secret.decode(), "topsecret"):
            self.assertNotIn(secret, out)
        self.assertNotIn("session-secret", moons.redact("Set-Cookie: " + cookie))

    def test_code_goes_only_to_clipboard(self):
        row = self.add()
        secret = "lidlut-tabwed-pillex-ridrup"
        for atom in ("12.345.678", "0x1234.abcd", "0vabc.123", "0wAbc.12-~", "~" + secret):
            with self.subTest(format=atom[:2]):
                output = io.StringIO()
                with patch.object(moons, "exchange", return_value=f"[1 %avow 0 %noun {atom}]"), patch.object(moons, "run_checked", side_effect=[("'~" + secret + "'").encode(), b""]) as checked, contextlib.redirect_stdout(output):
                    moons.main(["--state-dir", str(self.manager.root), "code", row["name"]])
                self.assertEqual(checked.call_args.kwargs["input"], secret.encode())
                self.assertEqual(checked.call_args.args[0], ["/usr/bin/pbcopy"])
                self.assertNotIn(secret, output.getvalue())
                self.assertNotIn(secret, self.manager.registry.read_text())

    def test_private_control_error_does_not_include_raw_code_from_stderr(self):
        result = subprocess.CompletedProcess(["urbit"], 1, b"", b"error 12345678 is the login code")
        with patch.object(subprocess, "run", return_value=result), self.assertRaises(moons.ManagerError) as caught:
            moons.run_checked(["urbit"], sensitive=True)
        self.assertNotIn("12345678", str(caught.exception))

    def test_code_formatter_accepts_actual_colored_eval_knot_output(self):
        secret = "lidlut-tabwed-pillex-ridrup"
        for value in ("'~" + secret + "'", "~.~" + secret, "\x1b[38;5;244m~.~" + secret + "\x1b[0m\n"):
            self.assertEqual(moons.parse_login_code(value), secret)
        with self.assertRaises(moons.ManagerError) as caught:
            moons.parse_login_code("arbitrary secret output")
        self.assertNotIn("arbitrary secret output", str(caught.exception))

    def test_padded_pretty_hex_is_converted_to_a_valid_hoon_atom(self):
        self.assertEqual(moons.canonical_atom("0x0000.0001"), "1")
        self.assertEqual(moons.canonical_atom("0x000f.abcd"), format(int("fabcd", 16), ",").replace(",", "."))
        self.assertEqual(moons.canonical_atom("12.345.678"), "12.345.678")

    def test_dojo_returns_redacted_command_result(self):
        row = self.add()
        output = io.StringIO()
        with patch.object(moons, "dojo_input", return_value="result urbauth-test=private") as command, contextlib.redirect_stdout(output):
            moons.main(["--state-dir", str(self.manager.root), "dojo", row["name"], '+vats'])
        command.assert_called_once_with(row, "+vats")
        self.assertIn("result", output.getvalue())
        self.assertNotIn("private", output.getvalue())

    def test_lens_translates_hood_and_app_commands_to_generator_and_sink(self):
        self.assertEqual(moons.lens_command("|exit"),
            {"source": {"dojo": "+hood/exit"}, "sink": {"app": "hood"}})
        self.assertEqual(moons.lens_command("|install ~nolset %glurff"),
            {"source": {"dojo": "+hood/install ~nolset %glurff"}, "sink": {"app": "hood"}})
        self.assertEqual(moons.lens_command(":hood +hood/exit"), moons.lens_command("|exit"))
        self.assertEqual(moons.lens_command("+vats")["sink"], {"stdout": None})

    def test_fragmented_delayed_control_reply_is_read_fully(self):
        left, right = socket.socketpair()
        self.addCleanup(left.close)
        self.addCleanup(right.close)
        frame = b"\0" + struct.pack("<I", 4) + b"body"
        def send():
            for block in (frame[:2], frame[2:6], frame[6:]):
                right.sendall(block)
                time.sleep(0.01)
        thread = threading.Thread(target=send)
        thread.start()
        self.assertEqual(moons.receive_frame(left), frame)
        thread.join()

    def test_truncated_and_oversized_frames_are_rejected(self):
        for payload in (b"\0" + struct.pack("<I", 4) + b"x", b"\0" + struct.pack("<I", 20 * 1024 * 1024)):
            left, right = socket.socketpair()
            with left, right:
                right.sendall(payload)
                right.shutdown(socket.SHUT_WR)
                with self.assertRaises(moons.ManagerError):
                    moons.receive_frame(left)

    def test_real_supervisor_boot_shutdown_and_restart_with_fixture_process(self):
        for field, kind in (("http_port", socket.SOCK_STREAM), ("ames_port", socket.SOCK_DGRAM)):
            with socket.socket(socket.AF_INET, kind) as sock:
                sock.bind(("127.0.0.1", 0))
                setattr(self.args, field, sock.getsockname()[1])
        row = self.add()
        script = str(Path(__file__).with_name("moons.py"))
        def start():
            return subprocess.Popen([sys.executable, script, "--state-dir", str(self.manager.root),
                                     "_run", row["name"]], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        def wait_for(predicate):
            deadline = time.monotonic() + 10
            while not predicate():
                if proc.poll() is not None:
                    self.fail("fixture supervisor exited: " + proc.stderr.read().decode())
                if time.monotonic() >= deadline:
                    self.fail("fixture supervisor did not reach expected state")
                time.sleep(0.05)
        for first in (True, False):
            proc = start()
            try:
                wait_for(lambda: self.manager.rows(row["name"])[0]["booted"]
                         and moons.host_at(row["http_port"]) == "~" + row["name"])
                if first:
                    self.assertFalse(self.key.exists())
                    self.assertFalse(Path(row["keyfile"]).exists())
                self.assertEqual(moons.dojo_input(row, "+vats"), "fixture command output")
                proc.terminate()
                out, err = proc.communicate(timeout=10)
                self.assertEqual(proc.returncode, 0, err.decode())
                self.assertIsNone(moons.live_pid(row["pier"]))
                self.assertEqual((Path(row["pier"]) / "last-command").read_text(), "+hood/exit")
                log = Path(row["log"]).read_text()
                self.assertIn("fixture graceful shutdown", log)
                for secret in (self.secret.decode(), "secret-cookie", "~lidlut-tabwed-pillex-ridrup"):
                    self.assertNotIn(secret, log)
                    self.assertNotIn(secret.encode(), out + err)
            finally:
                if proc.poll() is None:
                    proc.terminate()
                    proc.communicate(timeout=10)
                proc.stdout.close()
                proc.stderr.close()
        self.assertIn("fixture boot existing", Path(row["log"]).read_text())


if __name__ == "__main__":
    unittest.main()
