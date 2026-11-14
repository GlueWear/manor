from pathlib import Path
import contextlib
import io
import json
import stat
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import live_companion
import check_companion
import moons


class LiveCompanionTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).resolve().parent.parent
        self.name = "~pilfep-sicted-mignes-magtel"

    def test_source_pins_the_registered_moon_and_uses_ungrouped_url_ports(self):
        code = live_companion.source(self.root, self.name, 8101, "status")
        self.assertNotIn("__TARGET__", code)
        self.assertNotIn("__PORT__", code)
        self.assertIn("=(8.101 port.st)", code)
        self.assertIn("(crip (a-co:co port))", code)
        self.assertNotIn("(scot %ud port)", code)
        self.assertIn(self.name, code)
        self.assertIn("%poke %manor-moon-action !>(request)", code)
        self.assertNotIn("%poke-as", code)

    def test_source_rejects_invalid_target_port_or_mode(self):
        for target, port, mode in (("~siglup-narwet", 8101, "status"), (self.name, 80, "status"), (self.name, True, "status"), (self.name, 8101, "anything")):
            with self.subTest(target=target, port=port, mode=mode), self.assertRaises(moons.ManagerError):
                live_companion.source(self.root, target, port, mode)

    def test_compile_only_constructs_the_form_without_executing_it(self):
        code = live_companion.source(self.root, self.name, 8101, "session", compile_only=True)
        self.assertIn("candidate=form:m  run", code)
        self.assertNotIn("((set-timeout vase) ~m1 run)", code)

    def test_live_failure_never_echoes_a_cookie_or_arbitrary_error_tag(self):
        secret = "urbauth-~moon=private-cookie-value"
        response = f"[1 %avow 1 %thread-fail %probe-stolen-value {secret}]"
        with patch.object(moons, "exchange", return_value=response):
            with self.assertRaises(moons.ManagerError) as error:
                live_companion.run({}, "test")
        self.assertNotIn(secret, str(error.exception))
        self.assertNotIn("probe-stolen-value", str(error.exception))
        self.assertIn("unconfirmed", str(error.exception))

    def test_live_failure_reports_only_safe_stage_or_http_status(self):
        for stage in ("probe-agent-login-refused", "probe-baseline-404"):
            response = f"[1 %avow 1 %thread-fail %{stage} private-data]"
            with self.subTest(stage=stage), patch.object(moons, "exchange", return_value=response):
                with self.assertRaises(moons.ManagerError) as error:
                    live_companion.run({}, "test")
            self.assertIn(stage, str(error.exception))
            self.assertNotIn("private-data", str(error.exception))

    def test_revocation_requires_confirmation_before_reading_any_pier(self):
        with patch.object(sys, "argv", ["live_companion.py", self.name, "revoke"]), patch.object(moons, "Manager") as manager:
            with self.assertRaisesRegex(moons.ManagerError, "confirm-revoke"):
                live_companion.main()
            manager.assert_not_called()

    def test_profile_changes_require_confirmation_before_reading_any_pier(self):
        with patch.object(sys, "argv", ["live_companion.py", self.name, "profile"]), patch.object(moons, "Manager") as manager:
            with self.assertRaisesRegex(moons.ManagerError, "confirm-profile"):
                live_companion.main()
            manager.assert_not_called()

    def test_private_profile_reply_round_trips_without_printing_it(self):
        profile = {"displayName": "Original name", "avatar": {"type": "external", "url": "https://example.com/avatar.png"}}
        answer = "[1 %avow 0 %noun " + check_companion.cord(json.dumps(profile)) + "]"
        self.assertEqual(live_companion.parse_profile(answer), profile)
        byte_list = "[" + " ".join(str(byte) for byte in json.dumps(profile).encode()) + " 0]"
        self.assertEqual(live_companion.parse_profile("[1 %avow 0 %noun " + byte_list + "]"), profile)
        self.assertEqual(live_companion.parse_profile("[1 %avow 0 %noun " + byte_list[1:-1] + "]"), profile)

    def test_profile_test_refuses_unrestorable_avatar_or_name(self):
        for profile in (
            {"displayName": None, "avatar": {"type": "urbit", "url": "0v1"}},
            {"displayName": "", "avatar": None},
            {"displayName": None, "avatar": {"type": "external", "url": "javascript:bad"}},
            {"displayName": None, "avatar": None, "cookie": "must-not-be-accepted"},
        ):
            with self.subTest(profile=profile), self.assertRaises(moons.ManagerError):
                live_companion.validate_profile(profile)

    def test_profile_backup_is_private_and_test_output_omits_its_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "state"
            target = {"name": self.name[1:], "http_port": 8101}
            manager = SimpleNamespace(root=root, rows=lambda name: [target])
            profile = {"displayName": "Private original name", "avatar": None}
            output = io.StringIO()
            with patch.object(sys, "argv", ["live_companion.py", self.name, "profile", "--confirm-profile"]), patch.object(moons, "Manager", return_value=manager), patch.object(live_companion, "run", side_effect=[profile, None]), contextlib.redirect_stdout(output):
                live_companion.main()
            files = list((root / "backups/profiles").glob("*.json"))
            self.assertEqual(len(files), 1)
            self.assertEqual(stat.S_IMODE(files[0].stat().st_mode), 0o600)
            self.assertEqual(json.loads(files[0].read_text())["profile"], profile)
            self.assertNotIn(profile["displayName"], output.getvalue())

    def test_failed_profile_test_attempts_to_restore_from_private_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            target = {"name": self.name[1:], "http_port": 8101}
            manager = SimpleNamespace(root=Path(directory) / "state", rows=lambda name: [target])
            profile = {"displayName": "Original", "avatar": None}
            with patch.object(sys, "argv", ["live_companion.py", self.name, "profile", "--confirm-profile"]), patch.object(moons, "Manager", return_value=manager), patch.object(live_companion, "run", side_effect=[profile, moons.ManagerError("probe-profile-write-failed"), None]) as run, contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaisesRegex(moons.ManagerError, "were restored"):
                    live_companion.main()
            self.assertEqual(run.call_count, 3)
            self.assertIn("%profile-restore %profile", run.call_args.args[1])


if __name__ == "__main__":
    unittest.main()
