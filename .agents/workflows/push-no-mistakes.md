---
description: Push changes to the no-mistakes review gate and forward to origin on success.
---

When the user types `/push` or `/push-no-mistakes`, orchestrate the push and verification pipeline strictly using the terminal.

### Execution Sequence:

1. **Local Gate Push (`no-mistakes`):**
   Execute `git push no-mistakes HEAD` in the terminal.
   *Note: This command blocks while `no-mistakes` runs its automated reviews and verification checks.*

2. **Verification & Halt Condition:**
   Inspect the terminal output and exit code from Step 1:
   - **Failure / Rejection:** If `no-mistakes` flags issues, rejects the push, or exits with a non-zero status code, **HALT IMMEDIATELY**. Display the review errors directly in the chat so the user can address them. Do NOT push to `origin`.
   - **Success:** Only if the push succeeds cleanly with exit code `0` (indicating all gate checks passed), proceed to Step 3.

3. **Remote Push (`origin`):**
   Push the validated commit to the upstream remote repository:
   Run `git push origin HEAD`.
   *(If the current branch does not have an upstream tracking branch set, run `git push -u origin HEAD` instead).*

4. **Report:**
   Confirm to the user directly in the chat:
   - ✅ `no-mistakes` verification passed cleanly.
   - 🚀 Branch successfully pushed to `origin`.
   - Provide the remote branch name or PR link if available.