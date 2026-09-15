---
description: Build, test, and publish a private draft release on GitHub visible only to repository maintainers.
---

When the user types `/beta` (or `/beta <version_input>`), orchestrate the private release pipeline strictly using the `@engineer` persona. You are acting as the Release Manager.

### Step 0: Version Discovery & Canonical Normalization (MANDATORY)

1. **Read Current Version:**
   Read `package.json` to extract `CURRENT_VERSION` (e.g., `1.2.3`).

2. **Calculate Target Version:**
   - **Default (No input provided):** Auto-increment the patch number: `X.Y.(Z+1)`.
   - **Manual Override:** Strip any leading `v` or whitespace from `<version_input>`.

3. **Lock Canonical Variables (Immutable across all steps):**
   - **`SEMVER`**: Raw digits and dots only (e.g., `0.0.16`).
   - **`TAG`**: Strictly `v<SEMVER>` (e.g., `v0.0.16`).
   - **`RELEASE_TITLE`**: Strictly `FrugaLLM <TAG>` (e.g., `FrugaLLM v0.0.16`).
   - **`DRAFT_TITLE`**: Strictly `FrugaLLM <TAG> (Internal Draft)` (e.g., `FrugaLLM v0.0.16 (Internal Draft)`).

4. **Declare Objective in Chat:**
   Print the intent directly in chat:
   > 🔒 **Initiating Private Draft Release:** `<CURRENT_VERSION>` → **`<SEMVER>`** (Tag: `<TAG>` | Draft Title: `<DRAFT_TITLE>`)

---

### Execution Sequence:

1. **Branch Initialization:**
   Run `git branch --show-current`. If on `main`, checkout a dedicated release branch:
   `git checkout -b release/<TAG>`

2. **Version Bump (Raw `SEMVER` only):**
   Update `<SEMVER>` in all three configuration files:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
   *(Do NOT include a leading `v` in these files).*

3. **Changelog & Draft Artifacts:**
   Read git commit history since the previous tag. Generate release notes categorized under:
   - `### 🚀 Features`
   - `### 🐛 Fixes`
   - `### 🔧 Under the Hood`

   Append the direct download table populated with `<SEMVER>` and `<TAG>`:

   ### 📦 Downloads & Installation

   | Platform | Variant / Architecture | Direct Download |
   | :--- | :--- | :--- |
   | **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_<SEMVER>_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/<TAG>/frugallm-app_<SEMVER>_universal.dmg) |
   | **Windows** | Standard Installer (`.exe`) | [frugallm-app_<SEMVER>_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/<TAG>/frugallm-app_<SEMVER>_x64-setup.exe) |
   | **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_<SEMVER>_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/<TAG>/frugallm-app_<SEMVER>_amd64.deb) |
   | **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_<SEMVER>_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/<TAG>/frugallm-app_<SEMVER>_amd64.AppImage) |

   Save this combined output to `production_artifacts/release_notes.md`.

4. **Halt for Approval:**
   Pause execution and output:
   > *"Draft release `<TAG>` prepared with title `<DRAFT_TITLE>`. Do you approve the changelog and version bump? Type 'Approved' to continue."*
   
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
   *(If admin bypass is disallowed, use `gh pr merge --auto --squash --delete-branch`)*
   `git checkout main && git pull origin main`

7. **Create Private Draft Release:**
   Tag the commit and initialize the release explicitly with the `--draft` flag and canonical `<DRAFT_TITLE>`:
   `git tag <TAG>`
   `git push origin <TAG>`
   `gh release create <TAG> --draft --title "<DRAFT_TITLE>" --notes-file production_artifacts/release_notes.md`

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

9. **Release Asset & Metadata Verification:**
   Ensure assets were attached and the title was not altered during CI:
   `gh release view <TAG> --json assets`
   `gh release edit <TAG> --title "<DRAFT_TITLE>"`

10. **Report Verification & Completion:**
    Only after Step 8 and Step 9 pass 100% green, output the final report:
    - 🔒 **Draft Release Ready:** `<TAG>` is live on GitHub in **Draft mode** with title `<DRAFT_TITLE>`.
    - ✅ **CI Complete:** All build and test workflows passed successfully.
    - 📦 **Verified Assets:** List the binary filenames attached to the draft release.
    - 📥 **Download Command:**
      `gh release download <TAG>`
    - 🚀 **Publish Command:**
      `gh release edit <TAG> --draft=false --title "<RELEASE_TITLE>"`