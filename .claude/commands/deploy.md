---
description: Deploy checklist for this project
argument-hint: <environment>
---

Environment: $ARGUMENTS

1. Confirm the target environment and that the owner asked for this deploy.
2. Build and run the full test suite; stop on any failure.
3. Confirm no published document version or accepted ADR is contradicted by what ships.
4. Run the project's deploy command (see CLAUDE.md → Commands).
5. Smoke-test the deployed environment and report the result with the URL.
