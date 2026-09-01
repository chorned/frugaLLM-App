---
description: Automate the Playwright testing, version bumping, cross-compilation, and GitHub release pipeline.
---

When the user types `/ship-release <version_number>`, orchestrate the deployment strictly using the `@engineer` persona. You are acting as the Release Manager. 

### Execution Sequence:

1. **Version Bump:** 
   Locate `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `package.json`. Update the version strings in all three files to the provided `<version_number>`.

2. **Changelog Generation:** 
   Read the recent git commit history since the last release tag. Generate a clean, user-facing markdown summary of the changes, categorizing them into "Features", "Fixes", and "Under the Hood". Save this to `production_artifacts/release_notes.md`.

3. **Halt for Approval:** 
   Pause and explicitly ask: *"Do you approve these version bumps and release notes? You can edit `production_artifacts/release_notes.md` directly. Type 'Approved' to continue."*
   *Halt Condition:* Do not proceed until explicit confirmation.

4. **Commit & The Local Gate:** 
   Stage and commit the modified files with the message: "chore(release): prepare v<version_number>".
   Push directly to the local proxy: `git push no-mistakes HEAD:main`. 
   *Halt Condition:* If `no-mistakes` finds an error and blocks the push, halt the release sequence immediately so the human can intervene.

5. **Tag & CI Handoff:** 
   Once the push to `main` succeeds, create a git tag: `v<version_number>`.
   Push the tag to the remote: `git push origin v<version_number>`. (This triggers the production GitHub Actions matrix).

6. **Changelog Injection:**
   Run the following command to update the CI-generated release with our generated markdown notes:
   `gh release edit v<version_number> --notes-file production_artifacts/release_notes.md`
   Inform the user the release is building in the cloud!