#!/usr/bin/env python3
"""Private full-moon companion acceptance probes. Never print codes or cookies."""

import argparse
import json
from pathlib import Path
import re
import stat
import sys
import time

import check_companion
import moons


SAFE_STAGES = {
    "probe-status", "probe-unauthenticated-http", "probe-session",
    "probe-authenticated-http", "probe-temporary-session-logout", "probe-revoke",
    "probe-revoked-http", "probe-unexpected-agent-result", "probe-agent-error",
    "probe-agent-not-ready", "probe-agent-login-refused", "probe-agent-no-session",
    "probe-agent-invalid-session", "probe-agent-http-interrupted",
    "probe-agent-logout-unconfirmed", "probe-agent-sessions-remain", "probe-agent-timeout",
    "probe-profile-missing", "probe-profile-changed-since-backup",
    "probe-profile-write-failed", "probe-profile-restore-failed",
}


def safe_stage(value):
    return value in SAFE_STAGES or bool(re.fullmatch(r"probe-(?:baseline|authenticated|logout|logged-out|revoked)-[0-9]{3}", value))


def validate_profile(profile):
    if not isinstance(profile, dict) or set(profile) != {"displayName", "avatar"}:
        raise moons.ManagerError("profile backup has an unexpected shape; no profile changed")
    name, avatar = profile["displayName"], profile["avatar"]
    if name is not None and (not isinstance(name, str) or not name or len(name.encode()) > 256):
        raise moons.ManagerError("current name cannot be restored by this probe; no profile changed")
    if avatar is not None:
        if (not isinstance(avatar, dict) or set(avatar) != {"type", "url"}
                or avatar["type"] != "external" or not isinstance(avatar["url"], str)
                or not avatar["url"].startswith(("http://", "https://")) or len(avatar["url"].encode()) > 2048):
            raise moons.ManagerError("current picture cannot be restored by the URL-only protocol; no profile changed")
    return profile


def parse_profile(answer):
    prefix = "[1 %avow 0 %noun "
    if not answer.startswith(prefix) or not answer.endswith("]"):
        raise moons.ManagerError("private profile backup request failed; response suppressed")
    atom = answer[len(prefix):-1]
    # A list in a noun's tail position is printed without its own brackets.
    byte_list = atom[1:-1] if atom.startswith("[") and atom.endswith("]") else atom
    if re.fullmatch(r"(?:[0-9]{1,3}\s+)+0", byte_list):
        numbers = byte_list.split()[:-1]
        if len(numbers) > 65536:
            raise moons.ManagerError("private profile backup exceeded its size limit")
        try:
            data = bytes(int(number) for number in numbers)
        except ValueError as exc:
            raise moons.ManagerError("private profile backup has invalid bytes") from exc
    elif re.fullmatch(r"0x[0-9a-f.]+", atom):
        value = int(atom[2:].replace(".", ""), 16)
        size = (value.bit_length() + 7) // 8
        if size > 65536:
            raise moons.ManagerError("private profile backup exceeded its size limit")
        data = value.to_bytes(size, "little")
    elif re.fullmatch(r"[0-9.]+", atom):
        value = int(atom.replace(".", ""))
        size = (value.bit_length() + 7) // 8
        if size > 65536:
            raise moons.ManagerError("private profile backup exceeded its size limit")
        data = value.to_bytes(size, "little")
    else:
        raise moons.ManagerError("private profile backup encoding is unsupported")
    try:
        return validate_profile(json.loads(data.decode()))
    except (ValueError, UnicodeError) as exc:
        raise moons.ManagerError("private profile backup could not be decoded") from exc


def source(root, target, port, mode, compile_only=False, profile=None):
    if mode not in ("smoke", "status", "baseline", "session", "revoke", "profile-backup", "profile", "profile-restore"):
        raise moons.ManagerError("unknown live-probe mode")
    name = moons.moon_name(target)
    if type(port) is not int or not 1024 <= port <= 65535:
        raise moons.ManagerError("invalid pinned HTTP port")
    protocol = (root / "moon-desk/sur/manor-moon.hoon").read_text()
    probe = (root / "ops/companion-probe.hoon").read_text()
    probe = probe.replace("__TARGET__", name).replace("__PORT__", format(port, ",").replace(",", ".")).replace("__MODE__", mode)
    profile = validate_profile(profile or {"displayName": None, "avatar": None})
    name_value = "[~ ~]" if profile["displayName"] is None else "[~ ~ `@t`" + check_companion.cord(profile["displayName"]) + "]"
    avatar_value = "[~ ~]" if profile["avatar"] is None else "[~ ~ `@t`" + check_companion.cord(profile["avatar"]["url"]) + "]"
    probe = probe.replace("__RESTORE_NAME__", name_value).replace("__RESTORE_AVATAR__", avatar_value)
    probe = probe.replace("__ORIGINAL_JSON__", "`@t`" + check_companion.cord(json.dumps(profile, ensure_ascii=False)))
    if compile_only:
        probe = probe.replace("((set-timeout vase) ?:(=(%" + mode + " %profile) ~m2 ~m1) run)", "=/  candidate=form:m  run\n  (pure:m !>(%.y))")
    return "!:\n=/  protocol\n" + "\n".join("  " + line for line in protocol.splitlines()) + "\n" + probe


