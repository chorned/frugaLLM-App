import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('DevSecOps & Repository Security Compliance (CHO-85)', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('verifies SECURITY.md exists with required disclosure policies and SLAs', () => {
    const securityPath = path.join(rootDir, 'SECURITY.md');
    expect(fs.existsSync(securityPath), 'SECURITY.md should exist in root').toBe(true);

    const content = fs.readFileSync(securityPath, 'utf-8');
    expect(content).toMatch(/# Security Policy/i);
    expect(content).toMatch(/Reporting a Vulnerability/i);
    expect(content).toMatch(/48 hours/i);
    expect(content).toMatch(/14 days/i);
    expect(content).toMatch(/Supported Versions/i);
    expect(content).toMatch(/hermes\.horned@gmail\.com/i);
  });

  it('verifies .github/dependabot.yml exists with npm and cargo ecosystems', () => {
    const dependabotPath = path.join(rootDir, '.github/dependabot.yml');
    expect(fs.existsSync(dependabotPath), '.github/dependabot.yml must exist').toBe(true);

    const content = fs.readFileSync(dependabotPath, 'utf-8');
    expect(content).toMatch(/version:\s*2/);
    expect(content).toMatch(/package-ecosystem:\s*["']?npm["']?/);
    expect(content).toMatch(/directory:\s*["']?\/["']?/);
    expect(content).toMatch(/package-ecosystem:\s*["']?cargo["']?/);
    expect(content).toMatch(/directory:\s*["']?\/src-tauri["']?/);
    expect(content).toMatch(/interval:\s*["']?weekly["']?/);
  });

  it('verifies .github/workflows/security.yml exists with least-privilege, SHA pinning, and required jobs', () => {
    const securityWorkflowPath = path.join(rootDir, '.github/workflows/security.yml');
    expect(fs.existsSync(securityWorkflowPath), '.github/workflows/security.yml must exist').toBe(true);

    const content = fs.readFileSync(securityWorkflowPath, 'utf-8');
    // Triggers
    expect(content).toMatch(/push:/);
    expect(content).toMatch(/pull_request:/);
    expect(content).toMatch(/workflow_dispatch:/);

    // Root least privilege
    expect(content).toMatch(/permissions:\s*\n\s*contents:\s*read/);

    // Jobs
    expect(content).toMatch(/dependency-audit:/);
    expect(content).toMatch(/codeql-analysis:/);
    expect(content).toMatch(/scorecard:/);

    // Dependency Audit commands
    expect(content).toMatch(/npm audit --audit-level=high/);
    expect(content).toMatch(/cargo audit/);

    // CodeQL permissions
    expect(content).toMatch(/security-events:\s*write/);

    // Scorecard publish results
    expect(content).toMatch(/publish_results:\s*true/);

    // OpenSSF Pinned Dependencies: all 'uses: <action>' must use full 40-hex SHA
    const actionUses = content.match(/uses:\s*([^\s]+)/g) || [];
    expect(actionUses.length).toBeGreaterThan(0);
    for (const useLine of actionUses) {
      const match = useLine.match(/uses:\s*([^#\s]+)/);
      if (match && !match[1].startsWith('./')) {
        const actionRef = match[1];
        // Expect @<40 hex SHA>
        expect(
          actionRef,
          `Action reference '${actionRef}' must be pinned to a 40-character commit SHA for OpenSSF Scorecard`
        ).toMatch(/@[a-f0-9]{40}$/);
      }
    }
  });

  it('verifies README.md has OpenSSF Scorecard, CodeQL, Security Audit, and Dependabot badges', () => {
    const readmePath = path.join(rootDir, 'README.md');
    const content = fs.readFileSync(readmePath, 'utf-8');

    expect(content).toMatch(/api\.scorecard\.dev\/projects\/github\.com\/chorned\/frugaLLM-App\/badge/);
    expect(content).toMatch(/actions\/workflows\/security\.yml\/badge\.svg\?branch=main&job=codeql-analysis/);
    expect(content).toMatch(/actions\/workflows\/security\.yml\/badge\.svg\?branch=main&job=dependency-audit/);
    expect(content).toMatch(/img\.shields\.io\/badge\/Dependabot-active/);
  });
});
