---
paths:
  - "docs/**"
  - "outputs/**"
---

# Documentation rules

- Versioned documents are `v<N>-<YYYY-MM-DD>.<ext>` in their own folder with an `index.html` or `README.md` listing versions newest first.
- A committed version is frozen (the protect-published-versions hook enforces it). Copy to the next version to change it.
- Every number carries a source, or is labelled as an assumption.
