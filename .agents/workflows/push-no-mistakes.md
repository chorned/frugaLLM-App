---
description: Push commits to the current branch using the local no-mistakes instance.
---

When the user types `/push` or `/push-no-mistakes`, orchestrate the action to push the current branch to the `no-mistakes` remote.

### Execution Sequence:

1. **Push:** Execute the command `git push no-mistakes HEAD` in the terminal. This will push the current branch to the local no-mistakes instance to trigger the review/CI.
2. **Report:** Confirm to the user that the push has completed and provide a link to the no-mistakes instance if applicable.