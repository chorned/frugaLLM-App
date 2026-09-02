---
description: Automate the Playwright testing, version bumping, cross-compilation, and GitHub release pipeline.
---

When the user types `/ship-release <version_number>`, orchestrate the deployment strictly using the `@engineer` persona. You are acting as the Release Manager. 

### Execution Sequence:

1. **Branch Initialization:** 
   Run `git branch --show-current`. If the active branch is `main`, autonomously generate and checkout a new branch named `release/v<version_number>`. 

2. **Version Bump:** 
   Locate `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `package.json`. Update the version strings in all three files strictly to the provided `<version_number>`.

3. **Changelog Generation:** 
   Read the git commit history since the previous tag. Generate a clean, user-facing markdown summary of the changes, categorizing them into "Features", "Fixes", and "Under the Hood". 
   
   AT THE VERY BOTTOM of the release notes, you MUST append the following markdown table verbatim, replacing every instance of `<version_number>` with the actual target version, to provide direct download links:

   ### 📦 Downloads & Installation

   | Platform | Variant / Architecture | Direct Download |
   | :--- | :--- | :--- |
   | **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_<version_number>_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v<version_number>/frugallm-app_<version_number>_universal.dmg) |
   | **Windows** | Standard Installer (`.exe`) | [frugallm-app_<version_number>_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v<version_number>/frugallm-app_<version_number>_x64-setup.exe) |
   | **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_<version_number>_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v<version_number>/frugallm-app_<version_number>_amd64.deb) |
   | **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_<version_number>_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v<version_number>/frugallm-app_<version_number>_amd64.AppImage) |

   Save this combined output (the summary + the table) to `production_artifacts/release_notes.md`.

4. **Halt for Approval:** 
   Pause and explicitly ask: *"Do you approve these version bumps and release notes? You can edit `production_artifacts/release_notes.md` directly. Type 'Approved' to continue."*
   *Halt Condition:* Do not proceed until explicit confirmation from the user.

5. **Commit & The Local Gate:** 
   Stage and commit the modified files with the exact message: "chore(release): prepare v<version_number>".
   Push directly to the local proxy: `git push no-mistakes HEAD:main`. 
   *Halt Condition:* If `no-mistakes` finds an error and blocks the push, halt the release sequence immediately so the human can intervene.

6. **Tag & CI Handoff:** 
   Once the push to `main` succeeds, create a git tag: `v<version_number>`.
   Push the tag to the remote: `git push origin v<version_number>`. (This triggers the production GitHub Actions matrix).

7. **Changelog Injection:**
   Run the following command to update the CI-generated release with our generated markdown notes:
   `gh release edit v<version_number> --notes-file production_artifacts/release_notes.md`
   Inform the user the release is building in the cloud!