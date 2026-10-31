#!/usr/bin/env python3
"""SessionStart: orient the session — handoff state, latest requirements, last ADRs."""
from __future__ import annotations
import glob
import json
import os
import re
import sys

project = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


def latest_version(folder: str) -> str | None:
    files = glob.glob(os.path.join(project, folder, "v*-*"))
    key = lambda f: int(re.match(r"v(\d+)", os.path.basename(f)).group(1))
    files = [f for f in files if re.match(r"v\d+-", os.path.basename(f))]
    return os.path.relpath(max(files, key=key), project) if files else None


def last_adrs(n: int = 3) -> list[str]:
    files = sorted(glob.glob(os.path.join(project, "docs/adr/[0-9][0-9][0-9][0-9]-*.md")))
    files = [f for f in files if not os.path.basename(f).startswith("0000-")]
    return [os.path.basename(f) for f in files[-n:]]


def handoff_next() -> list[str]:
    path = os.path.join(project, "HANDOFF.md")
    if not os.path.exists(path):
        return []
    lines, grab = [], False
    for line in open(path, encoding="utf-8"):
        if line.startswith("## "):
            grab = line.strip().lower() in ("## next", "## blockers")
            continue
        if grab and line.strip():
            lines.append(line.rstrip())
    return lines[:8]


def main() -> None:
    json.load(sys.stdin)
    parts = []
    req = latest_version("docs/requirements")
    if req:
        parts.append(f"Latest requirements: {req}")
    adrs = last_adrs()
    if adrs:
        parts.append("Latest ADRs: " + ", ".join(adrs))
    nxt = handoff_next()
    if nxt:
        parts.append("From HANDOFF.md (next / blockers):\n" + "\n".join(nxt))
    if parts:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": "\n".join(parts),
            }
        }))


if __name__ == "__main__":
    main()
