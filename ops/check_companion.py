#!/usr/bin/env python3
"""Compile/probe the companion in memory on one managed test moon, without installation."""

import argparse
from pathlib import Path
import re
import sys

import moons


def cord(value):
    data = format(int.from_bytes(value.encode(), "little"), "x")
    first = len(data) % 4 or 4
    return "0x" + ".".join([data[:first]] + [data[i:i + 4] for i in range(first, len(data), 4)])


def companion(root, mock_scries=False):
    protocol = (root / "moon-desk/sur/manor-moon.hoon").read_text()
    source = (root / "moon-desk/app/manor-moon.hoon").read_text()
    source = "\n".join(line for line in source.splitlines() if not line.startswith("/-"))
    # Ford stacks the declaration prelude before the body; plain eval needs =+.
    source = source.replace("\n|%\n", "\n=+\n|%\n", 1)
    if mock_scries:
        # Synthetic event bowls cannot use historical timestamps for live scries.
        start = source.index("++  port\n")
        end = source.index("++  snapshot\n", start)
        source = source[:start] + "++  port  8.101\n++  own-profile\n  ^-  (unit json)\n  ~\n++  landing-ready  =(%glurff landing)\n++  owner-sessions-cleared  =(%glurff landing)\n" + source[end:]
        start = source.index("++  login-card\n")
        end = source.index("++  finish\n", start)
        source = source[:start] + "++  login-card\n  ^-  card\n  (http-card %login %'POST' '/~/login' ~ 'password=fixture-only')\n" + source[end:]
    return "=/  manor-moon\n" + "\n".join("  " + line for line in protocol.splitlines()) + "\n" + source


def evaluate(row, source):
    answer = moons.exchange(row, f"[1 %fyrd [%base %eval %noun [%ted-eval {cord(source)}]]]", timeout=300)
    if not answer.startswith("[1 %avow 0 %noun "):
        leaves = re.findall(r"\[%leaf ((?:[0-9]+ )*)0\]", answer)
        text = ["".join(chr(int(c)) if 0 <= int(c) < 128 else "?" for c in tape.split()) for tape in leaves]
        raise moons.ManagerError("companion probe failed: " + moons.redact(" | ".join(text[:40]) or answer[:1000]))
    return answer[len("[1 %avow 0 %noun "):-1]


def generator_tests(root):
    source = "=/  system  [~2026.11.12 0 [~zod %base %da ~2026.11.12]]\n"
    for name, args, expected in (
        ("pair", "[system [~siglup-narwet ~] ~]", "[%manor-moon-action %pair `~siglup-narwet]"),
        ("unpair", "[system ~ ~]", "[%manor-moon-action %pair ~]"),
        ("report", "[system ~ ~]", "[%manor-moon-action %report ~]"),
    ):
        code = (root / "moon-desk/gen/manor-moon" / (name + ".hoon")).read_text()
        source += "~|  %" + name + "-generator\n=/  gen\n"
        source += "\n".join("  " + line for line in code.splitlines())
        source += "\n=/  gate  +.gen\n?>  =(" + expected + " (gate " + args + "))\n"
    return source + "0\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name")
    parser.add_argument("--smoke", action="store_true", help="check the eval transport only")
    parser.add_argument("--protocol", action="store_true", help="compile only the shared protocol")
    parser.add_argument("--tests", action="store_true", help="run in-memory behavioral tests; no cards are delivered")
    parser.add_argument("--until", help="stop before this test group (with --tests)")
    parser.add_argument("--generators", action="store_true", help="test the real Dojo generator argument shape")
    args = parser.parse_args()
    row = moons.Manager().rows(args.name)[0]
    source = "(add 2 2)" if args.smoke else "=/  ctor\n" + "\n".join("  " + line for line in companion(Path(__file__).resolve().parent.parent).splitlines()) + "\n(mug !>(ctor))"
    if args.protocol:
        protocol = (Path(__file__).resolve().parent.parent / "moon-desk/sur/manor-moon.hoon").read_text()
        source = "=/  protocol\n" + "\n".join("  " + line for line in protocol.splitlines()) + "\n(mug !>(protocol))"
    if args.tests:
        root = Path(__file__).resolve().parent.parent
        protocol = (root / "moon-desk/sur/manor-moon.hoon").read_text()
        tests = (root / "ops/companion-tests.hoon").read_text()
        if args.until:
            marker = "~|  %" + args.until
            if marker not in tests:
                raise moons.ManagerError("unknown test group")
            tests = tests.split(marker, 1)[0] + "\n0\n"
        source = "=/  manor-moon\n" + "\n".join("  " + line for line in protocol.splitlines()) + "\n=/  ctor\n" + "\n".join("  " + line for line in companion(root, mock_scries=True).splitlines()) + "\n" + tests
    if args.generators:
        source = generator_tests(Path(__file__).resolve().parent.parent)
    result = evaluate(row, "!:\n" + source)
    if not re.fullmatch(r"[0-9.]+|0x[0-9a-f.]+", result):
        raise moons.ManagerError("companion compile returned an unexpected result")
    if args.tests or args.generators:
        if result != "0":
            raise moons.ManagerError("companion behavioral tests did not pass")
        print("Dojo generator invocation tests passed; no actions delivered." if args.generators else "Companion state-machine tests passed with mocked scries; no cards delivered or agent installed.")
    else:
        print("Eval transport passed." if args.smoke else "Companion compiled in memory; no agent installed or state changed.")


if __name__ == "__main__":
    try:
        main()
    except (moons.ManagerError, OSError) as exc:
        print("check_companion: " + moons.redact(str(exc)), file=sys.stderr)
        sys.exit(1)
