#!/usr/bin/env python3
"""UserPromptSubmit: route a prompt to the project's process when it matches.

- New or changed requirements  -> the /req flow (new requirements version).
- A decision being made        -> the /adr flow (new decision record).

Matching is keyword-based on purpose: a hook cannot understand intent, so it
only reminds Claude which process applies. Claude still does the work.
"""
import json
import re
import sys

REQUIREMENT = re.compile(
    r"\b(requirements?|new feature|add (a )?feature|we need to (add|support|build)|"
    r"i need (to add|you to add)|scope change|user stor(y|ies)|acceptance criteria)\b"
    r"|متطلب|متطلبات|ميزة جديدة",
    re.IGNORECASE,
)
DECISION = re.compile(
    r"\b(we decided|i decided|decision is|let'?s (go with|use)|we will use|"
    r"instead of|switch(ing)? to|replace .+ with|trade-?off)\b",
    re.IGNORECASE,
)

REQ_NOTE = (
    "Requirements change detected. Follow .claude/commands/req.md: copy the latest "
    "docs/requirements/v<N>-<date> to the next version, apply the change there, "
    "update docs/requirements/register.yaml and index.html, note it in CLAUDE.md's "
    "change log, then commit. Never edit a published version."
)
ADR_NOTE = (
    "A decision may be in this message. If it settles a choice with alternatives, "
    "draft an ADR with .claude/commands/adr.md (status Proposed) and ask the project owner to accept it."
)


def main() -> None:
    prompt = (json.load(sys.stdin).get("prompt") or "")
    notes = []
    if REQUIREMENT.search(prompt):
        notes.append(REQ_NOTE)
    if DECISION.search(prompt):
        notes.append(ADR_NOTE)
    if notes:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": "\n".join(notes),
            }
        }))


if __name__ == "__main__":
    main()
