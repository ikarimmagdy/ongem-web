---
paths:
  - "code/**/backend/**"
  - "code/**/api/**"
  - "**/*.py"
---

# Backend rules

- Every entry point is authenticated and authorised; say why if one is public.
- Every write that matters is audited from the first line that performs it.
- Timeouts and retries on every outbound call; idempotency for anything that moves money or state.
- Validate input at the boundary; never trust model output as validated input.
