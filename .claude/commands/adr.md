---
description: Record an architecture decision
argument-hint: <the decision or question>
---

Decision: $ARGUMENTS

1. Take the next free number in `docs/adr/` (four digits).
2. Copy `docs/adr/0000-template.md` to `docs/adr/NNNN-<kebab-slug>.md` and fill it: context, options considered, decision, consequences. Status: Proposed.
3. Add the ADR to `docs/adr/README.md`.
4. If it supersedes an earlier ADR, set that one's status to "Superseded by NNNN" (status lines are the only edit allowed on an accepted ADR).
5. Ask the owner to accept. Only then change the status to Accepted and commit.
