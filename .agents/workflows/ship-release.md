---
description: Automate the Playwright testing, version bumping, cross-compilation, and GitHub release pipeline.
---

When the user types `/ship-release <version_number>`, orchestrate the deployment strictly using the `@engineer` persona. You are acting as the Release Manager. Do not guess or auto-fix source code during this sequence.

### Execution Sequence:

1. **Version Bump:** 
   Locate `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `package.json`. Update the version strings in all three files to the provided `<version_number>`.

2. **Changelog Generation:** 
   Read the recent git commit history since the last release tag. Generate a clean, user-facing markdown summary of the changes, categorizing them into "Features", "Fixes", and "Under the Hood". Save this summary to `production_artifacts/release_notes.md`.

3. **Halt for Approval:** 
   Pause the workflow and explicitly ask the user: *"Do you approve these version bumps and release notes? You can edit the `production_artifacts/release_notes.md` file directly if needed. Type 'Approved' to continue."*
   *Halt Condition:* Do not proceed until the user explicitly confirms approval.

4. **Commit & The Local Gate:** 
   Stage and commit the modified version files and changelog with the message: "chore(release): prepare v<version_number>".
   Instead of standard validation, use the `/no-mistakes` agent skill (or run `git push no-mistakes`) to gate this commit. This will automatically spin up a disposable worktree and run the test, linting, and documentation pipeline. 
   *Halt Condition:* Nothing reaches the configured push target until every check is green. If `no-mistakes` stops with a finding for the user to act on, halt the release sequence and await human intervention.

5. **Tag & CI Handoff:** 
   Once `no-mistakes` has successfully verified the pipeline and pushed the commit to the upstream repository, create a git tag for the new version matching the format: `v<version_number>`.
   Push the tag to the remote using standard Git: `git push origin v<version_number>`.

6. **Wrap-Up:** 
   Inform the user that the release tag has been pushed successfully and that the GitHub Actions release matrix has taken over to compile the binaries and draft the public release.