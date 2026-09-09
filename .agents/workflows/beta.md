---
description: Build, test, and publish a private draft release on GitHub visible only to repository maintainers.
---

When the user types `/beta` (or `/beta <version_input>`), orchestrate the private release pipeline strictly using the `@engineer` persona. You are acting as the Release Manager.

### Step 0: Version Discovery & Canonical Normalization

1. **Read Current Version:**
   Read `package.json` to extract `CURRENT_VERSION` (e.g., `1.2.3`).

2. **Calculate Target Version:**
   - **Default (No input provided):** Auto-increment the patch number: `X.Y.(Z+1)`.
   - **Manual Override:** Strip any leading `v` or whitespace from `<version_input>`.

3. **Lock Canonical Variables:**
   - **`SEMVER`**: Raw numbers and dots only (e.g., `1.2.4`).
   - **`TAG`**: Strictly `v<SEMVER>` (e.g., `v1.2.4`).

4. **Declare Objective in Chat:**
   Print the intent directly in chat:
   > 🔒 **Initiating Private Draft Release:** `<CURRENT_VERSION>` → **`<SEMVER>`** (Tag: `<TAG>`)

---

### Execution Sequence:

1. **Branch Initialization:**
   Run `git branch --show-current`. If on `main`, checkout a dedicated release branch:
   `git checkout -b release/<TAG>`

2. **Version Bump:**
   Update `<SEMVER>` in:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`

3. **Changelog & Draft Artifacts:**
   Read git commit history since the previous tag. Generate release notes categorized under:
   - `### 🚀 Features`
   - `### 🐛 Fixes`
   - `### 🔧 Under the Hood`

   Append the download table populated with `<SEMVER>` and `<TAG>`, then save to `production_artifacts/release_notes.md`.

4. **Halt for Approval:**
   Pause execution and output:
   > *"Draft release `<TAG>` prepared. Do you approve the changelog and version bump? Type 'Approved' to continue."*
   
   **Halt Condition:** Stop completely until the user replies in chat.

5. **Local Gate Verification (`no-mistakes`):**
   Stage and commit:
   `git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml production_artifacts/release_notes.md`
   `git commit -m "chore(release): prepare draft <TAG>"`

   Push to verification gate:
   `git push no-mistakes HEAD`
   
   **Halt Condition:** If `no-mistakes` fails or exits non-zero, halt immediately.

6. **Merge to Main:**
   Push branch to origin, open PR, and merge:
   `git push -u origin HEAD`
   `gh pr create --base main --head release/<TAG> --title "chore(release): <TAG>" --body-file production_artifacts/release_notes.md`
   `gh pr merge --squash --delete-branch --admin`
   `git checkout main && git pull origin main`

7. **Create Private Draft Release:**
   Tag the commit and initialize the release explicitly with the `--draft` flag:
   `git tag <TAG>`
   `git push origin <TAG>`
   `gh release create <TAG> --draft --title "<TAG> (Internal Draft)" --notes-file production_artifacts/release_notes.md`

8. **CI/CD Pipeline Watch & Resolution (Blocking Gate):**
   **DO NOT STOP OR REPORT COMPLETION YET.** You must monitor the GitHub Actions triggered by the tag and merge until all jobs succeed.

   1. **Wait for Workflow Dispatch:**
      Sleep for 15 seconds to allow GitHub to register the webhook and trigger the action workflows:
      `sleep 15`

   2. **Discover Active Runs:**
      Query all active workflow runs associated with the release commit:
      `gh run list --commit $(git rev-parse HEAD) --json databaseId,name,status,conclusion,url`

   3. **Watch Workflows to Completion:**
      For each active run discovered, stream and block execution until completion:
      `gh run watch <RUN_ID> --exit-status`
      *(If multiple workflows run in parallel, poll status periodically via `gh run list --commit $(git rev-parse HEAD)` every 20 seconds until no runs have `status: "in_progress"` or `status: "queued"`).*

   4. **Evaluate Results & Invariants:**
      - **On Failure (`conclusion: "failure"` or non-zero exit):**
        Do NOT exit silently. Immediately fetch and display the failure logs:
        `gh run view <RUN_ID> --log-failed`
        Halt execution and report the broken build to the user.
      - **On Success:** Ensure all discovered workflows show `conclusion: "success"`.

9. **Release Asset Verification:**
   Verify that the expected compiled release assets (binaries, bundles, installers) were generated and attached to the draft release:
   `gh release view <TAG> --json assets`

10. **Report Verification & Completion:**
    Only after Step 8 and Step 9 pass 100% green, output the final report:
    - 🔒 **Draft Release Ready:** `<TAG>` is live on GitHub in **Draft mode**.
    - ✅ **CI Complete:** All build and test workflows passed successfully.
    - 📦 **Verified Assets:** List the binary filenames attached to the draft release.
    - 📥 **Download Command:**
      `gh release download <TAG>`
    - 🚀 **Publish Command:**
      `gh release edit <TAG> --draft=false`