---
description: Analyze staged changes and generate a semantic git commit.
---

When the user types `/commit`, orchestrate this action:

### Execution Sequence:

1. **Analyze:** Execute `git diff --cached` to read all currently staged changes.
2. **Generate:** Based strictly on the diff, write a concise, conventional git commit message (e.g., `feat: ...`, `fix: ...`, `refactor: ...`). 
3. **Execute:** Execute the native terminal command `git commit -m "<commit message>"`.