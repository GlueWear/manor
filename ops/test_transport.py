from pathlib import Path
import stat
import struct
import subprocess
import sys
import unittest
from unittest.mock import patch

import moons


class EncodingTests(unittest.TestCase):
    def test_rejects_truncation_before_opening_a_ship_socket(self):
        partial = b"\0" + struct.pack("<I", 70000) + b"x" * 65531
        with patch.object(moons, "eval_output", return_value=partial), patch.object(moons.socket, "socket") as connect:
            with self.assertRaisesRegex(moons.ManagerError, "incomplete.*nothing sent"):
                moons.exchange({"runtime": "/fake/urbit", "pier": "/fake/pier"}, "*")
        connect.assert_not_called()

    def test_validates_exactly_one_complete_frame(self):
        moons.validate_frame(b"\0" + struct.pack("<I", 4) + b"body")
        for frame in (b"", b"\0\0\0\0\0", b"\1" + struct.pack("<I", 1) + b"x", b"\0" + struct.pack("<I", 1) + b"xx"):
            with self.subTest(size=len(frame)), self.assertRaises(moons.ManagerError):
                moons.validate_frame(frame)

    def test_large_output_uses_a_private_regular_file_and_is_complete(self):
        body = b"x" * 120000
        def emit(args, **kwargs):
            target = kwargs["stdout"]
            mode = __import__("os").fstat(target.fileno()).st_mode
            self.assertTrue(stat.S_ISREG(mode))
            self.assertEqual(stat.S_IMODE(mode), 0o600)
            target.write(body)
            return subprocess.CompletedProcess(args, 0)
        with patch.object(moons.subprocess, "run", side_effect=emit):
            self.assertEqual(moons.eval_output("/fake/urbit", ["--jam", "-n"], b"noun"), body)

    def test_offline_error_never_exposes_private_stderr(self):
        with patch.object(moons.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, stderr=b"password=private-fixture")):
            with self.assertRaises(moons.ManagerError) as caught:
                moons.eval_output("/fake/urbit", [], b"noun")
        self.assertNotIn("private-fixture", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
