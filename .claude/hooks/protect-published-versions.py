#!/usr/bin/env python3
"""PreToolUse (Edit|Write|MultiEdit): block edits to a published document version.

A versioned document is any file under docs/ named v<N>-<YYYY-MM-DD>*. Once it
is committed it has been seen, so it is frozen: the change goes into the next
version instead. Untracked versions (still being drafted) stay editable.
"""
import json
import os
import re
import subprocess
import sys

VERSIONED = re.compile(r"(^|/)docs/(.+/)?v\d+-\d{4}-\d{2}-\d{2}[^/]*$")


def is_tracked(path: str, cwd: str) -> bool:
    result = subprocess.run(
        ["git", "ls-files", "--error-unmatch", path],
        cwd=cwd, capture_output=True, text=True,
    )
    return result.returncode == 0


def main() -> None:
    event = json.load(sys.stdin)
    path = (event.get("tool_input") or {}).get("file_path") or ""
    project = os.environ.get("CLAUDE_PROJECT_DIR") or event.get("cwd") or os.getcwd()
    rel = os.path.relpath(path, project) if os.path.isabs(path) else path

    if not VERSIONED.search(rel.replace(os.sep, "/")):
        return
    if not os.path.exists(os.path.join(project, rel)) or not is_tracked(rel, project):
        return

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"{rel} is a published version and is frozen. Copy it to the next "
                "v<N>-<date> file, edit the copy, and add a row to that folder's index."
            ),
        }
    }))


if __name__ == "__main__":
    main()
