---
description: Fix a bug end to end — reproduce, fix, test, review
argument-hint: <issue description or link>
---

Issue: $ARGUMENTS

1. Reproduce it with a failing test, or say exactly why it cannot be reproduced.
2. Find the root cause; state it in one sentence.
3. Make the smallest fix that satisfies the constitution and `.claude/rules/`.
4. Run the tests; the new one must now pass.
5. Run the `code-reviewer` agent on the diff and address its findings.
6. Commit with the root cause in the message.
