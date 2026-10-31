---
description: Review the current branch before merge
---

1. Diff the current branch against the main branch.
2. Run the `code-reviewer` agent on it; run `security-auditor` too if auth, data, secrets or integrations changed.
3. Check every requirement ID mentioned in commits exists in `docs/requirements/register.yaml`.
4. Report findings ranked by severity, then a merge / don't-merge verdict.
