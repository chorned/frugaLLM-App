# Security Policy

The FrugaLLM team and community take the security of our application, dependencies, and users seriously. We appreciate responsible disclosure of security vulnerabilities and are committed to addressing reported issues promptly and transparently.

## Supported Versions

Only the latest active release branch receives proactive security updates and vulnerability patches.

| Version | Supported          | Release Status |
| ------- | ------------------ | -------------- |
| 0.1.x   | :white_check_mark: | Active         |
| 0.0.x   | :white_check_mark: | Maintenance    |
| < 0.0.9 | :x:                | End of Life    |

## Reporting a Vulnerability

**Please do not report security vulnerabilities via public GitHub issues, discussions, or social media channels.**

To report a vulnerability, please use one of the following secure disclosure channels:

1. **GitHub Private Vulnerability Reporting (Preferred):**
   Submit an advisory directly via the GitHub Security Advisory portal:
   [Report a Vulnerability on GitHub](https://github.com/chorned/frugaLLM-App/security/advisories/new)

2. **Direct Security Contact:**
   If you are unable to use GitHub Security Advisories, send an encrypted or direct email to:
   **`hermes.horned@gmail.com`**

### What to Include in Your Report
To help us triage and resolve your report efficiently, please include:
- A clear description of the vulnerability and its potential impact.
- Steps to reproduce the issue (proof-of-concept script, configuration, or reproduction scenario).
- The operating system and version of FrugaLLM where the vulnerability was observed.
- Any known mitigations or proposed fixes.

## Response SLA & Incident Timeline

We adhere to the following Service Level Agreement for security disclosures:
- **Initial Acknowledgement:** Within **48 hours** of report receipt.
- **Triage & Validation:** Within **5 business days**, confirming reproduction and assigning severity (CVSS score).
- **Remediation & Patch Target:** Within **14 days** of confirmation for high/critical vulnerabilities.
- **Coordinated Disclosure:** We request a 90-day embargo period from the initial report date (or until an official patch is published) before any public disclosure.

## Security Best Practices for Users
- Always run the latest stable version of FrugaLLM.
- Keep local model runtimes (such as Ollama) updated.
- Never share or commit your API keys; FrugaLLM stores sensitive tokens in native OS keyrings.

## Safe Harbor & Research Protections
We consider activities conducted in good faith and in compliance with this policy to be authorized. We will not pursue legal action against security researchers who:
- Make a good-faith effort to avoid privacy violations, data destruction, and service disruption.
- Give us reasonable time to remedy the vulnerability before public disclosure.
