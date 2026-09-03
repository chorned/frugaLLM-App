---
description: Build, test, and publish a private draft release on GitHub visible only to repository maintainers.
---

When the user types `/ship-draft` (or `/ship-draft <version_input>`), orchestrate the private release pipeline strictly using the `@engineer` persona. You are acting as the Release Manager.

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

8. **Report Verification Instructions:**
   Confirm to the user:
   - 🔒 **Draft Created:** The release is live on GitHub in **Draft mode** (hidden from the public).
   - 🧪 **CI Pipeline:** Multi-platform builds have been dispatched.
   - 📥 **Download Command:** Provide the command to fetch the build once CI completes:
     `gh release download <TAG>`
   - 🚀 **Publish Command:** Remind the user how to make it public when ready:
     `gh release edit <TAG> --draft=false`