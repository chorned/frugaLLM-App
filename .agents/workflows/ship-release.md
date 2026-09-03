---
description: Automate the Playwright testing, version bumping, cross-compilation, and GitHub release pipeline.
---

When the user types `/ship-release` (or optionally `/ship-release <version_input>`), orchestrate the deployment strictly using the `@engineer` persona. You are acting as the Release Manager.

### Step 0: Version Discovery & Canonical Normalization (MANDATORY)

1. **Read Current Version:**
   Read `package.json` to extract the current semantic version (`CURRENT_VERSION`, e.g., `1.2.3`).

2. **Calculate Target Version:**
   - **Default (No input provided):** Auto-increment the patch number:
     If current is `X.Y.Z`, target is strictly `X.Y.(Z+1)` (e.g., `1.2.3` becomes `1.2.4`).
   - **Manual Override (If `<version_input>` is provided):** Strip any leading `v` or whitespace from the provided string.

3. **Lock Canonical Variables:**
   - **`SEMVER`**: Raw numbers and dots only (e.g., `1.2.4`).
   - **`TAG`**: Strictly `v<SEMVER>` (e.g., `v1.2.4`).

4. **Declare Objective in Chat:**
   Print the transition directly in chat:
   > 🚀 **Initiating Release:** `<CURRENT_VERSION>` → **`<SEMVER>`** (Tag: `<TAG>`)

All downstream steps, file updates, commit messages, and URLs must use these exact variables.

---

### Execution Sequence:

1. **Branch Initialization:**
   Run `git branch --show-current`. If on `main`, create and checkout a dedicated release branch:
   `git checkout -b release/<TAG>`

2. **Version Bump (Raw `SEMVER` only):**
   Update the version string to `<SEMVER>` in all three configuration files:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
   *(Do NOT include a leading `v` in these files).*

3. **Changelog Generation:**
   Read git commit history since the previous tag. Generate a markdown summary categorizing changes strictly under:
   - `### 🚀 Features`
   - `### 🐛 Fixes`
   - `### 🔧 Under the Hood`

   Append the direct download table verbatim at the bottom of the release notes:

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
   > *"Do you approve the patch bump to `<SEMVER>` (`<TAG>`) and the generated release notes in `production_artifacts/release_notes.md`? Type 'Approved' to continue."*

   **Halt Condition:** Stop execution completely and do not push or commit until the user responds in chat.

5. **Commit & The Local Gate (`no-mistakes`):**
   Stage the version bumps and release notes:
   `git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml production_artifacts/release_notes.md`
   `git commit -m "chore(release): prepare <TAG>"`

   Push the release branch to the local verification gate:
   `git push no-mistakes HEAD`

   **Halt Condition:** If `no-mistakes` flags any error or exits non-zero, halt immediately for manual review.

6. **Pull Request Creation & Merge:**
   Once `no-mistakes` verification passes cleanly:
   - Push branch to remote:
     `git push -u origin HEAD`
   - Open Pull Request targeting `main`:
     `gh pr create --base main --head release/<TAG> --title "chore(release): <TAG>" --body-file production_artifacts/release_notes.md`
   - Merge the PR:
     `gh pr merge --squash --delete-branch --admin`
     *(If admin bypass is disallowed, use `gh pr merge --auto --squash --delete-branch`)*
   - Sync local `main`:
     `git checkout main && git pull origin main`

7. **Tag & CI Hand-off:**
   Tag the merged commit on `main` to trigger the production multi-platform build matrix:
   `git tag <TAG>`
   `git push origin <TAG>`

8. **Changelog Injection:**
   Update the release metadata created by GitHub Actions with the standardized title and notes:
   `gh release edit <TAG> --title "<TAG>" --notes-file production_artifacts/release_notes.md`

   Confirm to the user:
   > *"Release `<TAG>` has been merged into main, tagged, and is building in GitHub Actions."*