def run(row, program, compile_only=False, profile_backup=False):
    # All replies stay inside the private client. Never echo a failed live reply.
    answer = moons.exchange(row, f"[1 %fyrd [%base %khan-eval %noun [%ted-eval {check_companion.cord(program)}]]]", timeout=180)
    if profile_backup:
        return parse_profile(answer)
    if answer == "[1 %avow 0 %noun 0]":
        return
    if compile_only:
        leaves = re.findall(r"\[%leaf ((?:[0-9]+ )*)0\]", answer)
        text = ["".join(chr(int(c)) if 0 <= int(c) < 128 else "?" for c in tape.split()) for tape in leaves]
        raise moons.ManagerError("probe compilation failed: " + moons.redact(" | ".join(text[:32]) or "no details"))
    markers = re.findall(r"\[%leaf ((?:[0-9]+ )*)0\]", answer)
    stages = []
    for tape in markers:
        label = "".join(chr(int(c)) if 0 <= int(c) < 128 else "?" for c in tape.split())
        if safe_stage(label):
            stages.append(label)
    motes = [mote for mote in re.findall(r"(?<![a-z0-9])%probe-[a-z0-9-]+", answer) if safe_stage(mote[1:])]
    stage = motes[0] if motes else stages[0] if stages else "unconfirmed"
    known = ("%timeout", "%watch-ack-fail", "%poke-ack-fail", "%false-start", "%stopped-before-started", "%http-request-cancelled", "%cancelled")
    causes = [mote for mote in known if mote in answer]
    cause = " (" + ", ".join(causes) + ")" if causes else ""
    raise moons.ManagerError(f"live probe failed at {stage}{cause}; response suppressed to protect credentials")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name")
    parser.add_argument("mode", choices=("smoke", "status", "baseline", "session", "revoke", "profile", "profile-restore"))
    parser.add_argument("--from-pier", type=Path, help="explicitly approved controller pier; otherwise use this moon")
    parser.add_argument("--confirm-revoke", action="store_true", help="required: revocation signs out every moon browser")
    parser.add_argument("--compile-only", action="store_true", help="construct the probe form without executing it")
    parser.add_argument("--confirm-profile", action="store_true", help="required: approved temporary name/picture test")
    parser.add_argument("--profile-backup", type=Path, help="private backup file, required for profile-restore")
    args = parser.parse_args()
    if args.mode == "revoke" and not args.confirm_revoke:
        raise moons.ManagerError("revocation signs out all moon browsers; approval and --confirm-revoke are required")
    if args.mode in ("profile", "profile-restore") and not args.confirm_profile:
        raise moons.ManagerError("profile changes require approval and --confirm-profile")
    target = moons.Manager().rows(args.name)[0]
    actor = target
    if args.from_pier:
        pier = args.from_pier.expanduser().resolve()
        if not (pier / ".urb/conn.sock").is_socket() or not (pier / ".run").is_file():
            raise moons.ManagerError("controller pier has no live control socket and runtime")
        actor = {"pier": str(pier), "runtime": str(pier / ".run")}
    root = Path(__file__).resolve().parent.parent
    profile = None
    if args.mode == "profile-restore":
        path = args.profile_backup
        if path is None or path.is_symlink() or stat.S_IMODE(path.stat().st_mode) & 0o077:
            raise moons.ManagerError("profile-restore requires a private, non-symlink backup file")
        saved = json.loads(path.read_text())
        if saved.get("ship") != target["name"]:
            raise moons.ManagerError("profile backup belongs to a different moon")
        profile = validate_profile(saved.get("profile"))
    if args.mode == "profile" and not args.compile_only:
        profile = run(actor, source(root, target["name"], target["http_port"], "profile-backup"), profile_backup=True)
        backup = moons.Manager().root / "backups" / "profiles" / f"{target['name']}-{time.time_ns()}.json"
        moons.write_atomic(backup, (json.dumps({"ship": target["name"], "profile": profile}, ensure_ascii=False) + "\n").encode())
        print("Original name and picture saved privately to " + str(backup), flush=True)
    program = source(root, target["name"], target["http_port"], args.mode, args.compile_only, profile)
    try:
        run(actor, program, compile_only=args.compile_only or args.mode == "smoke")
    except moons.ManagerError as exc:
        if args.mode != "profile" or args.compile_only:
            raise
        try:
            run(actor, source(root, target["name"], target["http_port"], "profile-restore", profile=profile))
        except moons.ManagerError:
            raise moons.ManagerError("profile test failed and restoration is unconfirmed; private backup retained at " + str(backup)) from None
        raise moons.ManagerError("profile test failed; original name and picture were restored; " + str(exc)) from None
    print(f"Companion {args.mode} {'compile' if args.compile_only else 'probe'} passed. No codes or cookies printed or saved.")


if __name__ == "__main__":
    try:
        main()
    except (moons.ManagerError, OSError) as exc:
        print("live_companion: " + moons.redact(str(exc)), file=sys.stderr)
        sys.exit(1)
