---
description: Add or change requirements — creates the next requirements version
argument-hint: <the new or changed requirement, in plain words>
---

Requirement change: $ARGUMENTS

1. Find the latest `docs/requirements/v<N>-<date>.html`. Copy it to `v<N+1>-<today>.html`. Never edit `v<N>`.
2. Apply the change in the new version. New requirements get the next free ID in their area (e.g. `WF-10`); changed ones keep their ID.
3. Update `docs/requirements/register.yaml`: id, title, priority, status, version where it was added or last changed.
4. If the change contradicts `constitution/` or an accepted ADR, stop and say so before writing.
5. Add the version to the top of `docs/requirements/index.html` with one line on what changed and why.
6. Add a line to the change log in `CLAUDE.md`.
7. Commit: `requirements: v<N+1> — <summary>`.
8. Reply with the IDs added or changed and the new version's path.
