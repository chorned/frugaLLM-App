---
description: Automate the Playwright testing, version bumping, cross-compilation, and GitHub release pipeline.
---

When the user types `/ship-release <version_number>`, orchestrate the deployment strictly using the `@engineer` persona.

### Execution Sequence:

1. **Test Phase:** 
   Execute `npm run test` (to run the Playwright E2E tests against the Vite server) and `cargo test` (for the Rust backend). 
   *Halt Condition:* If any test fails, stop the sequence immediately and report the error to the user for debugging.

2. **Version Bump:** 
   Locate `tauri.conf.json`, `Cargo.toml`, and `package.json`. Update the version strings in all three files to the provided `<version_number>`.

3. **Changelog Generation:** 
   Read the recent git commit history since the last release tag. Generate a clean, user-facing markdown summary of the changes, categorizing them into "Features", "Fixes", and "Under the Hood". Save this summary to `production_artifacts/release_notes.md`.

4. **Halt for Approval:** 
   Pause the workflow and explicitly ask the user: *"Do you approve these release notes? You can edit the `release_notes.md` file directly if needed. Type 'Approved' to continue."*
   *Halt Condition:* Do not proceed until the user explicitly confirms approval.

5. **Compilation:** 
   Run the Tauri cross-compilation build command: `npm run tauri build`. 
   *Halt Condition:* Treat compilation warnings as errors. If the build fails for any target (Mac, Windows, Linux), halt and report the error.

6. **Publish:** 
   Using the GitHub CLI (`gh release create`), draft a new public release. Attach the compiled binaries from the Tauri build output directory and include the approved contents of `release_notes.md` as the release description.