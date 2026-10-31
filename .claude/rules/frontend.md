---
paths:
  - "code/**/frontend/**"
  - "code/**/web/**"
  - "**/*.tsx"
---

# Frontend rules

- Accessible by default: keyboard reachable, labelled controls, visible focus.
- Support RTL when the product ships Arabic; never hard-code left/right.
- No secrets or privileged API keys in client code.
- Copy and configuration live outside components where the project has a content layer.
