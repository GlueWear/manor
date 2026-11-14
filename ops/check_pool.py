#!/usr/bin/env python3
"""Compile/test Manor in memory on the managed test moon; deliver no cards."""
import argparse
from pathlib import Path
import re

import check_companion
import moons


def stripped(path):
    return "\n".join(line for line in path.read_text().splitlines()
                     if not line.startswith(("/-", "/+")))


def bind(name, source):
    return "=/  " + name + "\n" + "\n".join("  " + line for line in source.splitlines()) + "\n"


def source(root, agent=False, tests=False):
    if agent:
        import check_unified
        return check_unified.source(root, component="agent", tests=tests)
    code = bind("manor-moon", stripped(root / "desk/sur/manor-moon.hoon"))
    code += bind("manor-ship", stripped(root / "desk/sur/manor-ship.hoon"))
    code += bind("manor", stripped(root / "desk/sur/manor.hoon"))
    code += bind("server", stripped(root / "desk/lib/server.hoon"))
    helper = stripped(root / "desk/lib/manor-full.hoon")
    if tests:
        helper = helper.replace(".^([@ud (unit @ud)] %e /(scot %p our.bowl)/ports/(scot %da now.bowl))", "[8.083 ~]")
    code += bind("manor-full", helper)
    if agent:
        code += bind("skeleton", stripped(root / "desk/lib/skeleton.hoon"))
        code += bind("default-agent", stripped(root / "desk/lib/default-agent.hoon"))
        code += bind("dbug", stripped(root / "desk/lib/dbug.hoon"))
        app = stripped(root / "desk/app/manor.hoon").replace("\n|%\n", "\n=+\n|%\n", 1)
        code += bind("ctor", app)
    if tests:
        code += (root / ("ops/pool-agent-tests.hoon" if agent else "ops/pool-tests.hoon")).read_text()
    else:
        code += "(mug !>(" + ("ctor" if agent else "manor-full") + "))\n"
    return "!:\n" + code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name")
    parser.add_argument("--agent", action="store_true")
    parser.add_argument("--tests", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    row = moons.Manager().rows(args.name)[0]
    result = check_companion.evaluate(row, source(root, agent=args.agent, tests=args.tests))
    if not re.fullmatch(r"[0-9.]+|0x[0-9a-f.]+", result) or (args.tests and result != "0"):
        raise moons.ManagerError("Manor in-memory verification did not pass")
    print("Manor state-machine tests passed; no cards delivered." if args.tests
          else "Manor compiled in memory; no agent installed or state changed.")


if __name__ == "__main__":
    try:
        main()
    except (moons.ManagerError, OSError) as exc:
        raise SystemExit("check_pool: " + moons.redact(str(exc)))
