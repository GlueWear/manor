from pathlib import Path
import re
import unittest
from unittest.mock import patch

import check_companion
import moons


class CompanionProbeTests(unittest.TestCase):
    def test_source_encoding_round_trips_utf8_without_hoon_quoting(self):
        for source in ("", "(add 2 2)", "'quoted'\\n\n", "caf\u00e9"):
            atom = check_companion.cord(source)
            self.assertRegex(atom, r"^0x[0-9a-f]{1,4}(?:\.[0-9a-f]{4})*$")
            value = int(atom[2:].replace(".", ""), 16)
            data = value.to_bytes((value.bit_length() + 7) // 8, "little")
            self.assertEqual(data.decode(), source)

    def test_probe_uses_typed_input_and_waits_for_the_full_exchange(self):
        with patch.object(moons, "exchange", return_value="[1 %avow 0 %noun 4]") as exchange:
            self.assertEqual(check_companion.evaluate({}, "(add 2 2)"), "4")
        self.assertIn("%eval %noun [%ted-eval 0x", exchange.call_args.args[1])
        self.assertEqual(exchange.call_args.kwargs["timeout"], 300)

    def test_failed_probe_reports_a_readable_compiler_location(self):
        response = "[1 %avow 1 %thread-fail %false-start [%leaf 98 97 100 0]]"
        with patch.object(moons, "exchange", return_value=response):
            with self.assertRaisesRegex(moons.ManagerError, "probe failed: bad"):
                check_companion.evaluate({}, "not-hoon")

    def test_test_mocks_do_not_replace_production_code(self):
        root = Path(__file__).resolve().parent.parent
        original = (root / "moon-desk/app/manor-moon.hoon").read_bytes()
        real = check_companion.companion(root)
        mocked = check_companion.companion(root, mock_scries=True)
        self.assertIn(".^(@p %j", real)
        self.assertIn("authentication-state:eyre", real)
        self.assertNotIn(".^(@p %j", mocked)
        self.assertNotIn("authentication-state:eyre", mocked)
        self.assertIn("password=fixture-only", mocked)
        self.assertEqual(original, (root / "moon-desk/app/manor-moon.hoon").read_bytes())
        self.assertNotRegex(real, re.compile(r"^/-", re.M))

    def test_generator_probe_passes_system_arguments_positional_list_and_options(self):
        root = Path(__file__).resolve().parent.parent
        source = check_companion.generator_tests(root)
        self.assertIn("(gate [system [~siglup-narwet ~] ~])", source)
        self.assertEqual(source.count("(gate [system ~ ~])"), 2)
        self.assertIn("[%manor-moon-action %pair `~siglup-narwet]", source)


if __name__ == "__main__":
    unittest.main()
