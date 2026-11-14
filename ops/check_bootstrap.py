#!/usr/bin/env python3
"""Read-only missing-agent regression on a managed test ship; install nothing."""

import argparse
from pathlib import Path
import sys

import check_pool
import live_companion
import moons


def source(root, profile=False):
    code = check_pool.bind("manor-ship", check_pool.stripped(root / "desk/sur/manor-ship.hoon"))
    local = check_pool.stripped(root / "desk/lib/manor-ship.hoon")
    if not profile:
        # Only the optional target names differ; retain the real guards and scries.
        local = local.replace("(agent-running %manor-moon)", "(agent-running %manor-load-probe-absent)")
        local = local.replace("/manor-moon/", "/manor-load-probe-absent/")
        local = local.replace("(agent-running %noltbook)", "(agent-running %manor-profile-probe-absent)")
        local = local.replace("/noltbook/", "/manor-profile-probe-absent/")
    code += check_pool.bind("control", local)
    code += """=/  m  (strand ,vase)
^-  form:m
;<  b=bowl:rand  bind:m  get-bowl
=/  gb=bowl:gall
  %*(. *bowl:gall our our.b, src our.b, dap %manor, now now.b)
=/  c  ~(. control [gb initial:manor-ship])
"""
    if profile:
        code += """~|  %profile-api-is-running
?>  (agent-running.c %noltbook)
~|  %profile-api-is-readable
=/  api-profile  own-profile.c
?>  ?=(^ api-profile)
~|  %profile-status-can-be-generated
=/  got  snapshot.c
?>  =(api-profile profile.got)
=/  fact  signal-status.c
?>  ?=([%give %fact *] fact)
"""
    else:
        code += """\
~|  %missing-legacy-agent-does-not-block-load
?>  =(initial:manor-ship bootstrap.c)
~|  %missing-profile-agent-is-optional
?>  =(~ own-profile.c)
"""
    code += "(pure:m !>(%.y))\n"
    return "!:\n" + code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name")
    parser.add_argument("--profile", action="store_true", help="read the installed Noltbook API and construct a status fact; send nothing")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    row = moons.Manager().rows(args.name)[0]
    live_companion.run(row, source(root, args.profile))
    print("Live profile/status reads passed; no profile changed or cards delivered." if args.profile else "Real missing-agent bootstrap/profile checks passed; no actions delivered.")


if __name__ == "__main__":
    try:
        main()
    except (moons.ManagerError, OSError) as exc:
        print("check_bootstrap: " + moons.redact(str(exc)), file=sys.stderr)
        sys.exit(1)
