# GitHub Token Authentication Workaround

If the user provides a GitHub token (PAT) for pushing code or creating releases, and standard authentication (e.g. `gh auth login`) fails due to missing scopes like `read:org`, do not fail the workflow. Instead, use the following workarounds:

1. **For GitHub CLI (`gh`) Commands:** 
   Bypass authentication by injecting the token directly as an environment variable for the specific command.
   *Example:* `GH_TOKEN=<token> gh release create ...`

2. **For Git Commands (`git push`, etc.):** 
   Update the repository's remote URL to include the token for basic auth, then execute the push.
   *Example:* 
   ```bash
   git remote set-url origin https://<username>:<token>@github.com/<owner>/<repo>.git
   git push origin main
   ```
