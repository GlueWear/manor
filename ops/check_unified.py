#!/usr/bin/env python3
"""Verify unified Manor in memory on one managed test ship; deliver no cards."""
import argparse
from pathlib import Path
import re

import check_companion
import check_pool
import moons


def source(root, component="agent", tests=False):
    bind, stripped = check_pool.bind, check_pool.stripped
    code = bind("manor-moon", stripped(root / "desk/sur/manor-moon.hoon"))
    code += bind("manor-ship", stripped(root / "desk/sur/manor-ship.hoon"))
    code += bind("manor", stripped(root / "desk/sur/manor.hoon"))
    if component == "interface":
        code += bind("action-mark", stripped(root / "desk/mar/manor/action.hoon"))
        code += bind("notice-mark", stripped(root / "desk/mar/manor/pair/request.hoon"))
        code += (root / "ops/unified-interface-tests.hoon").read_text()
        code += "=/  system  [~2026.11.13 0 [~zod %base %da ~2026.11.13]]\n"
        for name, args, expected in (
            ("pair", "[system [~siglup-narwet ~] ~]", "[%pair `~siglup-narwet]"),
            ("unpair", "[system ~ ~]", "[%pair ~]"),
            ("report", "[system ~ ~]", "[%report ~]"),
            ("configure", "[system [%landscape ~] ~]", "[%configure %landscape (silt `(list desk)`~[%landscape])]"),
        ):
            code += "~|  %" + name + "-generator\n"
            code += bind("gen", (root / "desk/gen/manor" / (name + ".hoon")).read_text())
            code += "=/  gate  +.gen\n=/  got  (gate " + args + ")\n"
            code += "?>  =(%manor-ship-action -.got)\n"
            code += "?>  =(" + expected + " ;;(action:manor-ship +.got))\n"
        return "!:\n" + code + "0\n"
    code += bind("server", stripped(root / "desk/lib/server.hoon"))
    local = stripped(root / "desk/lib/manor-ship.hoon")
    pool = stripped(root / "desk/lib/manor-pool.hoon")
    if tests:
        pool = pool.replace(".^([@ud (unit @ud)] %e /(scot %p our.bowl)/ports/(scot %da now.bowl))", "[8.083 ~]")
        start, end = local.index("++  agent-running\n"), local.index("++  bootstrap\n")
        local = local[:start] + "++  agent-running  |=(name=term ^-(? |))\n" + local[end:]
        start, end = local.index("++  port\n"), local.index("++  snapshot\n")
        local = local[:start] + "++  port  8.101\n++  own-profile  ^-((unit json) ~)\n++  landing-ready  =(%glurff landing)\n++  inventory  ^-((list installed-app:manor-ship) ~[[%glurff & &] [%noltbook & &] [%landscape & &] [%noltbook-data | |]])\n++  inventory-json  ^-(json ~)\n++  owner-sessions-cleared  =(%glurff landing)\n" + local[end:]
        start, end = local.index("++  login-card\n"), local.index("++  finish\n")
        local = local[:start] + "++  login-card\n  ^-  card\n  (http-card %login %'POST' '/~/login' ~ 'password=fixture-only')\n" + local[end:]
    code += bind("control", local)
    if component == "local":
        code = bind("manor-ship", stripped(root / "desk/sur/manor-ship.hoon")) + bind("control", local)
        code += ((root / "ops/unified-local-tests.hoon").read_text() if tests else "(mug !>(control))\n")
        return "!:\n" + code
    code += bind("manor-pool", pool)
    if component == "agent":
        if tests:
            for name in ("pair", "unpair", "configure", "report"):
                code += bind(name + "-gen", (root / "desk/gen/manor" / (name + ".hoon")).read_text())
        for name in ("skeleton", "default-agent", "dbug"):
            code += bind(name, stripped(root / ("desk/lib/" + name + ".hoon")))
        app = stripped(root / "desk/app/manor.hoon").replace("\n|%\n", "\n=+\n|%\n", 1)
        code += bind("ctor", app)
    if tests:
        checks = (root / ("ops/unified-" + component + "-tests.hoon")).read_text()
        if component == "pool":
            checks = checks.removesuffix("0\n") + (root / "ops/visitor-tests.hoon").read_text().removesuffix("0\n") + (root / "ops/idle-tests.hoon").read_text()
        code += checks
    else:
        value = {"agent": "ctor", "local": "control", "pool": "manor-pool"}[component]
        code += "(mug " + (value if component == "agent" else "!>(" + value + ")") + ")\n"
    return "!:\n" + code


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("name")
    p.add_argument("--component", choices=["agent", "local", "pool", "interface"], default="agent")
    p.add_argument("--tests", action="store_true")
    args = p.parse_args()
    args.tests = args.tests or args.component == "interface"
    root = Path(__file__).resolve().parent.parent
    result = check_companion.evaluate(moons.Manager().rows(args.name)[0], source(root, args.component, args.tests))
    if not re.fullmatch(r"[0-9.]+|0x[0-9a-f.]+", result) or (args.tests and result != "0"):
        raise moons.ManagerError("Unified Manor verification failed")
    print("Unified Manor tests passed; no cards delivered." if args.tests else "Unified Manor compiled in memory; no installation or actions.")


if __name__ == "__main__":
    try:
        main()
    except (moons.ManagerError, OSError) as exc:
        raise SystemExit("check_unified: " + moons.redact(str(exc)))
