# GitHub Token Authentication Workaround

If the user provides a GitHub token (PAT) for pushing code or creating releases, and standard authentication (e.g. `gh auth login`) fails due to missing scopes like `read:org`, do not fail the workflow. Instead, use the following workarounds:

## Token Location (.env)
The GitHub Personal Access Token for user `hermeshorned` is stored in the project root [.env](file:///c:/Users/chorned/projects/frugaLLM-App/.env) file (which is strictly `.gitignore`d):
```env
GITHUB_USER=hermeshorned
GITHUB_TOKEN=ghp_...
GH_TOKEN=ghp_...
```

1. **For GitHub CLI (`gh`) Commands:** 
   Extract and pass `GH_TOKEN` directly from `.env`:
   
   *PowerShell (Windows):*
   ```powershell
   $env:GH_TOKEN = (Get-Content .env | Select-String '^GH_TOKEN=').Line.Split('=', 2)[1].Trim()
   gh release create ...
   ```
   
   *Bash (macOS / Linux):*
   ```bash
   GH_TOKEN=$(grep '^GH_TOKEN=' .env | cut -d '=' -f2-) gh release create ...
   ```

2. **For Git Commands (`git push`, etc.):** 
   Inject user `hermeshorned` and the token from `.env` into the remote URL:
   
   *PowerShell (Windows):*
   ```powershell
   $token = (Get-Content .env | Select-String '^GITHUB_TOKEN=').Line.Split('=', 2)[1].Trim()
   git remote set-url origin "https://hermeshorned:${token}@github.com/chorned/frugaLLM-App.git"
   git push origin main
   ```
   
   *Bash (macOS / Linux):*
   ```bash
   TOKEN=$(grep '^GITHUB_TOKEN=' .env | cut -d '=' -f2-)
   git remote set-url origin "https://hermeshorned:${TOKEN}@github.com/chorned/frugaLLM-App.git"
   git push origin main
   ```
