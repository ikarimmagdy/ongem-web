---
paths:
  - "**/migrations/**"
  - "**/*.sql"
  - "code/**/database/**"
---

# Database rules

- Schema changes only through migrations; never edit an applied migration.
- Every migration is reversible or says why not.
- Personal data columns are classified in a comment or the data catalogue.
